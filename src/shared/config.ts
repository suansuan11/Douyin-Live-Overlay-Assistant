export type OverlayLayout = 'list' | 'gift' | 'minimal';
export type ShowOnlyFilter = 'all' | 'comments' | 'gifts';

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

export interface OverlayConfig {
  layout: OverlayLayout;
  fontSize: number;
  scale: number;
  maxEvents: number;
  filters: OverlayFilters;
}

export interface DataConfig {
  wsUrl: string;
  mockMode: boolean;
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
  window: WindowConfig;
  overlay: OverlayConfig;
  data: DataConfig;
  hotkeys: HotkeyConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
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
    filters: {
      blockedKeywords: [],
      highlightKeywords: ['礼物', '老板'],
      showOnly: 'all'
    }
  },
  data: {
    wsUrl: 'ws://127.0.0.1:17890',
    mockMode: true,
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
