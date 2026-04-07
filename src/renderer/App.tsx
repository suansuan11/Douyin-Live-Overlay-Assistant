import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLiveEventSource } from './hooks/useLiveEventSource';
import { applyEventFilters, useAppStore } from './store';
import type { AppConfig, DataSourceMode, OverlayLayout, ShowOnlyFilter } from '../shared/config';
import type { LiveEvent, LiveEventType } from '../shared/events';
import type { AppInfo } from '../shared/ipc';

const FILTER_OPTIONS: Array<{ value: ShowOnlyFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'comment', label: 'Comment' },
  { value: 'like', label: 'Like' },
  { value: 'gift', label: 'Gift' },
  { value: 'follow', label: 'Follow' },
  { value: 'fans_club', label: 'Fans Club' },
  { value: 'system', label: 'System' }
];

const EVENT_TYPES: LiveEventType[] = ['comment', 'like', 'gift', 'follow', 'fans_club', 'enter', 'system'];

function formatEvent(event: LiveEvent): string {
  if (event.type === 'comment') return event.payload.text ?? '';
  if (event.type === 'gift') return `sent ${event.payload.giftName || 'gift'} x${event.payload.giftCount ?? 1}`;
  if (event.type === 'like') return `liked x${event.payload.likeCount ?? 1}`;
  if (event.type === 'enter') return event.payload.text ?? 'entered the room';
  if (event.type === 'follow') return event.payload.followAction === 'unfollow' ? 'unfollowed' : 'followed';
  if (event.type === 'fans_club') return `fans club Lv.${event.payload.fansClubLevel ?? 0}`;
  return event.payload.text ?? 'system event';
}

function modeLabel(mode: DataSourceMode): string {
  if (mode === 'mock') return 'Mock';
  if (mode === 'websocket') return 'WebSocket';
  if (mode === 'bridge') return 'Bridge Receiver';
  return 'Official Adapter Shell';
}

function eventKey(event: LiveEvent): string {
  return `${event.eventId}-${event.timestamp}`;
}

function isHighlighted(event: LiveEvent, config: AppConfig): boolean {
  if (event.type === 'gift' || event.type === 'follow' || event.type === 'fans_club') return true;
  const text = `${event.user.nickname} ${event.payload.text ?? ''} ${event.payload.giftName ?? ''}`;
  return config.overlay.filters.highlightKeywords.some((keyword) => keyword && text.includes(keyword));
}

function splitKeywords(value: string): string[] {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function joinKeywords(value: readonly string[]): string {
  return value.join('\n');
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '--:--:--';
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });
}

function rawSummary(event: LiveEvent): string {
  if (!event.raw) return 'raw: none';
  if (typeof event.raw !== 'object') return `raw: ${String(event.raw).slice(0, 80)}`;
  return `raw keys: ${Object.keys(event.raw as Record<string, unknown>).slice(0, 8).join(', ') || 'object'}`;
}

function makeEventJsonSummary(event: LiveEvent): string {
  return JSON.stringify(
    {
      eventId: event.eventId,
      type: event.type,
      timestamp: event.timestamp,
      user: event.user,
      payload: event.payload,
      raw: event.raw
    },
    null,
    2
  );
}

function countEvents(events: readonly LiveEvent[]): Record<LiveEventType, number> {
  const counts: Record<LiveEventType, number> = {
    comment: 0,
    gift: 0,
    like: 0,
    enter: 0,
    follow: 0,
    fans_club: 0,
    system: 0
  };
  for (const event of events) {
    counts[event.type] += 1;
  }
  return counts;
}

function useFrozenEvents(events: LiveEvent[], paused: boolean): LiveEvent[] {
  const [snapshot, setSnapshot] = useState(events);
  const wasPausedRef = useRef(paused);

  useEffect(() => {
    if (events.length === 0) {
      setSnapshot([]);
    } else if (!paused) {
      setSnapshot(events);
    } else if (!wasPausedRef.current) {
      setSnapshot(events);
    }
    wasPausedRef.current = paused;
  }, [events, paused]);

  return paused ? snapshot : events;
}

