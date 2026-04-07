import { useEffect, useMemo } from 'react';
import { useLiveEventSource } from './hooks/useLiveEventSource';
import { useAppStore } from './store';
import type { AppConfig, OverlayLayout, ShowOnlyFilter } from '../shared/config';
import type { LiveEvent } from '../shared/events';

function formatEvent(event: LiveEvent): string {
  if (event.type === 'comment') return event.payload.text ?? '';
  if (event.type === 'gift') return `送出 ${event.payload.giftName ?? '礼物'} x${event.payload.giftCount ?? 1}`;
  if (event.type === 'like') return `点赞 x${event.payload.likeCount ?? 1}`;
  if (event.type === 'enter') return event.payload.text ?? '进入直播间';
  if (event.type === 'follow') return event.payload.text ?? '关注了主播';
  return event.payload.text ?? '系统事件';
}

function isHighlighted(event: LiveEvent, config: AppConfig): boolean {
  if (event.type === 'gift' || event.type === 'follow') return true;
  const text = `${event.user.nickname} ${event.payload.text ?? ''} ${event.payload.giftName ?? ''}`;
  return config.overlay.filters.highlightKeywords.some((keyword) => keyword && text.includes(keyword));
}

function EventItem({ event, config, compact = false }: { event: LiveEvent; config: AppConfig; compact?: boolean }) {
  return (
    <div className={`event-item event-${event.type} ${isHighlighted(event, config) ? 'is-highlighted' : ''}`}>
      <div className="event-main">
        <span className="event-type">{event.type}</span>
        <span className="event-user">{event.user.nickname}</span>
        {!compact ? <span className="event-level">Lv.{event.user.fansLevel ?? 0}</span> : null}
      </div>
      <div className="event-text">{formatEvent(event)}</div>
    </div>
  );
}

function ListLayout({ events, config }: { events: LiveEvent[]; config: AppConfig }) {
  return (
    <section className="event-list" aria-label="弹幕列表模式">
      {events.slice(-80).map((event) => (
        <EventItem key={`${event.eventId}-${event.timestamp}`} event={event} config={config} />
      ))}
    </section>
  );
}

function GiftLayout({ events, config }: { events: LiveEvent[]; config: AppConfig }) {
  const priority = events.filter((event) => event.type === 'gift' || event.type === 'follow').slice(-16);
  const latest = priority.length > 0 ? priority : events.slice(-8);

  return (
    <section className="gift-layout" aria-label="礼物高亮模式">
      <div className="gift-title">高优先级互动</div>
      {latest.map((event) => (
        <EventItem key={`${event.eventId}-${event.timestamp}`} event={event} config={config} />
      ))}
    </section>
  );
}

function MinimalLayout({ events }: { events: LiveEvent[] }) {
  const stats = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        if (event.type === 'comment') acc.comments += 1;
        if (event.type === 'gift') acc.gifts += event.payload.giftCount ?? 1;
        if (event.type === 'like') acc.likes += event.payload.likeCount ?? 1;
        if (event.type === 'follow') acc.follows += 1;
        return acc;
      },
      { comments: 0, gifts: 0, likes: 0, follows: 0 }
    );
  }, [events]);

  const last = events[events.length - 1];
  return (
    <section className="minimal-layout" aria-label="极简角落模式">
      <div className="stat-line">
        <span>弹幕 {stats.comments}</span>
        <span>点赞 {stats.likes}</span>
      </div>
      <div className="stat-line">
        <span>礼物 {stats.gifts}</span>
        <span>关注 {stats.follows}</span>
      </div>
      {last ? <div className="last-event">{last.user.nickname}: {formatEvent(last)}</div> : null}
    </section>
  );
}

