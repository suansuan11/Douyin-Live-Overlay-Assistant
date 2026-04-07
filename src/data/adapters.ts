import type { ConnectionStatus, LiveEvent } from '../shared/events';

export interface LiveEventAdapterCallbacks {
  onEvents(events: LiveEvent[]): void;
  onStatus(status: ConnectionStatus): void;
  onError(error: Error): void;
}

export interface LiveEventAdapter {
  readonly name: string;
  start(): void;
  stop(): void;
}

export class OfficialDouyinAdapterPlaceholder implements LiveEventAdapter {
  readonly name = 'official-douyin-placeholder';

  constructor(private readonly callbacks: LiveEventAdapterCallbacks) {}

  start(): void {
    this.callbacks.onStatus({
      connected: false,
      connecting: false,
      retryAttempt: 0,
      lastError: '官方直播开放平台 adapter 尚未实现；一期仅使用 mock 和本地 WebSocket。'
    });
  }

  stop(): void {
    return;
  }
}
