export type LiveEventType = 'comment' | 'gift' | 'like' | 'enter' | 'follow' | 'fans_club' | 'system';

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
  totalLikeCount?: number;
  fansClubLevel?: number;
  followAction?: 'follow' | 'unfollow';
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
  'fans_club',
  'system'
];

export function isLiveEventType(value: unknown): value is LiveEventType {
  return typeof value === 'string' && LIVE_EVENT_TYPES.includes(value as LiveEventType);
}
