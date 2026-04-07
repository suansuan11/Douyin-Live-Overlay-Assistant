import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, OverlayLayout } from '../../src/shared/config';
import { IPC_CHANNELS, type AppInfo, type ElectronBridge, type OverlayState } from '../../src/shared/ipc';

const bridge: ElectronBridge = {
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.configGet) as Promise<AppConfig>,
  updateConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.configUpdate, config) as Promise<AppConfig>,
  getOverlayState: () => ipcRenderer.invoke(IPC_CHANNELS.overlayState) as Promise<OverlayState>,
  toggleVisibility: () => ipcRenderer.invoke(IPC_CHANNELS.overlayToggleVisibility) as Promise<OverlayState>,
  toggleClickThrough: () => ipcRenderer.invoke(IPC_CHANNELS.overlayToggleClickThrough) as Promise<OverlayState>,
  setClickThrough: (clickThrough: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.overlaySetClickThrough, clickThrough) as Promise<OverlayState>,
  setLayout: (layout: OverlayLayout) =>
    ipcRenderer.invoke(IPC_CHANNELS.overlaySetLayout, layout) as Promise<OverlayState>,
  resizeBy: (delta) => ipcRenderer.invoke(IPC_CHANNELS.overlayResize, delta) as Promise<OverlayState>,
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfoGet) as Promise<AppInfo>,
  openLogsDir: () => ipcRenderer.invoke(IPC_CHANNELS.appOpenLogsDir) as Promise<string>,
  exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.appExportConfig) as Promise<{ canceled: boolean; filePath?: string }>,
  importConfig: () => ipcRenderer.invoke(IPC_CHANNELS.appImportConfig) as Promise<{ canceled: boolean; config?: AppConfig }>,
  log: (level, message, meta) => ipcRenderer.send(IPC_CHANNELS.log, level, message, meta),
  onOverlayStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: OverlayState): void => callback(state);
    ipcRenderer.on(IPC_CHANNELS.overlayState, listener);
    return () => ipcRenderer.off(IPC_CHANNELS.overlayState, listener);
  },
  onConfigChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void => callback(config);
    ipcRenderer.on(IPC_CHANNELS.configChanged, listener);
    return () => ipcRenderer.off(IPC_CHANNELS.configChanged, listener);
  }
};

contextBridge.exposeInMainWorld('electronBridge', bridge);
