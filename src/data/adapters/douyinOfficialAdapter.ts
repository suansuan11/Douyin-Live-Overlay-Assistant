import type { LiveEvent, LiveEventType } from '../../shared/events';
import type {
  DouyinOfficialAdapterConfig,
  DouyinOfficialSupportedEventType,
  LiveEventAdapter,
  LiveEventAdapterCallbacks
} from './types';

type DouyinOfficialCallbackEventType = DouyinOfficialSupportedEventType | 'unknown';

export interface DouyinOfficialCallbackOperator {
  openId: string;
  nickname: string;
  avatarUrl?: string;
  fansLevel?: number;
}

export interface DouyinOfficialCallbackData {
  content?: string;
  giftName?: string;
  giftCount?: number;
  likeCount?: number;
}

export interface DouyinOfficialCallbackEvent {
  eventId: string;
  eventType: DouyinOfficialCallbackEventType;
  timestamp: number;
  operator: DouyinOfficialCallbackOperator;
  data: DouyinOfficialCallbackData;
  raw?: unknown;
}

const EVENT_TYPE_MAP: Record<DouyinOfficialSupportedEventType, LiveEventType> = {
  comment: 'comment',
  gift: 'gift',
  like: 'like',
  enter: 'enter',
  follow: 'follow'
};

export function mapDouyinOfficialCallbackToLiveEvent(callback: DouyinOfficialCallbackEvent): LiveEvent | null {
  if (!isSupportedOfficialEventType(callback.eventType)) {
    return null;
  }

  const liveEvent: LiveEvent = {
    eventId: callback.eventId,
    type: EVENT_TYPE_MAP[callback.eventType],
    timestamp: callback.timestamp,
    user: {
      id: callback.operator.openId,
      nickname: callback.operator.nickname
    },
    payload: {},
    raw: callback.raw
  };

  if (callback.operator.avatarUrl !== undefined) {
    liveEvent.user.avatar = callback.operator.avatarUrl;
  }
  if (callback.operator.fansLevel !== undefined) {
    liveEvent.user.fansLevel = callback.operator.fansLevel;
  }
  if (callback.data.content !== undefined) {
    liveEvent.payload.text = callback.data.content;
  }
  if (callback.data.giftName !== undefined) {
    liveEvent.payload.giftName = callback.data.giftName;
  }
  if (callback.data.giftCount !== undefined) {
    liveEvent.payload.giftCount = callback.data.giftCount;
  }
  if (callback.data.likeCount !== undefined) {
    liveEvent.payload.likeCount = callback.data.likeCount;
  }

  return liveEvent;
}

export class DouyinOfficialAdapter implements LiveEventAdapter {
  readonly name = 'douyinOfficial';

  constructor(
    private readonly config: DouyinOfficialAdapterConfig,
    private readonly callbacks: LiveEventAdapterCallbacks
  ) {}

  start(): void {
    this.callbacks.onStatus({
      connected: false,
      connecting: false,
      retryAttempt: 0,
      lastError: 'douyinOfficial adapter only exposes callback mapping in this project. Add official SDK/webhook handling after obtaining platform credentials.'
    });
  }

  stop(): void {
    return;
  }

  handleCallback(callback: DouyinOfficialCallbackEvent): LiveEvent | null {
    if (this.config.enabledEventTypes && !this.config.enabledEventTypes.includes(callback.eventType as DouyinOfficialSupportedEventType)) {
      return null;
    }

    const event = mapDouyinOfficialCallbackToLiveEvent(callback);
    if (event) {
      this.callbacks.onEvents([event]);
    }
    return event;
  }
}

function isSupportedOfficialEventType(value: DouyinOfficialCallbackEventType): value is DouyinOfficialSupportedEventType {
  return value in EVENT_TYPE_MAP;
}
