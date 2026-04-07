import { useEffect, useMemo, useState } from 'react';
import { useLiveEventSource } from './hooks/useLiveEventSource';
import { useAppStore } from './store';
import type { AppConfig, DataSourceMode, OverlayLayout, ShowOnlyFilter } from '../shared/config';
import type { LiveEvent } from '../shared/events';
import type { AppInfo } from '../shared/ipc';

function formatEvent(event: LiveEvent): string {
  if (event.type === 'comment') return event.payload.text ?? '';
  if (event.type === 'gift') return `送出 ${event.payload.giftName ?? '礼物'} x${event.payload.giftCount ?? 1}`;
  if (event.type === 'like') return `点赞 x${event.payload.likeCount ?? 1}`;
  if (event.type === 'enter') return event.payload.text ?? '进入直播间';
  if (event.type === 'follow') return event.payload.text ?? '关注了主播';
  if (event.type === 'fans_club') return `粉丝团 Lv.${event.payload.fansClubLevel ?? 0}`;
  return event.payload.text ?? '系统事件';
}

function modeLabel(mode: DataSourceMode): string {
  if (mode === 'mock') return 'Mock';
  if (mode === 'websocket') return 'WebSocket';
  if (mode === 'bridge') return 'Bridge Receiver';
  return 'Official Adapter Shell';
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

function EventItem({ event, config, compact = false }: { event: LiveEvent; config: AppConfig; compact?: boolean }) {
  const text = formatEvent(event);
  return (
    <div className={`event-item event-${event.type} ${isHighlighted(event, config) ? 'is-highlighted' : ''}`} title={text}>
      <div className="event-main">
        <span className="event-type">{event.type}</span>
        <span className="event-user">{event.user.nickname}</span>
        {!compact ? <span className="event-level">Lv.{event.user.fansLevel ?? 0}</span> : null}
      </div>
      <div className="event-text">{text}</div>
    </div>
  );
}

function EmptyState({ mode }: { mode: DataSourceMode }) {
  return (
    <div className="empty-state">
      <strong>等待事件</strong>
      <span>{mode === 'bridge' ? '启动 bridge server 或连接你的外部数据源。' : '当前没有可显示的互动事件。'}</span>
    </div>
  );
}

function ListLayout({ events, config }: { events: LiveEvent[]; config: AppConfig }) {
  if (events.length === 0) return <EmptyState mode={config.data.mode} />;
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
  if (latest.length === 0) return <EmptyState mode={config.data.mode} />;

  return (
    <section className="gift-layout" aria-label="礼物高亮模式">
      <div className="gift-title">高优先级互动</div>
      {latest.map((event) => (
        <EventItem key={`${event.eventId}-${event.timestamp}`} event={event} config={config} />
      ))}
    </section>
  );
}

function MinimalLayout({ events, config }: { events: LiveEvent[]; config: AppConfig }) {
  const stats = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        if (event.type === 'comment') acc.comments += 1;
        if (event.type === 'gift') acc.gifts += event.payload.giftCount ?? 1;
        if (event.type === 'like') acc.likes += event.payload.likeCount ?? 1;
        if (event.type === 'follow') acc.follows += 1;
        if (event.type === 'fans_club') acc.fansClub += 1;
        if (event.type === 'system') acc.system += 1;
        return acc;
      },
      { comments: 0, gifts: 0, likes: 0, follows: 0, fansClub: 0, system: 0 }
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
        <span>粉丝团 {stats.fansClub}</span>
      </div>
      {last ? <div className="last-event">{last.user.nickname}: {formatEvent(last)}</div> : <EmptyState mode={config.data.mode} />}
    </section>
  );
}

