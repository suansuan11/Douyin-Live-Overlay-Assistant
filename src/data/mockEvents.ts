import type { LiveEvent, LiveEventType } from '../shared/events';

const NICKNAMES = ['小鹿', '夜航员', '橙子', '风起', '阿远', '南瓜', '白桃', 'Leo'];
const COMMENTS = ['这波细节拉满', '主播看左边', '来了来了', '666', '这个 overlay 很清楚', '再打一把'];
const GIFTS = ['小心心', '棒棒糖', '人气票', '玫瑰', '跑车'];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createMockEvent(type: LiveEventType = randomEventType()): LiveEvent {
  const nickname = randomItem(NICKNAMES);
  const user = {
    id: `user-${nickname}`,
    nickname,
    fansLevel: Math.floor(Math.random() * 25)
  };

  const base: LiveEvent = {
    eventId: createId(type),
    type,
    timestamp: Date.now(),
    user,
    payload: {}
  };

  if (type === 'comment') {
    base.payload.text = randomItem(COMMENTS);
  }
  if (type === 'gift') {
    base.payload.giftName = randomItem(GIFTS);
    base.payload.giftCount = Math.ceil(Math.random() * 5);
  }
  if (type === 'like') {
    base.payload.likeCount = Math.ceil(Math.random() * 12);
  }
  if (type === 'enter') {
    base.payload.text = '进入直播间';
  }
  if (type === 'follow') {
    base.payload.text = '关注了主播';
  }
  if (type === 'system') {
    base.payload.text = 'Mock 数据流正常';
  }

  return base;
}

export function randomEventType(): LiveEventType {
  const roll = Math.random();
  if (roll < 0.5) return 'comment';
  if (roll < 0.68) return 'like';
  if (roll < 0.82) return 'gift';
  if (roll < 0.92) return 'enter';
  return 'follow';
}
