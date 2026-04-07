import { EventPipeline } from './eventPipeline';
import { createAdapter, type LiveEventAdapter, type LiveEventAdapterConfig } from './adapters';
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
  private adapter: LiveEventAdapter | null = null;
  private stopped = true;

  constructor(options: LiveEventClientOptions, callbacks: LiveEventClientCallbacks) {
    this.options = options;
    this.callbacks = callbacks;
    this.pipeline = new EventPipeline({ maxEvents: options.maxEvents });
  }

  start(): void {
    this.stopped = false;
    this.adapter = createAdapter(this.createAdapterConfig(), {
      onEvents: (events) => events.forEach((event) => this.emitNormalized(event)),
      onStatus: this.callbacks.onStatus,
      onError: this.callbacks.onError
    });
    this.adapter.start();
  }

  stop(): void {
    this.stopped = true;
    this.adapter?.stop();
    this.adapter = null;
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

  private emitNormalized(input: unknown): void {
    const emitted = this.pipeline.ingest(input);
    if (emitted.length > 0) {
      this.callbacks.onEvents(emitted);
    }
  }

  private createAdapterConfig(): LiveEventAdapterConfig {
    if (this.options.mockMode) {
      return {
        kind: 'mock'
      };
    }
    return {
      kind: 'websocket',
      wsUrl: this.options.wsUrl,
      reconnectMinMs: this.options.reconnectMinMs,
      reconnectMaxMs: this.options.reconnectMaxMs
    };
  }
}
