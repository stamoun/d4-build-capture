import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, AppState, BuildDetails, ItemSlot } from './types';

export interface DiabloCaptureApi {
  getState(): Promise<AppState>;
  saveConfig(config: AppConfig): Promise<void>;
  saveBuildDetails(details: BuildDetails): Promise<void>;
  chooseOutputDirectory(): Promise<string | null>;
  openBuildUrl(): Promise<void>;
  openOutputDirectory(): Promise<void>;
  selectSlot(slot: ItemSlot): Promise<void>;
  resetSession(): Promise<void>;
  exportSession(): Promise<string>;
  onStateChanged(callback: (state: AppState) => void): void;
}

contextBridge.exposeInMainWorld('diabloCapture', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config),
  saveBuildDetails: (details: BuildDetails) => ipcRenderer.invoke('build-details:save', details),
  chooseOutputDirectory: () => ipcRenderer.invoke('directory:choose'),
  openBuildUrl: () => ipcRenderer.invoke('build-url:open'),
  openOutputDirectory: () => ipcRenderer.invoke('directory:open'),
  selectSlot: (slot: ItemSlot) => ipcRenderer.invoke('capture:select-slot', slot),
  resetSession: () => ipcRenderer.invoke('capture:retake-all'),
  exportSession: () => ipcRenderer.invoke('export:session'),
  onStateChanged: (callback) => {
    ipcRenderer.on('state:changed', (_event, state) => callback(state));
  }
} satisfies DiabloCaptureApi);
