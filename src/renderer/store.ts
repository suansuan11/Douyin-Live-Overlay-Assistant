import { create } from 'zustand';
import { DEFAULT_CONFIG, type AppConfig } from '../shared/config';
import type { OverlayState } from '../shared/ipc';
import type { ConnectionStatus, LiveEvent } from '../shared/events';

interface AppStore {
  config: AppConfig;
  overlayState: OverlayState;
  connection: ConnectionStatus;
  events: LiveEvent[];
  setConfig(config: AppConfig): void;
  patchConfig(patch: Partial<AppConfig>): void;
  setOverlayState(state: OverlayState): void;
  setConnection(status: ConnectionStatus): void;
  pushEvents(events: LiveEvent[]): void;
  clearEvents(): void;
}

function eventContainsKeyword(event: LiveEvent, keywords: readonly string[]): boolean {
  const haystack = [
    event.user.nickname,
    event.payload.text,
    event.payload.giftName,
    String(event.payload.giftCount ?? ''),
    String(event.payload.likeCount ?? '')
  ]
    .filter(Boolean)
    .join(' ');
  return keywords.some((keyword) => keyword && haystack.includes(keyword));
}

export function applyEventFilters(events: readonly LiveEvent[], config: AppConfig): LiveEvent[] {
  const { filters } = config.overlay;
  return events.filter((event) => {
    if (filters.showOnly === 'comments' && event.type !== 'comment') return false;
    if (filters.showOnly === 'gifts' && event.type !== 'gift') return false;
    if (filters.showOnly === 'system' && event.type !== 'system') return false;
    if (eventContainsKeyword(event, filters.blockedKeywords)) return false;
    return true;
  });
}

export const useAppStore = create<AppStore>((set) => ({
  config: DEFAULT_CONFIG,
  overlayState: {
    visible: DEFAULT_CONFIG.window.visible,
    clickThrough: DEFAULT_CONFIG.window.clickThrough,
    editMode: !DEFAULT_CONFIG.window.clickThrough,
    opacity: DEFAULT_CONFIG.window.opacity,
    layout: DEFAULT_CONFIG.overlay.layout
  },
  connection: {
    connected: false,
    connecting: false,
    retryAttempt: 0
  },
  events: [],
  setConfig: (config) => set({ config }),
  patchConfig: (patch) =>
    set((state) => ({
      config: {
        ...state.config,
        ...patch
      }
    })),
  setOverlayState: (overlayState) => set({ overlayState }),
  setConnection: (connection) => set({ connection }),
  pushEvents: (incoming) =>
    set((state) => {
      if (state.config.overlay.pauseScroll) {
        return state;
      }
      const filtered = applyEventFilters(incoming, state.config);
      if (filtered.length === 0) {
        return state;
      }
      return {
        events: [...state.events, ...filtered].slice(-state.config.overlay.maxEvents)
      };
    }),
  clearEvents: () => set({ events: [] })
}));
