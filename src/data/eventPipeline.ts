import { normalizeLiveEvent } from './eventSchema';
import type { LiveEvent } from '../shared/events';

export interface EventPipelineOptions {
  maxEvents: number;
  duplicateTtlMs: number;
  likeAggregateWindowMs: number;
}

const DEFAULT_PIPELINE_OPTIONS: EventPipelineOptions = {
  maxEvents: 500,
  duplicateTtlMs: 60_000,
  likeAggregateWindowMs: 1_200
};

export class EventPipeline {
  private readonly options: EventPipelineOptions;
  private readonly seen = new Map<string, number>();
  private readonly events: LiveEvent[] = [];

  constructor(options: Partial<EventPipelineOptions> = {}) {
    this.options = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
  }

  ingest(input: unknown): LiveEvent[] {
    const event = normalizeLiveEvent(input);
    if (event === null) {
      return [];
    }

    this.pruneSeen(event.timestamp);
    if (this.seen.has(event.eventId)) {
      return [];
    }
    this.seen.set(event.eventId, event.timestamp);

    const mergedLike = this.tryMergeLike(event);
    if (mergedLike) {
      return [mergedLike];
    }

    this.events.push(event);
    this.trim();
    return [event];
  }

  snapshot(): LiveEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.seen.clear();
    this.events.length = 0;
  }

  private tryMergeLike(event: LiveEvent): LiveEvent | null {
    if (event.type !== 'like') {
      return null;
    }

    const previous = this.events[this.events.length - 1];
    if (
      previous?.type !== 'like' ||
      previous.user.id !== event.user.id ||
      event.timestamp - previous.timestamp > this.options.likeAggregateWindowMs
    ) {
      return null;
    }

    const previousCount = previous.payload.likeCount ?? 1;
    const nextCount = event.payload.likeCount ?? 1;
    const merged: LiveEvent = {
      ...previous,
      timestamp: event.timestamp,
      payload: {
        ...previous.payload,
        likeCount: previousCount + nextCount
      },
      raw: event.raw
    };

    this.events[this.events.length - 1] = merged;
    return merged;
  }

  private trim(): void {
    if (this.events.length <= this.options.maxEvents) {
      return;
    }
    this.events.splice(0, this.events.length - this.options.maxEvents);
  }

  private pruneSeen(now: number): void {
    for (const [eventId, timestamp] of this.seen) {
      if (now - timestamp > this.options.duplicateTtlMs) {
        this.seen.delete(eventId);
      }
    }
  }
}
