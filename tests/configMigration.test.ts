import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, DEFAULT_CONFIG, migrateConfig } from '../src/shared/config';

describe('config migration', () => {
  it('fills defaults and upgrades legacy mockMode configs', () => {
    const migrated = migrateConfig({
      window: {
        width: 320,
        height: 240,
        opacity: 0.7,
        alwaysOnTop: true,
        clickThrough: true,
        visible: true
      },
      data: {
        mockMode: false,
        wsUrl: 'ws://127.0.0.1:19000',
        reconnectMinMs: 700,
        reconnectMaxMs: 9000
      }
    });

    expect(migrated.version).toBe(CONFIG_VERSION);
    expect(migrated.data.mode).toBe('websocket');
    expect(migrated.data.wsUrl).toBe('ws://127.0.0.1:19000');
    expect(migrated.app.closeToTray).toBe(DEFAULT_CONFIG.app.closeToTray);
    expect(migrated.overlay.likeAggregation.enabled).toBe(true);
  });

  it('clamps invalid numeric config values', () => {
    const migrated = migrateConfig({
      version: CONFIG_VERSION,
      window: {
        width: 10,
        height: 20,
        opacity: 9
      },
      overlay: {
        fontSize: 99,
        scale: 0.01,
        maxEvents: 99999
      },
      data: {
        mode: 'bridge',
        reconnectMinMs: 1,
        reconnectMaxMs: 1
      }
    });

    expect(migrated.window.width).toBe(260);
    expect(migrated.window.height).toBe(220);
    expect(migrated.window.opacity).toBe(1);
    expect(migrated.overlay.fontSize).toBe(28);
    expect(migrated.overlay.scale).toBe(0.75);
    expect(migrated.overlay.maxEvents).toBe(2000);
    expect(migrated.data.reconnectMinMs).toBe(250);
    expect(migrated.data.reconnectMaxMs).toBe(1000);
  });
});
