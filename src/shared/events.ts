export type LiveEventType = 'comment' | 'gift' | 'like' | 'enter' | 'follow' | 'system';

export interface LiveEventUser {
  id: string;
  nickname: string;
  avatar?: string;
  fansLevel?: number;
}

export interface LiveEventPayload {
  text?: string;
  giftName?: string;
  giftCount?: number;
  likeCount?: number;
}

export interface LiveEvent {
  eventId: string;
  type: LiveEventType;
  timestamp: number;
  user: LiveEventUser;
  payload: LiveEventPayload;
  raw?: unknown;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  lastError?: string;
  retryAttempt: number;
}

export const LIVE_EVENT_TYPES: readonly LiveEventType[] = [
  'comment',
  'gift',
  'like',
  'enter',
  'follow',
  'system'
];

export function isLiveEventType(value: unknown): value is LiveEventType {
  return typeof value === 'string' && LIVE_EVENT_TYPES.includes(value as LiveEventType);
}
