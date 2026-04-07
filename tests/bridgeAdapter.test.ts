import { describe, expect, it } from 'vitest';
import { normalizeBridgeMessage } from '../src/data/adapters/bridgeAdapter';
import type { LiveEvent } from '../src/shared/events';

function makeEvent(eventId: string): LiveEvent {
  return {
    eventId,
    type: 'comment',
    timestamp: 1710000000000,
    user: {
      id: 'user-1',
      nickname: '桥接用户'
    },
    payload: {
      text: '桥接弹幕'
    }
  };
}

describe('bridge adapter', () => {
  it('accepts bridge envelopes with live events', () => {
    const event = makeEvent('bridge-1');
    expect(
      normalizeBridgeMessage({
        protocol: 'douyin-live-overlay-bridge',
        version: 1,
        events: [event]
      })
    ).toEqual([event]);
  });

  it('accepts raw live event payloads for simple integrations', () => {
    const event = makeEvent('bridge-2');
    expect(normalizeBridgeMessage(event)).toEqual([event]);
  });

  it('rejects invalid bridge messages', () => {
    expect(normalizeBridgeMessage({ protocol: 'wrong', events: [{ bad: true }] })).toEqual([]);
    expect(normalizeBridgeMessage({ protocol: 'douyin-live-overlay-bridge', version: 1, events: [{ bad: true }] })).toEqual([]);
  });
});
