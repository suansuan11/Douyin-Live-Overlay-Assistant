import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { BRIDGE_PROTOCOL, BRIDGE_PROTOCOL_VERSION } from '../src/data/adapters/bridgeAdapter';
import { normalizeLiveEvent } from '../src/data/eventSchema';
import { createMockEvent } from '../src/data/mockEvents';
import type { LiveEvent } from '../src/shared/events';

interface BridgeCliOptions {
  port: number;
  filePath: string;
  intervalMs: number;
}

function parseOptions(): BridgeCliOptions {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (key?.startsWith('--') && value) {
      args.set(key.slice(2), value);
    }
  }

  return {
    port: Number(args.get('port') ?? process.env.BRIDGE_PORT ?? 17891),
    filePath: resolve(args.get('file') ?? 'bridge/sample-events.json'),
    intervalMs: Number(args.get('interval') ?? 1000)
  };
}

function loadEvents(filePath: string): LiveEvent[] {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('sample event file must be a JSON array');
  }
  return parsed.flatMap((item) => {
    const event = normalizeLiveEvent(item);
    return event ? [event] : [];
  });
}

const options = parseOptions();
const configuredEvents = loadEvents(options.filePath);
const wss = new WebSocketServer({ port: options.port });
let cursor = 0;

wss.on('connection', (socket) => {
  socket.on('message', (message) => {
    console.log(`overlay client says: ${message.toString()}`);
  });

  socket.send(
    JSON.stringify({
      protocol: BRIDGE_PROTOCOL,
      version: BRIDGE_PROTOCOL_VERSION,
      events: [
        {
          ...createMockEvent('system'),
          payload: { text: 'Bridge Receiver 已连接' }
        }
      ]
    })
  );
});

setInterval(() => {
  const baseEvent = configuredEvents[cursor % configuredEvents.length] ?? createMockEvent();
  cursor += 1;
  const event: LiveEvent = {
    ...baseEvent,
    eventId: `${baseEvent.eventId}-${Date.now()}`,
    timestamp: Date.now(),
    raw: baseEvent
  };
  const payload = JSON.stringify({
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_PROTOCOL_VERSION,
    events: [event]
  });

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}, options.intervalMs);

console.log(`Bridge sample server listening on ws://127.0.0.1:${options.port}`);
console.log(`Replaying events from ${options.filePath}`);
