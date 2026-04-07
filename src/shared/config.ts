export const CONFIG_VERSION = 2;

export type OverlayLayout = 'list' | 'gift' | 'minimal';
export type ShowOnlyFilter = 'all' | 'comments' | 'gifts' | 'system';
export type DataSourceMode = 'mock' | 'websocket' | 'bridge' | 'douyinOfficial';

export interface AppBehaviorConfig {
  launchAtLogin: boolean;
  closeToTray: boolean;
  minimizeToTray: boolean;
  startHidden: boolean;
}

export interface WindowConfig {
  x?: number;
  y?: number;
  width: number;
  height: number;
  opacity: number;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  visible: boolean;
}

export interface OverlayFilters {
  blockedKeywords: string[];
  highlightKeywords: string[];
  showOnly: ShowOnlyFilter;
}

export interface LikeAggregationConfig {
  enabled: boolean;
  windowMs: number;
}

export interface OverlayConfig {
  layout: OverlayLayout;
  fontSize: number;
  scale: number;
  maxEvents: number;
  pauseScroll: boolean;
  filters: OverlayFilters;
  likeAggregation: LikeAggregationConfig;
}

export interface DataConfig {
  mode: DataSourceMode;
  wsUrl: string;
  bridgeUrl: string;
  reconnectMinMs: number;
  reconnectMaxMs: number;
}

export interface HotkeyConfig {
  toggleOverlay: string;
  toggleClickThrough: string;
  opacityUp: string;
  opacityDown: string;
  layoutList: string;
  layoutGift: string;
  layoutMinimal: string;
}

export interface AppConfig {
  version: number;
  app: AppBehaviorConfig;
  window: WindowConfig;
  overlay: OverlayConfig;
  data: DataConfig;
  hotkeys: HotkeyConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  version: CONFIG_VERSION,
  app: {
    launchAtLogin: false,
    closeToTray: true,
    minimizeToTray: true,
    startHidden: false
  },
  window: {
    x: 80,
    y: 80,
    width: 440,
    height: 680,
    opacity: 0.86,
    alwaysOnTop: true,
    clickThrough: true,
    visible: true
  },
  overlay: {
    layout: 'list',
    fontSize: 16,
    scale: 1,
    maxEvents: 500,
    pauseScroll: false,
    filters: {
      blockedKeywords: [],
      highlightKeywords: ['礼物', '老板'],
      showOnly: 'all'
    },
    likeAggregation: {
      enabled: true,
      windowMs: 1200
    }
  },
  data: {
    mode: 'mock',
    wsUrl: 'ws://127.0.0.1:17890',
    bridgeUrl: 'ws://127.0.0.1:17891',
    reconnectMinMs: 500,
    reconnectMaxMs: 10000
  },
  hotkeys: {
    toggleOverlay: 'CommandOrControl+Alt+O',
    toggleClickThrough: 'CommandOrControl+Alt+L',
    opacityUp: 'CommandOrControl+Alt+Up',
    opacityDown: 'CommandOrControl+Alt+Down',
    layoutList: 'CommandOrControl+Alt+1',
    layoutGift: 'CommandOrControl+Alt+2',
    layoutMinimal: 'CommandOrControl+Alt+3'
  }
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDeep<T extends JsonObject>(base: T, patch: unknown): T {
  if (!isObject(patch)) {
    return structuredClone(base);
  }

  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] = isObject(current) && isObject(value) ? mergeDeep(current, value) : value;
  }
  return result as T;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter((item): item is string => typeof item === 'string').slice(0, 100);
}

function normalizeDataMode(value: unknown, legacyMockMode: unknown): DataSourceMode {
  if (legacyMockMode === false) {
    return 'websocket';
  }
  if (value === 'mock' || value === 'websocket' || value === 'bridge' || value === 'douyinOfficial') {
    return value;
  }
  return 'mock';
}

function normalizeLayout(value: unknown): OverlayLayout {
  return value === 'gift' || value === 'minimal' || value === 'list' ? value : DEFAULT_CONFIG.overlay.layout;
}

function normalizeShowOnly(value: unknown): ShowOnlyFilter {
  return value === 'comments' || value === 'gifts' || value === 'system' || value === 'all'
    ? value
    : DEFAULT_CONFIG.overlay.filters.showOnly;
}

export function migrateConfig(raw: unknown): AppConfig {
  const merged = mergeDeep(DEFAULT_CONFIG as unknown as JsonObject, raw) as unknown as AppConfig;
  const rawData = isObject(raw) && isObject(raw.data) ? raw.data : {};
  const rawMode = Object.prototype.hasOwnProperty.call(rawData, 'mode') ? rawData.mode : undefined;

  return {
    ...merged,
    version: CONFIG_VERSION,
    app: {
      launchAtLogin: Boolean(merged.app.launchAtLogin),
      closeToTray: merged.app.closeToTray !== false,
      minimizeToTray: merged.app.minimizeToTray !== false,
      startHidden: Boolean(merged.app.startHidden)
    },
    window: {
      ...merged.window,
      width: Math.round(clampNumber(merged.window.width, DEFAULT_CONFIG.window.width, 260, 1600)),
      height: Math.round(clampNumber(merged.window.height, DEFAULT_CONFIG.window.height, 220, 1200)),
      opacity: clampNumber(merged.window.opacity, DEFAULT_CONFIG.window.opacity, 0.25, 1),
      alwaysOnTop: merged.window.alwaysOnTop !== false,
      clickThrough: merged.window.clickThrough !== false,
      visible: merged.window.visible !== false
    },
    overlay: {
      ...merged.overlay,
      layout: normalizeLayout(merged.overlay.layout),
      fontSize: Math.round(clampNumber(merged.overlay.fontSize, DEFAULT_CONFIG.overlay.fontSize, 12, 28)),
      scale: clampNumber(merged.overlay.scale, DEFAULT_CONFIG.overlay.scale, 0.75, 1.5),
      maxEvents: Math.round(clampNumber(merged.overlay.maxEvents, DEFAULT_CONFIG.overlay.maxEvents, 100, 2000)),
      pauseScroll: Boolean(merged.overlay.pauseScroll),
      filters: {
        blockedKeywords: normalizeStringArray(merged.overlay.filters.blockedKeywords, []),
        highlightKeywords: normalizeStringArray(
          merged.overlay.filters.highlightKeywords,
          DEFAULT_CONFIG.overlay.filters.highlightKeywords
        ),
        showOnly: normalizeShowOnly(merged.overlay.filters.showOnly)
      },
      likeAggregation: {
        enabled: merged.overlay.likeAggregation.enabled !== false,
        windowMs: Math.round(
          clampNumber(
            merged.overlay.likeAggregation.windowMs,
            DEFAULT_CONFIG.overlay.likeAggregation.windowMs,
            250,
            10000
          )
        )
      }
    },
    data: {
      ...merged.data,
      mode: normalizeDataMode(rawMode ?? merged.data.mode, rawMode === undefined ? rawData.mockMode : undefined),
      reconnectMinMs: Math.round(clampNumber(merged.data.reconnectMinMs, DEFAULT_CONFIG.data.reconnectMinMs, 250, 60000)),
      reconnectMaxMs: Math.round(clampNumber(merged.data.reconnectMaxMs, DEFAULT_CONFIG.data.reconnectMaxMs, 1000, 300000))
    },
    hotkeys: {
      ...DEFAULT_CONFIG.hotkeys,
      ...merged.hotkeys
    }
  };
}
