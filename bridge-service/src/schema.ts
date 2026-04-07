export const BRIDGE_PROTOCOL = 'douyin-live-overlay-bridge';
export const BRIDGE_PROTOCOL_VERSION = 1;

export type LiveEventType = 'comment' | 'gift' | 'like' | 'enter' | 'follow' | 'system';

export interface LiveEvent {
  eventId: string;
  type: LiveEventType;
  timestamp: number;
  user: {
    id: string;
    nickname: string;
    avatar?: string;
    fansLevel?: number;
  };
  payload: {
    text?: string;
    giftName?: string;
    giftCount?: number;
    likeCount?: number;
  };
  raw?: unknown;
}

export interface BridgeEnvelope {
  protocol: typeof BRIDGE_PROTOCOL;
  version: typeof BRIDGE_PROTOCOL_VERSION;
  events: LiveEvent[];
}

const EVENT_TYPES: readonly LiveEventType[] = ['comment', 'gift', 'like', 'enter', 'follow', 'system'];

export function validateLiveEvent(input: unknown): LiveEvent | null {
  if (!isRecord(input)) return null;
  if (typeof input.eventId !== 'string') return null;
  if (!EVENT_TYPES.includes(input.type as LiveEventType)) return null;
  if (typeof input.timestamp !== 'number' || !Number.isFinite(input.timestamp)) return null;
  if (!isRecord(input.user)) return null;
  if (typeof input.user.id !== 'string' || typeof input.user.nickname !== 'string') return null;
  if (!isRecord(input.payload)) return null;

  const event: LiveEvent = {
    eventId: input.eventId,
    type: input.type as LiveEventType,
    timestamp: input.timestamp,
    user: {
      id: input.user.id,
      nickname: input.user.nickname
    },
    payload: {},
    raw: input.raw
  };

  if (typeof input.user.avatar === 'string') event.user.avatar = input.user.avatar;
  if (typeof input.user.fansLevel === 'number') event.user.fansLevel = input.user.fansLevel;
  if (typeof input.payload.text === 'string') event.payload.text = input.payload.text;
  if (typeof input.payload.giftName === 'string') event.payload.giftName = input.payload.giftName;
  if (typeof input.payload.giftCount === 'number') event.payload.giftCount = input.payload.giftCount;
  if (typeof input.payload.likeCount === 'number') event.payload.likeCount = input.payload.likeCount;

  return event;
}

export function createBridgeEnvelope(events: readonly LiveEvent[]): BridgeEnvelope {
  return {
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_PROTOCOL_VERSION,
    events: [...events]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