function LayoutSwitcher({ layout, onChange }: { layout: OverlayLayout; onChange(layout: OverlayLayout): void }) {
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
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [saveStatus, setSaveStatus] = useState('配置已加载');

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

  const eventRate = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => now - event.timestamp <= 10_000).length / 10;
  }, [events]);

  const activeUrl = config.data.mode === 'bridge' ? config.data.bridgeUrl : config.data.wsUrl;

  const updateConfig = (next: AppConfig): void => {
    setConfig(next);
    setSaveStatus('保存中...');
    void window.electronBridge
      ?.updateConfig(next)
      .then((saved) => {
        setConfig(saved);
        setSaveStatus('已保存');
        return window.electronBridge?.getAppInfo();
      })
      .then((info) => {
        if (info) setAppInfo(info);
      })
      .catch((error: unknown) => {
        setSaveStatus('保存失败');
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
            {modeLabel(config.data.mode)} {connection.connected ? '在线' : connection.connecting ? '重连中' : '离线'}
          </span>
        </div>
        <div className="hotkey-hint">Ctrl+Alt+L 编辑 / 穿透</div>
      </header>

      <section className="status-panel">
        <span>源: {modeLabel(config.data.mode)}</span>
        <span title={activeUrl}>{config.data.mode === 'mock' ? '内置 mock' : activeUrl}</span>
        <span>速率: {eventRate.toFixed(1)}/s</span>
        <span>缓存: {events.length}/{config.overlay.maxEvents}</span>
        {connection.lastError ? <span className="error-text" title={connection.lastError}>错误: {connection.lastError}</span> : null}
      </section>

      {overlayState.editMode ? (
        <section className="control-panel">
          <div className="control-group full-row">
            <span className="control-title">布局与显示</span>
            <LayoutSwitcher layout={overlayState.layout} onChange={setLayout} />
          </div>

          <label>
            数据源
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
            WebSocket 地址
            <input
              value={config.data.wsUrl}
              onChange={(event) => updateConfig({ ...config, data: { ...config.data, wsUrl: event.currentTarget.value } })}
            />
          </label>
          <label>
            Bridge 地址
            <input
              value={config.data.bridgeUrl}
              onChange={(event) => updateConfig({ ...config, data: { ...config.data, bridgeUrl: event.currentTarget.value } })}
            />
          </label>
          <label>
            重连最小 ms
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
            最大退避 ms
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
            展示
            <select value={config.overlay.filters.showOnly} onChange={(event) => setShowOnly(event.currentTarget.value as ShowOnlyFilter)}>
              <option value="all">全部</option>
              <option value="comments">仅评论</option>
              <option value="gifts">仅礼物</option>
              <option value="system">仅系统</option>
            </select>
          </label>
          <label>
            消息上限
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
                updateConfig({ ...config, overlay: { ...config.overlay, fontSize: Number(event.currentTarget.value) } })
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
                updateConfig({ ...config, overlay: { ...config.overlay, scale: Number(event.currentTarget.value) } })
              }
            />
          </label>

          <label className="full-row">
            高亮关键词
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
            屏蔽关键词
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
            <input
              type="checkbox"
              checked={config.overlay.pauseScroll}
              onChange={(event) =>
                updateConfig({ ...config, overlay: { ...config.overlay, pauseScroll: event.currentTarget.checked } })
              }
            />
            暂停滚动
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
            合并点赞
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={config.app.launchAtLogin}
              onChange={(event) =>
                updateConfig({ ...config, app: { ...config.app, launchAtLogin: event.currentTarget.checked } })
              }
            />
            开机自启
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={config.app.closeToTray}
              onChange={(event) =>
                updateConfig({ ...config, app: { ...config.app, closeToTray: event.currentTarget.checked } })
              }
            />
            关闭到托盘
          </label>

          {config.data.mode === 'douyinOfficial' ? (
            <div className="notice full-row">官方 adapter 只提供类型和映射壳。需要平台凭证、官方回调验签和后端桥接后才能接入真实官方数据。</div>
          ) : null}

          <div className="button-row">
            <button onClick={() => void window.electronBridge?.resizeBy({ width: 40, height: 40 })}>放大窗口</button>
            <button onClick={() => void window.electronBridge?.resizeBy({ width: -40, height: -40 })}>缩小窗口</button>
            <button onClick={clearEvents}>清空事件</button>
            <button onClick={() => void window.electronBridge?.openLogsDir()}>日志目录</button>
            <button onClick={() => void window.electronBridge?.exportConfig()}>导出配置</button>
            <button onClick={() => void window.electronBridge?.importConfig()}>导入配置</button>
            <button onClick={() => void window.electronBridge?.toggleClickThrough()}>进入直播模式</button>
          </div>

          <div className="meta-panel full-row">
            <span>{saveStatus}</span>
            <span>配置: {appInfo?.configPath ?? '加载中'}</span>
            <span>日志: {appInfo?.logDir ?? '加载中'}</span>
            {appInfo?.hotkeys.some((hotkey) => !hotkey.ok) ? (
              <span className="error-text">存在热键注册失败，请检查是否被系统或游戏占用。</span>
            ) : (
              <span>热键正常</span>
            )}
          </div>
        </section>
      ) : null}

      <div className="overlay-content">
        {overlayState.layout === 'list' ? <ListLayout events={events} config={config} /> : null}
        {overlayState.layout === 'gift' ? <GiftLayout events={events} config={config} /> : null}
        {overlayState.layout === 'minimal' ? <MinimalLayout events={events} config={config} /> : null}
      </div>
    </main>
  );
}
