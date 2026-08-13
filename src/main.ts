import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  shell
} from 'electron';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { captureFullScreen } from './capture';
import { exportSession } from './exporter';
import { loadConfig, saveConfig } from './config';
import { findCaptureSlot, findFollowingSlot } from './session';
import { toElectronAccelerator } from './shortcut';
import {
  getItemSlots,
  type AppConfig,
  type AppState,
  type BuildDetails,
  type ItemSlot,
  type SessionState
} from './types';

const PROJECT_URL = 'https://github.com/stamoun/d4-build-capture';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (started) app.quit();

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;
let session: SessionState;
let selectedSlot: ItemSlot | null = null;
let capturingSlot: ItemSlot | null = null;
let shutdownTimer: NodeJS.Timeout | null = null;

function newSession(): SessionState {
  return {
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    captures: {}
  };
}

function tempRootDirectory(): string {
  return path.join(app.getPath('temp'), 'diablo-build-capture');
}

function tempCaptureDirectory(): string {
  return path.join(tempRootDirectory(), session.id);
}

async function clearTemporaryCaptures(): Promise<void> {
  const rootDirectory = tempRootDirectory();
  await fs.rm(rootDirectory, { recursive: true, force: true });
  await fs.mkdir(rootDirectory, { recursive: true });
}

function appState(): AppState {
  return { config, session, version: app.getVersion(), tempDirectory: tempRootDirectory(), selectedSlot, capturingSlot };
}

function emitState(): void {
  mainWindow?.webContents.send('state:changed', appState());
}

async function capture(slot: ItemSlot): Promise<void> {
  if (capturingSlot) return;
  const isSelectedRetake = selectedSlot === slot;
  capturingSlot = slot;
  emitState();

  try {
    const outputPath = await captureFullScreen(
      tempCaptureDirectory(),
      slot
    );

    session.captures[slot] = {
      slot,
      filePath: outputPath,
      capturedAt: new Date().toISOString()
    };

    selectedSlot = isSelectedRetake
      ? findFollowingSlot(slot, getItemSlots(config.characterClass))
      : null;
  } catch (error) {
    dialog.showErrorBox(
      'Capture Failed',
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    capturingSlot = null;
    emitState();
  }
}

async function captureNextSlot(): Promise<void> {
  const slot = findCaptureSlot(
    session.captures,
    getItemSlots(config.characterClass),
    selectedSlot
  );
  if (!slot) {
    dialog.showErrorBox('Capture Complete', 'All slots have already been captured.');
    return;
  }

  await capture(slot);
}

function registerShortcut(): boolean {
  globalShortcut.unregisterAll();
  const registered = globalShortcut.register(
    toElectronAccelerator(config.shortcut),
    () => void captureNextSlot()
  );

  if (!registered) {
    dialog.showErrorBox(
      'Shortcut Unavailable',
      `${config.shortcut} is invalid or already registered by another application.`
    );
  }

  return registered;
}

async function createWindow(): Promise<void> {
  config = await loadConfig();
  session = newSession();

  const window = new BrowserWindow({
    width: 960,
    height: 860,
    minWidth: 720,
    minHeight: 760,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = window;

  window.once('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Preload failed: ${preloadPath}`, error);
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load (${errorCode}): ${errorDescription}`);
  });
  window.webContents.once('did-finish-load', () => void emitState());
  await window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
}

app.whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    await createWindow();
    registerShortcut();

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) await createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error('Application startup failed.', error);
    app.exit(1);
  });

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  shutdownTimer ??= setTimeout(() => app.exit(0), 2_000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('state:get', async () => appState());

ipcMain.handle('config:save', async (_event, nextConfig: AppConfig) => {
  const previousConfig = config;
  if (nextConfig.characterClass !== config.characterClass) selectedSlot = null;
  config = await saveConfig(nextConfig);
  if (!registerShortcut()) {
    config = await saveConfig(previousConfig);
    registerShortcut();
    throw new Error('The requested shortcut could not be registered.');
  }
  await emitState();
});

ipcMain.handle('build-details:save', async (_event, details: BuildDetails) => {
  config = await saveConfig({ ...config, ...details });
});

ipcMain.handle('directory:choose', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  config.outputDirectory = result.filePaths[0];
  config = await saveConfig(config);
  await emitState();
  return config.outputDirectory;
});

ipcMain.handle('build-url:open', async () => {
  if (!config.buildUrl) return;
  await shell.openExternal(config.buildUrl);
});

ipcMain.handle('directory:open', async () => {
  if (!config.outputDirectory) return;
  const error = await shell.openPath(config.outputDirectory);
  if (error) throw new Error(error);
});

ipcMain.handle('capture:select-slot', async (_event, slot: ItemSlot) => {
  if (!getItemSlots(config.characterClass).includes(slot)) return;
  selectedSlot = selectedSlot === slot ? null : slot;
  emitState();
});

ipcMain.handle('capture:retake-all', async () => {
  await fs.rm(tempCaptureDirectory(), { recursive: true, force: true });
  session = newSession();
  selectedSlot = null;
  await emitState();
});

ipcMain.handle('export:session', async () => {
  const outputDirectory = await exportSession(config, session);
  await clearTemporaryCaptures();
  session = newSession();
  selectedSlot = null;
  await emitState();
  const error = await shell.openPath(outputDirectory);
  if (error) throw new Error(error);
  return outputDirectory;
});

ipcMain.handle('temp-directory:get', async () => {
  return tempRootDirectory();
});

ipcMain.handle('temp-directory:open', async () => {
  const tempDir = tempRootDirectory();
  await fs.mkdir(tempDir, { recursive: true });
  const error = await shell.openPath(tempDir);
  if (error) throw new Error(error);
});

ipcMain.handle('temp-directory:clear', async () => {
  await clearTemporaryCaptures();
  session = newSession();
  selectedSlot = null;
  await emitState();
});

ipcMain.handle('preview:get', async (_event, slot: ItemSlot) => {
  if (!session.captures[slot]) return null;

  try {
    const filePath = session.captures[slot].filePath;
    const data = await fs.readFile(filePath);
    return Buffer.from(data).toString('base64');
  } catch {
    return null;
  }
});

ipcMain.handle('project-url:open', () => shell.openExternal(PROJECT_URL));