function LayoutSwitcher({
  layout,
  onChange
}: {
  layout: OverlayLayout;
  onChange(layout: OverlayLayout): void;
}) {
  return (
    <div className="segmented">
      {(['list', 'gift', 'minimal'] as const).map((item) => (
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

  useLiveEventSource(config);

  useEffect(() => {
    let disposed = false;
    const bridge = window.electronBridge;
    if (!bridge) return;

    void Promise.all([bridge.getConfig(), bridge.getOverlayState()]).then(([loadedConfig, state]) => {
      if (!disposed) {
        setConfig(loadedConfig);
        setOverlayState(state);
      }
    });
    const unsubscribe = bridge.onOverlayStateChanged(setOverlayState);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [setConfig, setOverlayState]);

  const updateConfig = (next: AppConfig): void => {
    setConfig(next);
    void window.electronBridge?.updateConfig(next).catch((error: unknown) => {
      window.electronBridge?.log('error', 'Failed to save config', error);
    });
  };

  const setLayout = (layout: OverlayLayout): void => {
    updateConfig({
      ...config,
      overlay: {
        ...config.overlay,
        layout
      }
    });
    void window.electronBridge?.setLayout(layout);
  };

  const setShowOnly = (showOnly: ShowOnlyFilter): void => {
    updateConfig({
      ...config,
      overlay: {
        ...config.overlay,
        filters: {
          ...config.overlay.filters,
          showOnly
        }
      }
    });
  };

  const shellStyle = {
    '--overlay-font-size': `${config.overlay.fontSize}px`,
    '--overlay-scale': String(config.overlay.scale)
  } as React.CSSProperties;

  return (
    <main className={`overlay-shell ${overlayState.editMode ? 'is-editing' : 'is-passive'}`} style={shellStyle}>
      <header className="overlay-header">
        <div>
          <strong>Douyin Live Overlay</strong>
          <span className={connection.connected ? 'status connected' : 'status'}>
            {config.data.mockMode ? 'MOCK' : connection.connected ? 'WS 在线' : connection.connecting ? '重连中' : '离线'}
          </span>
        </div>
        <div className="hotkey-hint">Ctrl+Alt+L 编辑 / 穿透</div>
      </header>

      {overlayState.editMode ? (
        <section className="control-panel">
          <LayoutSwitcher layout={overlayState.layout} onChange={setLayout} />
          <label>
            透明度
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
            字号
            <input
              type="range"
              min="12"
              max="28"
              step="1"
              value={config.overlay.fontSize}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  overlay: { ...config.overlay, fontSize: Number(event.currentTarget.value) }
                })
              }
            />
          </label>
          <label>
            缩放
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={config.overlay.scale}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  overlay: { ...config.overlay, scale: Number(event.currentTarget.value) }
                })
              }
            />
          </label>
          <label>
            展示
            <select value={config.overlay.filters.showOnly} onChange={(event) => setShowOnly(event.currentTarget.value as ShowOnlyFilter)}>
              <option value="all">全部</option>
              <option value="comments">仅评论</option>
              <option value="gifts">仅礼物</option>
            </select>
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={config.data.mockMode}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  data: { ...config.data, mockMode: event.currentTarget.checked }
                })
              }
            />
            Mock 模式
          </label>
          <div className="button-row">
            <button onClick={() => void window.electronBridge?.resizeBy({ width: 40, height: 40 })}>放大窗口</button>
            <button onClick={() => void window.electronBridge?.resizeBy({ width: -40, height: -40 })}>缩小窗口</button>
            <button onClick={clearEvents}>清空</button>
            <button onClick={() => void window.electronBridge?.toggleClickThrough()}>退出编辑</button>
          </div>
        </section>
      ) : null}

      <div className="overlay-content">
        {overlayState.layout === 'list' ? <ListLayout events={events} config={config} /> : null}
        {overlayState.layout === 'gift' ? <GiftLayout events={events} config={config} /> : null}
        {overlayState.layout === 'minimal' ? <MinimalLayout events={events} /> : null}
      </div>
    </main>
  );
}
