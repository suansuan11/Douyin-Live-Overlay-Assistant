import { normalizeLiveEvent } from '../eventSchema';
import type { LiveEvent } from '../../shared/events';
import type { LiveEventAdapter, LiveEventAdapterCallbacks, WebSocketAdapterConfig } from './types';

export interface SocketAdapterConfig {
  wsUrl: string;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
}

export interface WebSocketAdapterRuntimeOptions {
  normalizeMessage?: (input: unknown) => LiveEvent[];
  helloMessage?: unknown;
}

export class WebSocketAdapter implements LiveEventAdapter {
  readonly name: string = 'websocket';
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private retryAttempt = 0;

  constructor(
    private readonly config: SocketAdapterConfig,
    private readonly callbacks: LiveEventAdapterCallbacks,
    private readonly runtimeOptions: WebSocketAdapterRuntimeOptions = {}
  ) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    this.callbacks.onStatus({
      connected: false,
      connecting: true,
      retryAttempt: this.retryAttempt
    });

    try {
      this.socket = new WebSocket(this.config.wsUrl);
    } catch (error) {
      this.handleError(error);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener('open', () => {
      this.retryAttempt = 0;
      if (this.runtimeOptions.helloMessage !== undefined) {
        this.socket?.send(JSON.stringify(this.runtimeOptions.helloMessage));
      }
      this.callbacks.onStatus({
        connected: true,
        connecting: false,
        retryAttempt: 0
      });
    });

    this.socket.addEventListener('message', (message) => {
      this.handleMessage(message.data);
    });

    this.socket.addEventListener('close', () => {
      if (!this.stopped) {
        this.callbacks.onStatus({
          connected: false,
          connecting: false,
          retryAttempt: this.retryAttempt
        });
        this.scheduleReconnect();
      }
    });

    this.socket.addEventListener('error', () => {
      this.handleError(new Error(`WebSocket error: ${this.config.wsUrl}`));
    });
  }

  private handleMessage(data: unknown): void {
    const text = typeof data === 'string' ? data : String(data);
    try {
      const parsed = JSON.parse(text) as unknown;
      const events = this.runtimeOptions.normalizeMessage
        ? this.runtimeOptions.normalizeMessage(parsed)
        : Array.isArray(parsed)
          ? parsed.flatMap((item) => this.normalizeOne(item))
          : this.normalizeOne(parsed);
      if (events.length > 0) {
        this.callbacks.onEvents(events);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private normalizeOne(input: unknown): LiveEvent[] {
    const event = normalizeLiveEvent(input);
    return event ? [event] : [];
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }
    this.retryAttempt += 1;
    const reconnectMinMs = this.config.reconnectMinMs ?? 500;
    const reconnectMaxMs = this.config.reconnectMaxMs ?? 10_000;
    const delay = Math.min(reconnectMaxMs, reconnectMinMs * 2 ** Math.max(0, this.retryAttempt - 1));
    this.callbacks.onStatus({
      connected: false,
      connecting: true,
      retryAttempt: this.retryAttempt
    });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private handleError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.callbacks.onError(normalized);
    this.callbacks.onStatus({
      connected: false,
      connecting: false,
      lastError: normalized.message,
      retryAttempt: this.retryAttempt
    });
  }
}
