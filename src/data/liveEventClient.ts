import { EventPipeline } from './eventPipeline';
import { createMockEvent } from './mockEvents';
import type { ConnectionStatus, LiveEvent } from '../shared/events';

export interface LiveEventClientOptions {
  wsUrl: string;
  mockMode: boolean;
  maxEvents: number;
  reconnectMinMs: number;
  reconnectMaxMs: number;
}

export interface LiveEventClientCallbacks {
  onEvents(events: LiveEvent[]): void;
  onStatus(status: ConnectionStatus): void;
  onError(error: Error): void;
}

export class LiveEventClient {
  private readonly pipeline: EventPipeline;
  private readonly callbacks: LiveEventClientCallbacks;
  private options: LiveEventClientOptions;
  private socket: WebSocket | null = null;
  private stopped = true;
  private retryAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: LiveEventClientOptions, callbacks: LiveEventClientCallbacks) {
    this.options = options;
    this.callbacks = callbacks;
    this.pipeline = new EventPipeline({ maxEvents: options.maxEvents });
  }

  start(): void {
    this.stopped = false;
    if (this.options.mockMode) {
      this.startMock();
      return;
    }
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  updateOptions(options: LiveEventClientOptions): void {
    const changed =
      options.wsUrl !== this.options.wsUrl ||
      options.mockMode !== this.options.mockMode ||
      options.maxEvents !== this.options.maxEvents;
    this.options = options;
    if (changed && !this.stopped) {
      this.stop();
      this.start();
    }
  }

  private connect(): void {
    this.callbacks.onStatus({
      connected: false,
      connecting: true,
      retryAttempt: this.retryAttempt
    });

    try {
      this.socket = new WebSocket(this.options.wsUrl);
    } catch (error) {
      this.handleError(error);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener('open', () => {
      this.retryAttempt = 0;
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
      this.handleError(new Error(`WebSocket error: ${this.options.wsUrl}`));
    });
  }

  private startMock(): void {
    this.callbacks.onStatus({
      connected: true,
      connecting: false,
      retryAttempt: 0
    });
    this.mockTimer = setInterval(() => {
      const count = Math.random() > 0.82 ? 3 : 1;
      for (let index = 0; index < count; index += 1) {
        this.emitNormalized(createMockEvent());
      }
    }, 320);
  }

  private handleMessage(data: unknown): void {
    const text = typeof data === 'string' ? data : String(data);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => this.emitNormalized(item));
        return;
      }
      this.emitNormalized(parsed);
    } catch (error) {
      this.handleError(error);
    }
  }

  private emitNormalized(input: unknown): void {
    const emitted = this.pipeline.ingest(input);
    if (emitted.length > 0) {
      this.callbacks.onEvents(emitted);
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }
    this.retryAttempt += 1;
    const delay = Math.min(
      this.options.reconnectMaxMs,
      this.options.reconnectMinMs * 2 ** Math.max(0, this.retryAttempt - 1)
    );
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
