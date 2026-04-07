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
  configChanged: 'config:changed',
  appInfoGet: 'app-info:get',
  appOpenLogsDir: 'app:open-logs-dir',
  appExportConfig: 'app:export-config',
  appImportConfig: 'app:import-config',
  log: 'app:log'
} as const;

export interface OverlayState {
  visible: boolean;
  clickThrough: boolean;
  editMode: boolean;
  opacity: number;
  layout: OverlayLayout;
}

export interface HotkeyRegistrationStatus {
  accelerator: string;
  action: string;
  ok: boolean;
}

export interface AppInfo {
  appVersion: string;
  platform: NodeJS.Platform;
  configPath: string;
  logDir: string;
  launchAtLogin: boolean;
  hotkeys: HotkeyRegistrationStatus[];
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
  getAppInfo(): Promise<AppInfo>;
  openLogsDir(): Promise<string>;
  exportConfig(): Promise<{ canceled: boolean; filePath?: string }>;
  importConfig(): Promise<{ canceled: boolean; config?: AppConfig }>;
  log(level: 'info' | 'warn' | 'error', message: string, meta?: unknown): void;
  onOverlayStateChanged(callback: (state: OverlayState) => void): () => void;
  onConfigChanged(callback: (config: AppConfig) => void): () => void;
}

declare global {
  interface Window {
    electronBridge?: ElectronBridge;
  }
}