function EventTypeBadge({ type }: { type: LiveEventType }) {
  return <span className={`event-type-badge badge-${type}`}>{type}</span>;
}

function EventItem({
  event,
  config,
  compact = false,
  selected = false,
  onSelect
}: {
  event: LiveEvent;
  config: AppConfig;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (event: LiveEvent) => void;
}) {
  const text = formatEvent(event);
  return (
    <button
      type="button"
      className={`event-item event-${event.type} ${isHighlighted(event, config) ? 'is-highlighted' : ''} ${
        selected ? 'is-selected' : ''
      }`}
      title={text}
      onClick={onSelect ? () => onSelect(event) : undefined}
    >
      <div className="event-main">
        <EventTypeBadge type={event.type} />
        <span className="event-user">{event.user.nickname || 'anonymous'}</span>
        {!compact ? <span className="event-level">Lv.{event.user.fansLevel ?? 0}</span> : null}
        <span className="event-time">{formatTimestamp(event.timestamp)}</span>
      </div>
      <div className="event-text">{text}</div>
    </button>
  );
}

function EmptyState({ mode }: { mode: DataSourceMode }) {
  return (
    <div className="empty-state">
      <strong>Waiting for events</strong>
      <span>{mode === 'bridge' ? 'Start or connect a Bridge Receiver source.' : 'No live interaction events yet.'}</span>
    </div>
  );
}

function ScrollControls({
  autoScroll,
  paused,
  newCount,
  isNearBottom,
  onAutoScrollChange,
  onPausedChange,
  onJumpToBottom
}: {
  autoScroll: boolean;
  paused: boolean;
  newCount: number;
  isNearBottom: boolean;
  onAutoScrollChange(value: boolean): void;
  onPausedChange(value: boolean): void;
  onJumpToBottom(): void;
}) {
  return (
    <div className="event-toolbar">
      <label className="toolbar-toggle">
        <input type="checkbox" checked={autoScroll} onChange={(event) => onAutoScrollChange(event.currentTarget.checked)} />
        Auto scroll
      </label>
      <label className="toolbar-toggle">
        <input type="checkbox" checked={paused} onChange={(event) => onPausedChange(event.currentTarget.checked)} />
        Pause refresh
      </label>
      <button type="button" className="toolbar-button" onClick={onJumpToBottom}>
        Back to bottom{newCount > 0 && !isNearBottom ? ` (${newCount} new)` : ''}
      </button>
    </div>
  );
}

function ListLayout({
  events,
  config,
  onAutoScrollChange,
  onPausedChange
}: {
  events: LiveEvent[];
  config: AppConfig;
  onAutoScrollChange(value: boolean): void;
  onPausedChange(value: boolean): void;
}) {
  const visibleEvents = useMemo(() => applyEventFilters(events, config).slice(-200), [events, config]);
  const listRef = useRef<HTMLElement | null>(null);
  const previousLengthRef = useRef(visibleEvents.length);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const jumpToBottom = (): void => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    setIsNearBottom(true);
    setNewCount(0);
  };

  const handleScroll = (): void => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setNewCount(0);
    }
  };

  useEffect(() => {
    const previousLength = previousLengthRef.current;
    const nextLength = visibleEvents.length;
    if (nextLength > previousLength) {
      if (config.overlay.autoScroll && isNearBottom) {
        requestAnimationFrame(jumpToBottom);
      } else {
        setNewCount((count) => count + nextLength - previousLength);
      }
    }
    previousLengthRef.current = nextLength;
  }, [visibleEvents.length, config.overlay.autoScroll, isNearBottom]);

  if (visibleEvents.length === 0) return <EmptyState mode={config.data.mode} />;

  return (
    <section className="list-layout">
      <ScrollControls
        autoScroll={config.overlay.autoScroll}
        paused={config.overlay.pauseScroll}
        newCount={newCount}
        isNearBottom={isNearBottom}
        onAutoScrollChange={onAutoScrollChange}
        onPausedChange={onPausedChange}
        onJumpToBottom={jumpToBottom}
      />
      <section ref={listRef} className="event-list" aria-label="Live event history list" onScroll={handleScroll}>
        {visibleEvents.map((event) => (
          <EventItem key={eventKey(event)} event={event} config={config} />
        ))}
      </section>
    </section>
  );
}

