import { EventPipeline } from './eventPipeline';
import { createAdapter, type LiveEventAdapter, type LiveEventAdapterConfig } from './adapters';
import type { DataSourceMode } from '../shared/config';
import type { ConnectionStatus, LiveEvent } from '../shared/events';

export interface LiveEventClientOptions {
  mode: DataSourceMode;
  wsUrl: string;
  bridgeUrl: string;
  maxEvents: number;
  reconnectMinMs: number;
  reconnectMaxMs: number;
  likeAggregationEnabled: boolean;
  likeAggregateWindowMs: number;
}

export interface LiveEventClientCallbacks {
  onEvents(events: LiveEvent[]): void;
  onStatus(status: ConnectionStatus): void;
  onError(error: Error): void;
}

export class LiveEventClient {
  private pipeline: EventPipeline;
  private readonly callbacks: LiveEventClientCallbacks;
  private options: LiveEventClientOptions;
  private adapter: LiveEventAdapter | null = null;
  private stopped = true;

  constructor(options: LiveEventClientOptions, callbacks: LiveEventClientCallbacks) {
    this.options = options;
    this.callbacks = callbacks;
    this.pipeline = new EventPipeline({
      maxEvents: options.maxEvents,
      likeAggregationEnabled: options.likeAggregationEnabled,
      likeAggregateWindowMs: options.likeAggregateWindowMs
    });
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
      options.bridgeUrl !== this.options.bridgeUrl ||
      options.mode !== this.options.mode ||
      options.maxEvents !== this.options.maxEvents ||
      options.likeAggregationEnabled !== this.options.likeAggregationEnabled ||
      options.likeAggregateWindowMs !== this.options.likeAggregateWindowMs;
    this.options = options;
    this.pipeline = this.createPipeline(options);
    if (changed && !this.stopped) {
      this.stop();
      this.start();
    }
  }

  private createPipeline(options: LiveEventClientOptions): EventPipeline {
    return new EventPipeline({
      maxEvents: options.maxEvents,
      likeAggregationEnabled: options.likeAggregationEnabled,
      likeAggregateWindowMs: options.likeAggregateWindowMs
    });
  }

  private emitNormalized(input: unknown): void {
    const emitted = this.pipeline.ingest(input);
    if (emitted.length > 0) {
      this.callbacks.onEvents(emitted);
    }
  }

  private createAdapterConfig(): LiveEventAdapterConfig {
    if (this.options.mode === 'mock') {
      return {
        kind: 'mock'
      };
    }
    if (this.options.mode === 'bridge') {
      return {
        kind: 'bridge',
        wsUrl: this.options.bridgeUrl,
        reconnectMinMs: this.options.reconnectMinMs,
        reconnectMaxMs: this.options.reconnectMaxMs
      };
    }
    if (this.options.mode === 'douyinOfficial') {
      return {
        kind: 'douyinOfficial'
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
