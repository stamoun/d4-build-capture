import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  screen,
  shell
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { captureRegion } from './capture';
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

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (started) app.quit();

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;
let session: SessionState;
let selectedSlot: ItemSlot | null = null;
let capturingSlot: ItemSlot | null = null;

function newSession(): SessionState {
  return {
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    captures: {}
  };
}

function tempCaptureDirectory(): string {
  return path.join(app.getPath('temp'), 'diablo-build-capture', session.id);
}

function fullScreenRegion(): AppConfig['captureRegion'] {
  const display = screen.getPrimaryDisplay();
  return {
    x: 0,
    y: 0,
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  };
}

function appState(): AppState {
  return { config, session, version: app.getVersion(), selectedSlot, capturingSlot };
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
    const outputPath = await captureRegion(
      tempCaptureDirectory(),
      slot,
      config.captureFullScreen ? fullScreenRegion() : config.captureRegion
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
  config = await loadConfig(fullScreenRegion());
  session = newSession();

  const window = new BrowserWindow({
    width: 906,
    height: 844,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = window;

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Preload failed: ${preloadPath}`, error);
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load (${errorCode}): ${errorDescription}`);
  });
  window.webContents.once('did-finish-load', () => void emitState());
  await window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await createWindow();
  registerShortcut();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('state:get', async () => appState());

ipcMain.handle('config:save', async (_event, nextConfig: AppConfig) => {
  const previousConfig = config;
  if (nextConfig.characterClass !== config.characterClass) selectedSlot = null;
  config = await saveConfig({
    ...nextConfig,
    captureRegion: nextConfig.captureFullScreen ? fullScreenRegion() : nextConfig.captureRegion
  });
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
  await shell.openPath(outputDirectory);
  return outputDirectory;
});