function GiftLayout({ events, config }: { events: LiveEvent[]; config: AppConfig }) {
  const priority = events.filter((event) => event.type === 'gift' || event.type === 'follow').slice(-16);
  const latest = priority.length > 0 ? priority : events.slice(-8);
  if (latest.length === 0) return <EmptyState mode={config.data.mode} />;

  return (
    <section className="gift-layout" aria-label="Gift highlight mode">
      <div className="gift-title">High priority interactions</div>
      {latest.map((event) => (
        <EventItem key={eventKey(event)} event={event} config={config} />
      ))}
    </section>
  );
}

function MinimalLayout({ events, config }: { events: LiveEvent[]; config: AppConfig }) {
  const stats = useMemo(() => countEvents(events), [events]);
  const last = events[events.length - 1];
  return (
    <section className="minimal-layout" aria-label="Minimal live mode">
      <div className="stat-line">
        <span>Comments {stats.comment}</span>
        <span>Likes {events.reduce((sum, event) => sum + (event.type === 'like' ? event.payload.likeCount ?? 1 : 0), 0)}</span>
      </div>
      <div className="stat-line">
        <span>Gifts {events.reduce((sum, event) => sum + (event.type === 'gift' ? event.payload.giftCount ?? 1 : 0), 0)}</span>
        <span>Follows {stats.follow}</span>
        <span>Fans {stats.fans_club}</span>
      </div>
      {last ? (
        <div className={`last-event last-${last.type}`}>
          <EventTypeBadge type={last.type} /> {last.user.nickname || 'anonymous'}: {formatEvent(last)}
        </div>
      ) : (
        <EmptyState mode={config.data.mode} />
      )}
    </section>
  );
}

