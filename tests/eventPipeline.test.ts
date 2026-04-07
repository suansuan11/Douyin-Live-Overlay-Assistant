import { describe, expect, it } from 'vitest';
import { EventPipeline } from '../src/data/eventPipeline';
import { normalizeLiveEvent, parseLiveEventJson } from '../src/data/eventSchema';
import type { LiveEvent } from '../src/shared/events';

function makeEvent(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    eventId: overrides.eventId ?? crypto.randomUUID(),
    type: overrides.type ?? 'comment',
    timestamp: overrides.timestamp ?? Date.now(),
    user: overrides.user ?? {
      id: 'user-1',
      nickname: '测试用户'
    },
    payload: overrides.payload ?? {
      text: '测试弹幕'
    },
    raw: overrides.raw
  };
}

describe('live event schema', () => {
  it('accepts valid live event JSON', () => {
    const event = makeEvent({ eventId: 'evt-1', timestamp: 1710000000000 });

    expect(parseLiveEventJson(JSON.stringify(event))).toEqual(event);
  });

  it('rejects invalid event shape', () => {
    expect(normalizeLiveEvent({ type: 'comment' })).toBeNull();
    expect(normalizeLiveEvent({ ...makeEvent(), type: 'unknown' })).toBeNull();
    expect(parseLiveEventJson('{bad-json')).toBeNull();
  });
});

describe('event pipeline', () => {
  it('deduplicates events by eventId', () => {
    const pipeline = new EventPipeline();
    const event = makeEvent({ eventId: 'dup-1' });

    expect(pipeline.ingest(event)).toHaveLength(1);
    expect(pipeline.ingest({ ...event, payload: { text: '重复' } })).toHaveLength(0);
    expect(pipeline.snapshot()).toHaveLength(1);
  });

  it('merges consecutive like events from the same user inside aggregate window', () => {
    const pipeline = new EventPipeline({ likeAggregateWindowMs: 1000 });
    const first = makeEvent({
      eventId: 'like-1',
      type: 'like',
      timestamp: 1000,
      payload: { likeCount: 2 }
    });
    const second = makeEvent({
      eventId: 'like-2',
      type: 'like',
      timestamp: 1500,
      payload: { likeCount: 3 }
    });

    pipeline.ingest(first);
    const emitted = pipeline.ingest(second);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.payload.likeCount).toBe(5);
    expect(pipeline.snapshot()).toHaveLength(1);
  });

  it('can disable like aggregation', () => {
    const pipeline = new EventPipeline({ likeAggregationEnabled: false });

    pipeline.ingest(
      makeEvent({
        eventId: 'like-no-merge-1',
        type: 'like',
        timestamp: 1000,
        payload: { likeCount: 2 }
      })
    );
    pipeline.ingest(
      makeEvent({
        eventId: 'like-no-merge-2',
        type: 'like',
        timestamp: 1100,
        payload: { likeCount: 3 }
      })
    );

    expect(pipeline.snapshot().map((event) => event.payload.likeCount)).toEqual([2, 3]);
  });

  it('keeps only maxEvents recent events', () => {
    const pipeline = new EventPipeline({ maxEvents: 3 });
    for (let index = 0; index < 5; index += 1) {
      pipeline.ingest(
        makeEvent({
          eventId: `evt-${index}`,
          timestamp: 1000 + index,
          payload: { text: `消息 ${index}` }
        })
      );
    }

    expect(pipeline.snapshot().map((event) => event.eventId)).toEqual(['evt-2', 'evt-3', 'evt-4']);
  });

  it('stays bounded under high-frequency input', () => {
    const pipeline = new EventPipeline({ maxEvents: 500 });

    for (let index = 0; index < 5000; index += 1) {
      pipeline.ingest(
        makeEvent({
          eventId: `burst-${index}`,
          timestamp: 1710000000000 + index,
          user: { id: `user-${index % 50}`, nickname: `用户${index % 50}` },
          payload: { text: `高频消息 ${index}` }
        })
      );
    }

    const snapshot = pipeline.snapshot();
    expect(snapshot).toHaveLength(500);
    expect(snapshot[0]?.eventId).toBe('burst-4500');
    expect(snapshot.at(-1)?.eventId).toBe('burst-4999');
  });
});
