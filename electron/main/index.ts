import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell
} from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { migrateConfig, type AppConfig, type OverlayLayout } from '../../src/shared/config';
import {
  IPC_CHANNELS,
  type AppInfo,
  type HotkeyRegistrationStatus,
  type OverlayState
} from '../../src/shared/ipc';
import { ConfigStore } from './configStore';
import { AppLogger, type LogLevel } from './logger';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let configStore: ConfigStore;
let logger: AppLogger;
let isQuitting = false;
let hotkeyStatus: HotkeyRegistrationStatus[] = [];
let overlayState: OverlayState = {
  visible: migrateConfig(undefined).window.visible,
  clickThrough: migrateConfig(undefined).window.clickThrough,
  editMode: !migrateConfig(undefined).window.clickThrough,
  opacity: migrateConfig(undefined).window.opacity,
  layout: migrateConfig(undefined).overlay.layout
};

const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL);
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (process.platform === 'win32') {
  app.setAppUserModelId('com.local.douyin-live-overlay-assistant');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
}

if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }
  updateOverlayState({ visible: true });
  mainWindow.showInactive();
});

function createWindow(): BrowserWindow {
  const config = configStore.get();
  overlayState = overlayStateFromConfig(config);
  const bounds = getSafeBounds(config);

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 260,
    minHeight: 220,
    transparent: true,
    frame: false,
    show: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: config.window.alwaysOnTop,
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

  applyWindowState(win, overlayState, config);

  win.once('ready-to-show', () => {
    if (overlayState.visible && !config.app.startHidden) {
      win.showInactive();
    }
  });

  win.on('moved', () => persistWindowBounds(win));
  win.on('resized', () => persistWindowBounds(win));
  const minimizableWindow = win as unknown as {
    on(event: 'minimize', listener: (event: Electron.Event) => void): void;
  };
  minimizableWindow.on('minimize', (event) => {
    if (configStore.get().app.minimizeToTray) {
      event.preventDefault();
      updateOverlayState({ visible: false });
    }
  });
  win.on('close', (event) => {
    if (!isQuitting && configStore.get().app.closeToTray) {
      event.preventDefault();
      updateOverlayState({ visible: false });
      return;
    }
    persistWindowBounds(win);
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Renderer process gone', details);
  });
  win.webContents.on('unresponsive', () => {
    logger.warn('Renderer became unresponsive');
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173');
  } else {
    void win.loadFile(join(__dirname, '../../dist/index.html'));
  }

  return win;
}

function overlayStateFromConfig(config: AppConfig): OverlayState {
  return {
    visible: config.window.visible,
    clickThrough: config.window.clickThrough,
    editMode: !config.window.clickThrough,
    opacity: config.window.opacity,
    layout: config.overlay.layout
  };
}

function getSafeBounds(config: AppConfig): Electron.Rectangle {
  const displays = screen.getAllDisplays();
  const workArea = displays[0]?.workArea ?? { x: 0, y: 0, width: 1920, height: 1080 };
  const width = Math.max(260, config.window.width);
  const height = Math.max(220, config.window.height);
  const requested = {
    x: config.window.x ?? workArea.x + 80,
    y: config.window.y ?? workArea.y + 80,
    width,
    height
  };

  const inDisplay = displays.some((display) => intersects(requested, display.workArea));
  if (inDisplay) {
    return requested;
  }

  return {
    x: workArea.x + 40,
    y: workArea.y + 40,
    width,
    height
  };
}

function intersects(a: Electron.Rectangle, b: Electron.Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function applyWindowState(win: BrowserWindow, state: OverlayState, config = configStore.get()): void {
  win.setAlwaysOnTop(config.window.alwaysOnTop, 'screen-saver');
  if (process.platform === 'win32' && config.window.alwaysOnTop) {
    // Reassert topmost on Windows after focus transitions from borderless games.
    win.moveTop();
  }
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setOpacity(state.opacity);
  win.setIgnoreMouseEvents(state.clickThrough, { forward: true });
  win.setFocusable(!state.clickThrough);
  win.setSkipTaskbar(true);

  if (state.visible && !win.isVisible()) {
    win.showInactive();
  }
  if (state.visible && win.isVisible() && !state.clickThrough && process.platform === 'win32') {
    win.focus();
  }
  if (!state.visible && win.isVisible()) {
    win.hide();
  }

  updateTrayMenu();
  broadcastOverlayState();
}

function persistWindowBounds(win: BrowserWindow): void {
  const bounds = win.getBounds();
  try {
    updateConfig({
      window: {
        ...configStore.get().window,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    });
  } catch (error) {
    logger.error('Failed to persist window bounds', error);
  }
}

function updateOverlayState(patch: Partial<OverlayState>): OverlayState {
  overlayState = {
    ...overlayState,
    ...patch
  };

  const current = configStore.get();
  updateConfig({
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

function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const next = configStore.update(patch);
  applyRuntimeConfig(next);
  broadcastConfig(next);
  logger.info('Config updated');
  return next;
}

function replaceConfig(nextConfig: unknown): AppConfig {
  const next = configStore.replace(nextConfig);
  applyRuntimeConfig(next);
  broadcastConfig(next);
  logger.info('Config imported');
  return next;
}

function applyRuntimeConfig(config: AppConfig): void {
  if (process.platform === 'win32') {
    try {
      app.setLoginItemSettings({
        openAtLogin: config.app.launchAtLogin,
        path: process.execPath
      });
    } catch (error) {
      logger.warn('Failed to apply launch-at-login setting', error);
    }
  }
  registerHotkeys(config);
  updateTrayMenu();
}

function broadcastOverlayState(): void {
  mainWindow?.webContents.send(IPC_CHANNELS.overlayState, overlayState);
}

function broadcastConfig(config = configStore.get()): void {
  mainWindow?.webContents.send(IPC_CHANNELS.configChanged, config);
}

function registerHotkeys(config: AppConfig): void {
  globalShortcut.unregisterAll();
  hotkeyStatus = [];

  const bind = (action: string, accelerator: string, callback: () => void): void => {
    const ok = accelerator.trim().length > 0 && globalShortcut.register(accelerator, callback);
    hotkeyStatus.push({ action, accelerator, ok });
    if (!ok) {
      logger.warn(`Failed to register hotkey: ${accelerator}`, { action });
    }
  };

  bind('toggleOverlay', config.hotkeys.toggleOverlay, () => {
    updateOverlayState({ visible: !overlayState.visible });
  });
  bind('toggleClickThrough', config.hotkeys.toggleClickThrough, () => {
    const nextClickThrough = !overlayState.clickThrough;
    updateOverlayState({
      clickThrough: nextClickThrough,
      editMode: !nextClickThrough
    });
  });
  bind('opacityUp', config.hotkeys.opacityUp, () => {
    updateOverlayState({ opacity: Math.min(1, Number((overlayState.opacity + 0.05).toFixed(2))) });
  });
  bind('opacityDown', config.hotkeys.opacityDown, () => {
    updateOverlayState({ opacity: Math.max(0.25, Number((overlayState.opacity - 0.05).toFixed(2))) });
  });
  bind('layoutList', config.hotkeys.layoutList, () => updateOverlayState({ layout: 'list' }));
  bind('layoutGift', config.hotkeys.layoutGift, () => updateOverlayState({ layout: 'gift' }));
  bind('layoutMinimal', config.hotkeys.layoutMinimal, () => updateOverlayState({ layout: 'minimal' }));
  bind('layoutDebug', config.hotkeys.layoutDebug, () => updateOverlayState({ layout: 'debug' }));
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Douyin Live Overlay Assistant');
  tray.on('click', () => {
    updateOverlayState({ visible: !overlayState.visible });
  });
  updateTrayMenu();
}

function createTrayIcon(): Electron.NativeImage {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#111827"/>
      <path d="M10 22V8h7.5c4 0 6.5 2.8 6.5 7s-2.5 7-6.5 7H10zm4-3.5h3.2c1.8 0 2.8-1.4 2.8-3.5s-1-3.5-2.8-3.5H14v7z" fill="#ff4168"/>
    </svg>
  `);
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);
}

function updateTrayMenu(): void {
  if (!tray || !configStore || !logger) {
    return;
  }
  const config = configStore.get();
  const menu = Menu.buildFromTemplate([
    {
      label: overlayState.visible ? '隐藏悬浮窗' : '显示悬浮窗',
      click: () => updateOverlayState({ visible: !overlayState.visible })
    },
    {
      label: overlayState.clickThrough ? '进入编辑模式' : '进入直播穿透模式',
      click: () => {
        const clickThrough = !overlayState.clickThrough;
        updateOverlayState({ clickThrough, editMode: !clickThrough, visible: true });
      }
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: config.app.launchAtLogin,
      click: () => updateConfig({ app: { ...config.app, launchAtLogin: !config.app.launchAtLogin } })
    },
    {
      label: '打开日志目录',
      click: () => {
        void shell.openPath(logger.getLogDir());
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.configGet, () => configStore.get());
  ipcMain.handle(IPC_CHANNELS.configUpdate, (_event, patch: Partial<AppConfig>) => {
    const next = updateConfig(patch);
    overlayState = overlayStateFromConfig(next);
    if (mainWindow) {
      applyWindowState(mainWindow, overlayState, next);
    }
    return next;
  });
  ipcMain.handle(IPC_CHANNELS.overlayState, () => overlayState);
  ipcMain.handle(IPC_CHANNELS.overlayToggleVisibility, () => updateOverlayState({ visible: !overlayState.visible }));
  ipcMain.handle(IPC_CHANNELS.overlayToggleClickThrough, () => {
    const clickThrough = !overlayState.clickThrough;
    return updateOverlayState({ clickThrough, editMode: !clickThrough, visible: true });
  });
  ipcMain.handle(IPC_CHANNELS.overlaySetClickThrough, (_event, clickThrough: unknown) => {
    if (typeof clickThrough !== 'boolean') {
      throw new Error('overlay:set-click-through expects boolean');
    }
    return updateOverlayState({ clickThrough, editMode: !clickThrough });
  });
  ipcMain.handle(IPC_CHANNELS.overlaySetLayout, (_event, layout: unknown) => {
    if (layout !== 'list' && layout !== 'gift' && layout !== 'minimal' && layout !== 'debug') {
      throw new Error('overlay:set-layout received invalid layout');
    }
    return updateOverlayState({ layout: layout as OverlayLayout });
  });
  ipcMain.handle(IPC_CHANNELS.overlayResize, (_event, delta: unknown) => {
    if (!isResizeDelta(delta)) {
      throw new Error('overlay:resize expects numeric width and height deltas');
    }
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
  ipcMain.handle(IPC_CHANNELS.appInfoGet, () => getAppInfo());
  ipcMain.handle(IPC_CHANNELS.appOpenLogsDir, async () => {
    const result = await shell.openPath(logger.getLogDir());
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.appExportConfig, async () => {
    const result = await dialog.showSaveDialog({
      title: '导出配置',
      defaultPath: 'douyin-live-overlay-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    writeFileSync(result.filePath, `${JSON.stringify(configStore.get(), null, 2)}\n`, 'utf8');
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle(IPC_CHANNELS.appImportConfig, async () => {
    const result = await dialog.showOpenDialog({
      title: '导入配置',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) {
      return { canceled: true };
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    const config = replaceConfig(raw);
    overlayState = overlayStateFromConfig(config);
    if (mainWindow) {
      applyWindowState(mainWindow, overlayState, config);
    }
    return { canceled: false, config };
  });
  ipcMain.on(IPC_CHANNELS.log, (_event, level: LogLevel, message: string, meta?: unknown) => {
    if (level !== 'info' && level !== 'warn' && level !== 'error') {
      return;
    }
    logger[level](message, meta);
  });
}

function getAppInfo(): AppInfo {
  const loginItemSettings = process.platform === 'win32' ? app.getLoginItemSettings() : { openAtLogin: false };
  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    configPath: configStore.getPath(),
    logDir: logger.getLogDir(),
    launchAtLogin: loginItemSettings.openAtLogin,
    hotkeys: hotkeyStatus
  };
}

function isResizeDelta(value: unknown): value is { width: number; height: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { width?: unknown }).width === 'number' &&
    typeof (value as { height?: unknown }).height === 'number'
  );
}

process.on('uncaughtException', (error) => {
  logger?.error('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  logger?.error('Unhandled rejection', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep tray app resident unless the user explicitly chooses Quit.
    if (isQuitting || !configStore.get().app.closeToTray) {
      app.quit();
    }
  }
});

app.on('activate', () => {
  if (mainWindow) {
    updateOverlayState({ visible: true });
    return;
  }
  mainWindow = createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

void app.whenReady().then(() => {
  configStore = new ConfigStore();
  logger = new AppLogger();
  registerIpc();
  applyRuntimeConfig(configStore.get());
  createTray();
  mainWindow = createWindow();
  logger.info('Application started', {
    configPath: configStore.getPath(),
    logDir: logger.getLogDir()
  });
});