function DebugLayout({
  events,
  allEvents,
  config,
  connectionConnected,
  connectionConnecting,
  eventRate,
  onFilterChange,
  onClearEvents,
  onPausedChange,
  onAutoScrollChange
}: {
  events: LiveEvent[];
  allEvents: LiveEvent[];
  config: AppConfig;
  connectionConnected: boolean;
  connectionConnecting: boolean;
  eventRate: number;
  onFilterChange(value: ShowOnlyFilter): void;
  onClearEvents(): void;
  onPausedChange(value: boolean): void;
  onAutoScrollChange(value: boolean): void;
}) {
  const filteredEvents = useMemo(() => applyEventFilters(events, config).slice(-200).reverse(), [events, config]);
  const counts = useMemo(() => countEvents(allEvents), [allEvents]);
  const latest = allEvents[allEvents.length - 1];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const selectedEvent = filteredEvents.find((event) => eventKey(event) === selectedKey) ?? filteredEvents[0];

  useEffect(() => {
    if (!selectedEvent) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey(eventKey(selectedEvent));
  }, [selectedEvent?.eventId, selectedEvent?.timestamp]);

  const copySelected = (event: LiveEvent | undefined): void => {
    if (!event) return;
    void navigator.clipboard
      ?.writeText(makeEventJsonSummary(event))
      .then(() => {
        setCopyStatus('Copied');
        window.setTimeout(() => setCopyStatus(''), 1200);
      })
      .catch((error: unknown) => {
        setCopyStatus('Copy failed');
        window.electronBridge?.log('warn', 'Failed to copy debug event JSON', String(error));
      });
  };

  return (
    <section className="debug-layout" aria-label="Bridge debug event view">
      <div className="debug-toolbar">
        <div className={connectionConnected ? 'debug-status online' : 'debug-status'}>
          {connectionConnected ? 'Online' : connectionConnecting ? 'Connecting' : 'Offline'}
        </div>
        <span>Rate {eventRate.toFixed(1)}/s</span>
        <span>Cache {allEvents.length}/{config.overlay.maxEvents}</span>
        <span>Latest {latest ? formatTimestamp(latest.timestamp) : '--:--:--'}</span>
        <label>
          Filter
          <select value={config.overlay.filters.showOnly} onChange={(event) => onFilterChange(event.currentTarget.value as ShowOnlyFilter)}>
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar-toggle">
          <input type="checkbox" checked={config.overlay.pauseScroll} onChange={(event) => onPausedChange(event.currentTarget.checked)} />
          Pause refresh
        </label>
        <label className="toolbar-toggle">
          <input type="checkbox" checked={config.overlay.autoScroll} onChange={(event) => onAutoScrollChange(event.currentTarget.checked)} />
          Auto scroll
        </label>
        <button type="button" onClick={onClearEvents}>
          Clear events
        </button>
        <button type="button" onClick={() => copySelected(latest)}>
          Copy latest
        </button>
        <button type="button" onClick={() => copySelected(selectedEvent)}>
          Copy selected
        </button>
        {copyStatus ? <span className="copy-status">{copyStatus}</span> : null}
      </div>

      <div className="debug-counts">
        {EVENT_TYPES.map((type) => (
          <span key={type} className={`count-pill badge-${type}`}>
            {type}: {counts[type]}
          </span>
        ))}
      </div>

      <div className="debug-body">
        <section className="debug-events" aria-label="Recent bridge events">
          {filteredEvents.length === 0 ? <EmptyState mode={config.data.mode} /> : null}
          {filteredEvents.map((event, index) => (
            <EventItem
              key={eventKey(event)}
              event={event}
              config={config}
              selected={eventKey(event) === eventKey(selectedEvent)}
              onSelect={(next) => setSelectedKey(eventKey(next))}
              compact={index > 0}
            />
          ))}
        </section>
        <aside className="debug-details" aria-label="Selected event details">
          {selectedEvent ? (
            <>
              <div className="detail-title">
                <EventTypeBadge type={selectedEvent.type} />
                <strong>{selectedEvent.eventId}</strong>
              </div>
              <dl>
                <dt>Nickname</dt>
                <dd>{selectedEvent.user.nickname || 'anonymous'}</dd>
                <dt>Time</dt>
                <dd>{formatTimestamp(selectedEvent.timestamp)}</dd>
                <dt>Main</dt>
                <dd>{formatEvent(selectedEvent)}</dd>
                <dt>Payload</dt>
                <dd>{JSON.stringify(selectedEvent.payload)}</dd>
                <dt>Raw</dt>
                <dd>{rawSummary(selectedEvent)}</dd>
              </dl>
              <pre>{makeEventJsonSummary(selectedEvent)}</pre>
            </>
          ) : (
            <EmptyState mode={config.data.mode} />
          )}
        </aside>
      </div>
    </section>
  );
}

