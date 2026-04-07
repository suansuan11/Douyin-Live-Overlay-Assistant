import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import process from 'node:process';
import { DEFAULT_CONFIG, type AppConfig, type OverlayLayout } from '../../src/shared/config';
import { IPC_CHANNELS, type OverlayState } from '../../src/shared/ipc';
import { ConfigStore } from './configStore';
import { AppLogger, type LogLevel } from './logger';

let mainWindow: BrowserWindow | null = null;
let configStore: ConfigStore;
let logger: AppLogger;
let overlayState: OverlayState = {
  visible: DEFAULT_CONFIG.window.visible,
  clickThrough: DEFAULT_CONFIG.window.clickThrough,
  editMode: !DEFAULT_CONFIG.window.clickThrough,
  opacity: DEFAULT_CONFIG.window.opacity,
  layout: DEFAULT_CONFIG.overlay.layout
};

const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow(): BrowserWindow {
  const config = configStore.get();
  overlayState = {
    visible: config.window.visible,
    clickThrough: config.window.clickThrough,
    editMode: !config.window.clickThrough,
    opacity: config.window.opacity,
    layout: config.overlay.layout
  };

  const display = screen.getPrimaryDisplay();
  const x = config.window.x ?? display.workArea.x + 80;
  const y = config.window.y ?? display.workArea.y + 80;

  const win = new BrowserWindow({
    x,
    y,
    width: config.window.width,
    height: config.window.height,
    minWidth: 260,
    minHeight: 220,
    transparent: true,
    frame: false,
    show: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: !config.window.clickThrough,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Douyin Live Overlay Assistant',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  applyWindowState(win, overlayState);

  win.once('ready-to-show', () => {
    if (overlayState.visible) {
      win.showInactive();
    }
  });

  win.on('moved', () => persistWindowBounds(win));
  win.on('resized', () => persistWindowBounds(win));
  win.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173');
    win.webContents.openDevTools({ mode: 'detach', activate: false });
  } else {
    void win.loadFile(join(__dirname, '../../dist/index.html'));
  }

  return win;
}

function applyWindowState(win: BrowserWindow, state: OverlayState): void {
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setOpacity(state.opacity);
  win.setIgnoreMouseEvents(state.clickThrough, { forward: true });
  win.setFocusable(!state.clickThrough);

  if (state.visible && !win.isVisible()) {
    win.showInactive();
  }
  if (!state.visible && win.isVisible()) {
    win.hide();
  }

  broadcastOverlayState();
}

function persistWindowBounds(win: BrowserWindow): void {
  const bounds = win.getBounds();
  configStore.update({
    window: {
      ...configStore.get().window,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }
  });
}

function updateOverlayState(patch: Partial<OverlayState>): OverlayState {
  overlayState = {
    ...overlayState,
    ...patch
  };

  const current = configStore.get();
  configStore.update({
    window: {
      ...current.window,
      visible: overlayState.visible,
      clickThrough: overlayState.clickThrough,
      opacity: overlayState.opacity
    },
    overlay: {
      ...current.overlay,
      layout: overlayState.layout
    }
  });

  if (mainWindow) {
    applyWindowState(mainWindow, overlayState);
  }

  return overlayState;
}

function broadcastOverlayState(): void {
  mainWindow?.webContents.send(IPC_CHANNELS.overlayState, overlayState);
}

function registerHotkeys(config: AppConfig): void {
  globalShortcut.unregisterAll();

  const bind = (accelerator: string, callback: () => void): void => {
    const ok = globalShortcut.register(accelerator, callback);
    if (!ok) {
      logger.warn(`Failed to register hotkey: ${accelerator}`);
    }
  };

  bind(config.hotkeys.toggleOverlay, () => {
    updateOverlayState({ visible: !overlayState.visible });
  });
  bind(config.hotkeys.toggleClickThrough, () => {
    updateOverlayState({
      clickThrough: !overlayState.clickThrough,
      editMode: overlayState.clickThrough
    });
  });
  bind(config.hotkeys.opacityUp, () => {
    updateOverlayState({ opacity: Math.min(1, Number((overlayState.opacity + 0.05).toFixed(2))) });
  });
  bind(config.hotkeys.opacityDown, () => {
    updateOverlayState({ opacity: Math.max(0.25, Number((overlayState.opacity - 0.05).toFixed(2))) });
  });
  bind(config.hotkeys.layoutList, () => updateOverlayState({ layout: 'list' }));
  bind(config.hotkeys.layoutGift, () => updateOverlayState({ layout: 'gift' }));
  bind(config.hotkeys.layoutMinimal, () => updateOverlayState({ layout: 'minimal' }));
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.configGet, () => configStore.get());
  ipcMain.handle(IPC_CHANNELS.configUpdate, (_event, patch: Partial<AppConfig>) => {
    const next = configStore.update(patch);
    registerHotkeys(next);
    updateOverlayState({
      opacity: next.window.opacity,
      clickThrough: next.window.clickThrough,
      visible: next.window.visible,
      editMode: !next.window.clickThrough,
      layout: next.overlay.layout
    });
    return next;
  });
  ipcMain.handle(IPC_CHANNELS.overlayState, () => overlayState);
  ipcMain.handle(IPC_CHANNELS.overlayToggleVisibility, () => {
    return updateOverlayState({ visible: !overlayState.visible });
  });
  ipcMain.handle(IPC_CHANNELS.overlayToggleClickThrough, () => {
    return updateOverlayState({
      clickThrough: !overlayState.clickThrough,
      editMode: overlayState.clickThrough
    });
  });
  ipcMain.handle(IPC_CHANNELS.overlaySetClickThrough, (_event, clickThrough: boolean) => {
    return updateOverlayState({ clickThrough, editMode: !clickThrough });
  });
  ipcMain.handle(IPC_CHANNELS.overlaySetLayout, (_event, layout: OverlayLayout) => {
    return updateOverlayState({ layout });
  });
  ipcMain.handle(IPC_CHANNELS.overlayResize, (_event, delta: { width: number; height: number }) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      mainWindow.setBounds({
        ...bounds,
        width: Math.max(260, bounds.width + delta.width),
        height: Math.max(220, bounds.height + delta.height)
      });
      persistWindowBounds(mainWindow);
    }
    return overlayState;
  });
  ipcMain.on(IPC_CHANNELS.log, (_event, level: LogLevel, message: string, meta?: unknown) => {
    logger[level]?.(message, meta);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

void app.whenReady().then(() => {
  configStore = new ConfigStore();
  logger = new AppLogger();
  registerIpc();
  registerHotkeys(configStore.get());
  mainWindow = createWindow();
  logger.info('Application started');
});
