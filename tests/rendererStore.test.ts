import { describe, expect, it } from 'vitest';
import { applyEventFilters, useAppStore } from '../src/renderer/store';
import { DEFAULT_CONFIG, type AppConfig } from '../src/shared/config';
import type { LiveEvent } from '../src/shared/events';

function makeEvent(type: LiveEvent['type'], text: string): LiveEvent {
  return {
    eventId: `${type}-${text}`,
    type,
    timestamp: 1710000000000,
    user: {
      id: 'user-1',
      nickname: '测试用户'
    },
    payload: {
      text,
      giftName: type === 'gift' ? text : undefined
    }
  };
}

describe('renderer event filters', () => {
  it('filters by showOnly and blocked keywords', () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      overlay: {
        ...DEFAULT_CONFIG.overlay,
        filters: {
          blockedKeywords: ['屏蔽'],
          highlightKeywords: [],
          showOnly: 'system'
        }
      }
    };

    const events = [
      makeEvent('comment', '正常评论'),
      makeEvent('gift', '礼物'),
      makeEvent('system', '系统消息'),
      makeEvent('system', '屏蔽系统消息')
    ];

    expect(applyEventFilters(events, config).map((event) => event.payload.text)).toEqual(['系统消息']);
  });

  it('keeps incoming events in cache while refresh is paused', () => {
    useAppStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        overlay: {
          ...DEFAULT_CONFIG.overlay,
          pauseScroll: true,
          maxEvents: 3
        }
      },
      events: []
    });

    useAppStore.getState().pushEvents([
      makeEvent('comment', 'first'),
      makeEvent('like', 'second'),
      makeEvent('follow', 'third'),
      makeEvent('fans_club', 'fourth')
    ]);

    expect(useAppStore.getState().events.map((event) => event.payload.text)).toEqual(['second', 'third', 'fourth']);
  });

  it('filters bridge event types individually', () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      overlay: {
        ...DEFAULT_CONFIG.overlay,
        filters: {
          blockedKeywords: [],
          highlightKeywords: [],
          showOnly: 'like'
        }
      }
    };

    expect(
      applyEventFilters(
        [makeEvent('comment', 'comment'), makeEvent('like', 'like'), makeEvent('gift', 'gift'), makeEvent('follow', 'follow')],
        config
      ).map((event) => event.type)
    ).toEqual(['like']);
  });
});