function LayoutSwitcher({ layout, onChange }: { layout: OverlayLayout; onChange(layout: OverlayLayout): void }) {
  return (
    <div className="segmented">
      {(['list', 'gift', 'minimal', 'debug'] as const).map((item) => (
        <button className={layout === item ? 'active' : ''} key={item} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const config = useAppStore((state) => state.config);
  const setConfig = useAppStore((state) => state.setConfig);
  const overlayState = useAppStore((state) => state.overlayState);
  const setOverlayState = useAppStore((state) => state.setOverlayState);
  const connection = useAppStore((state) => state.connection);
  const events = useAppStore((state) => state.events);
  const clearEvents = useAppStore((state) => state.clearEvents);
  const visibleEvents = useFrozenEvents(events, config.overlay.pauseScroll);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [saveStatus, setSaveStatus] = useState('Config loaded');
  const [recentReceipts, setRecentReceipts] = useState<number[]>([]);
  const lastEventKeyRef = useRef<string>('');
  const lastEventLengthRef = useRef(0);

  useLiveEventSource(config);

  useEffect(() => {
    let disposed = false;
    const bridge = window.electronBridge;
    if (!bridge) return;

    void Promise.all([bridge.getConfig(), bridge.getOverlayState(), bridge.getAppInfo()]).then(([loadedConfig, state, info]) => {
      if (!disposed) {
        setConfig(loadedConfig);
        setOverlayState(state);
        setAppInfo(info);
      }
    });
    const unsubscribeOverlay = bridge.onOverlayStateChanged(setOverlayState);
    const unsubscribeConfig = bridge.onConfigChanged((next) => {
      setConfig(next);
      void bridge.getAppInfo().then(setAppInfo);
    });
    return () => {
      disposed = true;
      unsubscribeOverlay();
      unsubscribeConfig();
    };
  }, [setConfig, setOverlayState]);

  useEffect(() => {
    const last = events[events.length - 1];
    const lastKey = last ? eventKey(last) : '';
    const previousLength = lastEventLengthRef.current;
    const added = events.length > previousLength ? events.length - previousLength : lastKey && lastKey !== lastEventKeyRef.current ? 1 : 0;
    if (added > 0) {
      const now = Date.now();
      setRecentReceipts((items) => [...items, ...Array.from({ length: added }, () => now)].filter((item) => now - item <= 10_000));
    }
    if (events.length === 0) {
      setRecentReceipts([]);
    }
    lastEventLengthRef.current = events.length;
    lastEventKeyRef.current = lastKey;
  }, [events]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setRecentReceipts((items) => items.filter((item) => now - item <= 10_000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const eventRate = recentReceipts.length / 10;
  const activeUrl = config.data.mode === 'bridge' ? config.data.bridgeUrl : config.data.wsUrl;
  const eventCounts = useMemo(() => countEvents(events), [events]);

  const updateConfig = (next: AppConfig): void => {
    setConfig(next);
    setSaveStatus('Saving...');
    void window.electronBridge
      ?.updateConfig(next)
      .then((saved) => {
        setConfig(saved);
        setSaveStatus('Saved');
        return window.electronBridge?.getAppInfo();
      })
      .then((info) => {
        if (info) setAppInfo(info);
      })
      .catch((error: unknown) => {
        setSaveStatus('Save failed');
        window.electronBridge?.log('error', 'Failed to save config', error);
      });
  };

  const setLayout = (layout: OverlayLayout): void => {
    updateConfig({ ...config, overlay: { ...config.overlay, layout } });
    void window.electronBridge?.setLayout(layout);
  };

  const setShowOnly = (showOnly: ShowOnlyFilter): void => {
    updateConfig({
      ...config,
      overlay: {
        ...config.overlay,
        filters: { ...config.overlay.filters, showOnly }
      }
    });
  };

  const setAutoScroll = (autoScroll: boolean): void => {
    updateConfig({ ...config, overlay: { ...config.overlay, autoScroll } });
  };

  const setPausedRefresh = (pauseScroll: boolean): void => {
    updateConfig({ ...config, overlay: { ...config.overlay, pauseScroll } });
  };

  const handleClearEvents = (): void => {
    clearEvents();
  };

  const shellStyle = {
    '--overlay-font-size': `${config.overlay.fontSize}px`,
    '--overlay-scale': String(config.overlay.scale)
  } as CSSProperties;

  return (
    <main className={`overlay-shell ${overlayState.editMode ? 'is-editing' : 'is-passive'}`} style={shellStyle}>
      <header className="overlay-header">
        <div>
          <strong>Douyin Live Overlay</strong>
          <span className={connection.connected ? 'status connected' : 'status'}>
            {modeLabel(config.data.mode)} {connection.connected ? 'online' : connection.connecting ? 'connecting' : 'offline'}
          </span>
        </div>
        <div className="hotkey-hint">Ctrl+Shift+Alt+E edit / pass-through</div>
      </header>

      <section className="status-panel">
        <span>Source: {modeLabel(config.data.mode)}</span>
        <span title={activeUrl}>{config.data.mode === 'mock' ? 'Built-in mock' : activeUrl}</span>
        <span>Rate: {eventRate.toFixed(1)}/s</span>
        <span>Cache: {events.length}/{config.overlay.maxEvents}</span>
        <span>comment {eventCounts.comment}</span>
        <span>like {eventCounts.like}</span>
        <span>gift {eventCounts.gift}</span>
        <span>follow {eventCounts.follow}</span>
        <span>fans {eventCounts.fans_club}</span>
        {connection.lastError ? (
          <span className="error-text" title={connection.lastError}>
            Error: {connection.lastError}
          </span>
        ) : null}
      </section>

      {overlayState.editMode ? (
        <section className="control-panel">
          <div className="control-group full-row">
            <span className="control-title">Layout and display</span>
            <LayoutSwitcher layout={overlayState.layout} onChange={setLayout} />
          </div>

          <label>
            Data source
            <select
              value={config.data.mode}
              onChange={(event) =>
                updateConfig({ ...config, data: { ...config.data, mode: event.currentTarget.value as DataSourceMode } })
              }
            >
              <option value="mock">Mock</option>
              <option value="websocket">WebSocket</option>
              <option value="bridge">Bridge Receiver</option>
              <option value="douyinOfficial">Official Adapter Shell</option>
            </select>
          </label>
          <label>
            WebSocket URL
            <input
              value={config.data.wsUrl}
              onChange={(event) => updateConfig({ ...config, data: { ...config.data, wsUrl: event.currentTarget.value } })}
            />
          </label>
          <label>
            Bridge URL
            <input
              value={config.data.bridgeUrl}
              onChange={(event) => updateConfig({ ...config, data: { ...config.data, bridgeUrl: event.currentTarget.value } })}
            />
          </label>
          <label>
            Reconnect min ms
            <input
              type="number"
              min="250"
              step="250"
              value={config.data.reconnectMinMs}
              onChange={(event) =>
                updateConfig({ ...config, data: { ...config.data, reconnectMinMs: Number(event.currentTarget.value) } })
              }
            />
          </label>
          <label>
            Reconnect max ms
            <input
              type="number"
              min="1000"
              step="1000"
              value={config.data.reconnectMaxMs}
              onChange={(event) =>
                updateConfig({ ...config, data: { ...config.data, reconnectMaxMs: Number(event.currentTarget.value) } })
              }
            />
          </label>
          <label>
            Show only
            <select value={config.overlay.filters.showOnly} onChange={(event) => setShowOnly(event.currentTarget.value as ShowOnlyFilter)}>
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Max events
            <input
              type="number"
              min="100"
              max="2000"
              step="100"
              value={config.overlay.maxEvents}
              onChange={(event) =>
                updateConfig({ ...config, overlay: { ...config.overlay, maxEvents: Number(event.currentTarget.value) } })
              }
            />
          </label>
          <label>
            Opacity
            <input
              type="range"
              min="0.25"
              max="1"
              step="0.01"
              value={config.window.opacity}
              onChange={(event) =>
                updateConfig({ ...config, window: { ...config.window, opacity: Number(event.currentTarget.value) } })
              }
            />
          </label>
          <label>
            Font size
            <input
              type="range"
              min="12"
              max="28"
              step="1"
              value={config.overlay.fontSize}
              onChange={(event) =>
                updateConfig({ ...config, overlay: { ...config.overlay, fontSize: Number(event.currentTarget.value) } })
              }
            />
          </label>
          <label>
            Scale
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={config.overlay.scale}
              onChange={(event) =>
                updateConfig({ ...config, overlay: { ...config.overlay, scale: Number(event.currentTarget.value) } })
              }
            />
          </label>

          <label className="full-row">
            Highlight keywords
            <textarea
              rows={2}
              value={joinKeywords(config.overlay.filters.highlightKeywords)}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  overlay: {
                    ...config.overlay,
                    filters: { ...config.overlay.filters, highlightKeywords: splitKeywords(event.currentTarget.value) }
                  }
                })
              }
            />
          </label>
          <label className="full-row">
            Block keywords
            <textarea
              rows={2}
              value={joinKeywords(config.overlay.filters.blockedKeywords)}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  overlay: {
                    ...config.overlay,
                    filters: { ...config.overlay.filters, blockedKeywords: splitKeywords(event.currentTarget.value) }
                  }
                })
              }
            />
          </label>

          <label className="inline-control">
            <input type="checkbox" checked={config.overlay.pauseScroll} onChange={(event) => setPausedRefresh(event.currentTarget.checked)} />
            Pause refresh
          </label>
          <label className="inline-control">
            <input type="checkbox" checked={config.overlay.autoScroll} onChange={(event) => setAutoScroll(event.currentTarget.checked)} />
            Auto scroll
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={config.overlay.likeAggregation.enabled}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  overlay: {
                    ...config.overlay,
                    likeAggregation: { ...config.overlay.likeAggregation, enabled: event.currentTarget.checked }
                  }
                })
              }
            />
            Aggregate likes
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={config.app.launchAtLogin}
              onChange={(event) =>
                updateConfig({ ...config, app: { ...config.app, launchAtLogin: event.currentTarget.checked } })
              }
            />
            Launch at login
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={config.app.closeToTray}
              onChange={(event) =>
                updateConfig({ ...config, app: { ...config.app, closeToTray: event.currentTarget.checked } })
              }
            />
            Close to tray
          </label>

          {config.data.mode === 'douyinOfficial' ? (
            <div className="notice full-row">
              Official adapter shell still needs platform credentials and approved callback/backend wiring before direct official data use.
            </div>
          ) : null}

          <div className="button-row">
            <button onClick={() => void window.electronBridge?.resizeBy({ width: 40, height: 40 })}>Bigger</button>
            <button onClick={() => void window.electronBridge?.resizeBy({ width: -40, height: -40 })}>Smaller</button>
            <button onClick={handleClearEvents}>Clear events</button>
            <button onClick={() => void window.electronBridge?.openLogsDir()}>Logs</button>
            <button onClick={() => void window.electronBridge?.exportConfig()}>Export config</button>
            <button onClick={() => void window.electronBridge?.importConfig()}>Import config</button>
            <button onClick={() => void window.electronBridge?.toggleClickThrough()}>Live mode</button>
          </div>

          <div className="meta-panel full-row">
            <span>{saveStatus}</span>
            <span>Config: {appInfo?.configPath ?? 'loading'}</span>
            <span>Logs: {appInfo?.logDir ?? 'loading'}</span>
            {appInfo?.hotkeys.some((hotkey) => !hotkey.ok) ? (
              <span className="error-text">Some hotkeys failed to register. Check for system or game conflicts.</span>
            ) : (
              <span>Hotkeys OK</span>
            )}
          </div>
        </section>
      ) : null}

      <div className="overlay-content">
        {overlayState.layout === 'list' ? (
          <ListLayout events={visibleEvents} config={config} onAutoScrollChange={setAutoScroll} onPausedChange={setPausedRefresh} />
        ) : null}
        {overlayState.layout === 'gift' ? <GiftLayout events={events} config={config} /> : null}
        {overlayState.layout === 'minimal' ? <MinimalLayout events={events} config={config} /> : null}
        {overlayState.layout === 'debug' ? (
          <DebugLayout
            events={visibleEvents}
            allEvents={events}
            config={config}
            connectionConnected={connection.connected}
            connectionConnecting={connection.connecting}
            eventRate={eventRate}
            onFilterChange={setShowOnly}
            onClearEvents={handleClearEvents}
            onPausedChange={setPausedRefresh}
            onAutoScrollChange={setAutoScroll}
          />
        ) : null}
      </div>
    </main>
  );
}
