import { describe, expect, it } from 'vitest';
import {
  type DouyinOfficialCallbackEvent,
  mapDouyinOfficialCallbackToLiveEvent
} from '../src/data/adapters/douyinOfficialAdapter';
import { createAdapter } from '../src/data/adapters';
import type { LiveEventAdapterCallbacks } from '../src/data/adapters/types';

function createCallbacks(): LiveEventAdapterCallbacks {
  return {
    onEvents: () => undefined,
    onStatus: () => undefined,
    onError: () => undefined
  };
}

describe('adapter factory', () => {
  it('creates adapters behind one stable interface', () => {
    const callbacks = createCallbacks();

    expect(createAdapter({ kind: 'mock', intervalMs: 10 }, callbacks).name).toBe('mock');
    expect(createAdapter({ kind: 'websocket', wsUrl: 'ws://127.0.0.1:17890' }, callbacks).name).toBe('websocket');
    expect(createAdapter({ kind: 'douyinOfficial', appId: 'app-id' }, callbacks).name).toBe('douyinOfficial');
  });
});

describe('douyin official adapter mapping', () => {
  it('maps official comment callback payload into unified live event', () => {
    const callback: DouyinOfficialCallbackEvent = {
      eventId: 'official-comment-1',
      eventType: 'comment',
      timestamp: 1710000000000,
      operator: {
        openId: 'open-user-1',
        nickname: '官方用户',
        avatarUrl: 'https://example.test/avatar.png',
        fansLevel: 8
      },
      data: {
        content: '这是一条官方回调评论'
      },
      raw: {
        provider: 'official'
      }
    };

    expect(mapDouyinOfficialCallbackToLiveEvent(callback)).toEqual({
      eventId: 'official-comment-1',
      type: 'comment',
      timestamp: 1710000000000,
      user: {
        id: 'open-user-1',
        nickname: '官方用户',
        avatar: 'https://example.test/avatar.png',
        fansLevel: 8
      },
      payload: {
        text: '这是一条官方回调评论'
      },
      raw: {
        provider: 'official'
      }
    });
  });

  it('maps official gift and like callback payloads without platform private fields', () => {
    const gift: DouyinOfficialCallbackEvent = {
      eventId: 'official-gift-1',
      eventType: 'gift',
      timestamp: 1710000000200,
      operator: {
        openId: 'open-user-2',
        nickname: '送礼用户'
      },
      data: {
        giftName: '小心心',
        giftCount: 3
      }
    };
    const like: DouyinOfficialCallbackEvent = {
      eventId: 'official-like-1',
      eventType: 'like',
      timestamp: 1710000000400,
      operator: {
        openId: 'open-user-3',
        nickname: '点赞用户'
      },
      data: {
        likeCount: 12
      }
    };

    expect(mapDouyinOfficialCallbackToLiveEvent(gift)?.payload).toEqual({
      giftName: '小心心',
      giftCount: 3
    });
    expect(mapDouyinOfficialCallbackToLiveEvent(like)?.payload).toEqual({
      likeCount: 12
    });
  });

  it('rejects unknown official callback event types', () => {
    const callback: DouyinOfficialCallbackEvent = {
      eventId: 'unknown-1',
      eventType: 'unknown',
      timestamp: 1710000000600,
      operator: {
        openId: 'open-user-4',
        nickname: '未知用户'
      },
      data: {}
    };

    expect(mapDouyinOfficialCallbackToLiveEvent(callback)).toBeNull();
  });
});
