import { createServer } from 'node:net';
import { WebSocketServer } from 'ws';
import { describe, expect, it } from 'vitest';
import { WebSocketAdapter } from '../src/data/adapters/websocketAdapter';
import type { ConnectionStatus, LiveEvent } from '../src/shared/events';

function makeEvent(eventId: string): LiveEvent {
  return {
    eventId,
    type: 'comment',
    timestamp: Date.now(),
    user: { id: 'ws-user', nickname: 'WS 用户' },
    payload: { text: 'reconnect ok' }
  };
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        const port = address.port;
        server.close(() => resolve(port));
        return;
      }
      reject(new Error('failed to allocate port'));
    });
    server.on('error', reject);
  });
}

describe('WebSocketAdapter reconnect', () => {
  it('reconnects after the target server becomes available', async () => {
    const port = await getFreePort();
    const statuses: ConnectionStatus[] = [];
    const events: LiveEvent[] = [];
    const adapter = new WebSocketAdapter(
      {
        wsUrl: `ws://127.0.0.1:${port}`,
        reconnectMinMs: 25,
        reconnectMaxMs: 50
      },
      {
        onEvents: (next) => events.push(...next),
        onStatus: (status) => statuses.push(status),
        onError: () => undefined
      }
    );

    adapter.start();
    await new Promise((resolve) => setTimeout(resolve, 80));

    const server = new WebSocketServer({ port, host: '127.0.0.1' });
    server.on('connection', (socket) => {
      socket.send(JSON.stringify(makeEvent('reconnect-event')));
    });

    await expect
      .poll(() => events.some((event) => event.eventId === 'reconnect-event'), { timeout: 1000, interval: 25 })
      .toBe(true);
    expect(statuses.some((status) => status.retryAttempt > 0)).toBe(true);

    adapter.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
