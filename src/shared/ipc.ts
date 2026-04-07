import type { AppConfig, OverlayLayout } from './config';

export const IPC_CHANNELS = {
  configGet: 'config:get',
  configUpdate: 'config:update',
  overlayState: 'overlay:state',
  overlayToggleVisibility: 'overlay:toggle-visibility',
  overlaySetClickThrough: 'overlay:set-click-through',
  overlayToggleClickThrough: 'overlay:toggle-click-through',
  overlaySetLayout: 'overlay:set-layout',
  overlayResize: 'overlay:resize',
  log: 'app:log'
} as const;

export interface OverlayState {
  visible: boolean;
  clickThrough: boolean;
  editMode: boolean;
  opacity: number;
  layout: OverlayLayout;
}

export interface ElectronBridge {
  getConfig(): Promise<AppConfig>;
  updateConfig(config: Partial<AppConfig>): Promise<AppConfig>;
  getOverlayState(): Promise<OverlayState>;
  toggleVisibility(): Promise<OverlayState>;
  toggleClickThrough(): Promise<OverlayState>;
  setClickThrough(clickThrough: boolean): Promise<OverlayState>;
  setLayout(layout: OverlayLayout): Promise<OverlayState>;
  resizeBy(delta: { width: number; height: number }): Promise<OverlayState>;
  log(level: 'info' | 'warn' | 'error', message: string, meta?: unknown): void;
  onOverlayStateChanged(callback: (state: OverlayState) => void): () => void;
}

declare global {
  interface Window {
    electronBridge?: ElectronBridge;
  }
}
