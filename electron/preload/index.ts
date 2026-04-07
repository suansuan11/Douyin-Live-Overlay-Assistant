import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, OverlayLayout } from '../../src/shared/config';
import { IPC_CHANNELS, type ElectronBridge, type OverlayState } from '../../src/shared/ipc';

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
  log: (level, message, meta) => ipcRenderer.send(IPC_CHANNELS.log, level, message, meta),
  onOverlayStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: OverlayState): void => callback(state);
    ipcRenderer.on(IPC_CHANNELS.overlayState, listener);
    return () => ipcRenderer.off(IPC_CHANNELS.overlayState, listener);
  }
};

contextBridge.exposeInMainWorld('electronBridge', bridge);
