import { describe, expect, it } from 'vitest';
import { createBridgeEnvelope, validateLiveEvent } from '../bridge-service/src/schema';

describe('standalone bridge service schema', () => {
  it('validates live event payloads and creates bridge envelopes', () => {
    const event = validateLiveEvent({
      eventId: 'bridge-service-1',
      type: 'gift',
      timestamp: 1710000000000,
      user: {
        id: 'u1',
        nickname: '桥接用户'
      },
      payload: {
        giftName: '小心心',
        giftCount: 2
      }
    });

    expect(event).not.toBeNull();
    expect(createBridgeEnvelope(event ? [event] : [])).toEqual({
      protocol: 'douyin-live-overlay-bridge',
      version: 1,
      events: [event]
    });
  });

  it('rejects invalid payloads', () => {
    expect(validateLiveEvent({ eventId: 'missing-fields' })).toBeNull();
    expect(validateLiveEvent({ eventId: 'bad-type', type: 'unknown' })).toBeNull();
  });
});
