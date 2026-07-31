import type { DiabloCaptureApi } from './preload';

declare global {
  interface Window {
    diabloCapture: DiabloCaptureApi;
  }
}

export {};
