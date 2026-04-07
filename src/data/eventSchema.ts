import { type LiveEvent, isLiveEventType } from '../shared/events';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: UnknownRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizePayload(value: unknown): LiveEvent['payload'] {
  if (!isRecord(value)) {
    return {};
  }

  const payload: LiveEvent['payload'] = {};
  const text = readString(value, 'text');
  const giftName = readString(value, 'giftName');
  const giftCount = readNumber(value, 'giftCount');
  const likeCount = readNumber(value, 'likeCount');
  const totalLikeCount = readNumber(value, 'totalLikeCount');
  const fansClubLevel = readNumber(value, 'fansClubLevel');
  const followAction = readString(value, 'followAction');

  if (text !== undefined) payload.text = text;
  if (giftName !== undefined) payload.giftName = giftName;
  if (giftCount !== undefined) payload.giftCount = giftCount;
  if (likeCount !== undefined) payload.likeCount = likeCount;
  if (totalLikeCount !== undefined) payload.totalLikeCount = totalLikeCount;
  if (fansClubLevel !== undefined) payload.fansClubLevel = fansClubLevel;
  if (followAction === 'follow' || followAction === 'unfollow') payload.followAction = followAction;

  return payload;
}

export function normalizeLiveEvent(input: unknown): LiveEvent | null {
  if (!isRecord(input)) {
    return null;
  }

  const eventId = readString(input, 'eventId');
  const type = input.type;
  const timestamp = readNumber(input, 'timestamp');
  const user = input.user;

  if (!eventId || !isLiveEventType(type) || timestamp === undefined || !isRecord(user)) {
    return null;
  }

  const userId = readString(user, 'id');
  const nickname = readString(user, 'nickname');
  if (!userId || !nickname) {
    return null;
  }

  const normalized: LiveEvent = {
    eventId,
    type,
    timestamp,
    user: {
      id: userId,
      nickname
    },
    payload: normalizePayload(input.payload),
    raw: input.raw
  };

  const avatar = readString(user, 'avatar');
  const fansLevel = readNumber(user, 'fansLevel');
  if (avatar !== undefined) normalized.user.avatar = avatar;
  if (fansLevel !== undefined) normalized.user.fansLevel = fansLevel;

  return normalized;
}

export function parseLiveEventJson(json: string): LiveEvent | null {
  try {
    return normalizeLiveEvent(JSON.parse(json));
  } catch {
    return null;
  }
}
