import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, ItemSlot, SessionState } from './types';

export interface DiabloCaptureApi {
  getState(): Promise<{ config: AppConfig; session: SessionState }>;
  saveConfig(config: AppConfig): Promise<void>;
  chooseOutputDirectory(): Promise<string | null>;
  capture(slot: ItemSlot): Promise<void>;
  resetSession(): Promise<void>;
  exportSession(): Promise<string>;
  onStateChanged(callback: (state: { config: AppConfig; session: SessionState }) => void): void;
}

contextBridge.exposeInMainWorld('diabloCapture', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config),
  chooseOutputDirectory: () => ipcRenderer.invoke('directory:choose'),
  capture: (slot: ItemSlot) => ipcRenderer.invoke('capture:slot', slot),
  resetSession: () => ipcRenderer.invoke('capture:retake-all'),
  exportSession: () => ipcRenderer.invoke('export:session'),
  onStateChanged: (callback) => {
    ipcRenderer.on('state:changed', (_event, state) => callback(state));
  }
} satisfies DiabloCaptureApi);
