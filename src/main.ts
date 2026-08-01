import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  shell
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { captureRegion } from './capture';
import { exportSession } from './exporter';
import { loadConfig, saveConfig } from './config';
import { findNextUncapturedSlot } from './session';
import type { AppConfig, ItemSlot, SessionState } from './types';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;
let session: SessionState;

function newSession(): SessionState {
  return {
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    captures: {}
  };
}

function tempCaptureDirectory(): string {
  return path.join(app.getPath('temp'), 'diablo-build-capture', session.id);
}

async function emitState(): Promise<void> {
  mainWindow?.webContents.send('state:changed', { config, session });
}

async function capture(slot: ItemSlot): Promise<void> {
  try {
    const outputPath = await captureRegion(
      tempCaptureDirectory(),
      slot,
      config.captureRegion
    );

    session.captures[slot] = {
      slot,
      filePath: outputPath,
      capturedAt: new Date().toISOString()
    };

    await emitState();
  } catch (error) {
    dialog.showErrorBox(
      'Capture Failed',
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function captureNextSlot(): Promise<void> {
  const slot = findNextUncapturedSlot(session.captures);
  if (!slot) {
    dialog.showErrorBox('Capture Complete', 'All slots have already been captured.');
    return;
  }

  await capture(slot);
}

function registerShortcut(): void {
  const registered = globalShortcut.register(
    'CommandOrControl+Shift+Space',
    () => void captureNextSlot()
  );

  if (!registered) {
    dialog.showErrorBox(
      'Shortcut Unavailable',
      'Ctrl+Shift+Space is already registered by another application.'
    );
  }
}

async function createWindow(): Promise<void> {
  config = await loadConfig();
  session = newSession();

  const window = new BrowserWindow({
    width: 920,
    height: 760,
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

ipcMain.handle('state:get', async () => ({ config, session }));

ipcMain.handle('config:save', async (_event, nextConfig: AppConfig) => {
  config = nextConfig;
  await saveConfig(config);
  await emitState();
});

ipcMain.handle('vault:choose', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  config.vaultPath = result.filePaths[0];
  await saveConfig(config);
  await emitState();
  return config.vaultPath;
});

ipcMain.handle('capture:slot', async (_event, slot: ItemSlot) => {
  await capture(slot);
});

ipcMain.handle('capture:retake-all', async () => {
  await fs.rm(tempCaptureDirectory(), { recursive: true, force: true });
  session = newSession();
  await emitState();
});

ipcMain.handle('export:session', async () => {
  const outputDirectory = await exportSession(config, session);
  await shell.openPath(outputDirectory);
  return outputDirectory;
});
