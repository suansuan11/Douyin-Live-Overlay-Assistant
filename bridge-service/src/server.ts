import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { createBridgeEnvelope, validateLiveEvent, type LiveEvent } from './schema';

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
    filePath: resolve(args.get('file') ?? 'bridge-service/sample-events.json'),
    intervalMs: Number(args.get('interval') ?? 1000)
  };
}

function loadEvents(filePath: string): LiveEvent[] {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('sample event file must be a JSON array');
  }
  const events = parsed.flatMap((item) => {
    const event = validateLiveEvent(item);
    return event ? [event] : [];
  });
  if (events.length === 0) {
    throw new Error('sample event file does not contain any valid LiveEvent');
  }
  return events;
}

function makeSystemEvent(text: string): LiveEvent {
  return {
    eventId: `bridge-system-${Date.now()}`,
    type: 'system',
    timestamp: Date.now(),
    user: {
      id: 'bridge-service',
      nickname: 'Bridge Service'
    },
    payload: { text }
  };
}

const options = parseOptions();
const configuredEvents = loadEvents(options.filePath);
const wss = new WebSocketServer({ port: options.port, host: '127.0.0.1' });
let cursor = 0;

wss.on('connection', (socket) => {
  socket.on('message', (message) => {
    console.log(`overlay client says: ${message.toString()}`);
  });

  socket.send(JSON.stringify(createBridgeEnvelope([makeSystemEvent('Bridge Receiver 已连接')])));
});

setInterval(() => {
  const baseEvent = configuredEvents[cursor % configuredEvents.length] ?? makeSystemEvent('No sample events available');
  cursor += 1;
  const event: LiveEvent = {
    ...baseEvent,
    eventId: `${baseEvent.eventId}-${Date.now()}`,
    timestamp: Date.now(),
    raw: baseEvent
  };
  const payload = JSON.stringify(createBridgeEnvelope([event]));

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}, options.intervalMs);

console.log(`Bridge sample server listening on ws://127.0.0.1:${options.port}`);
console.log(`Replaying events from ${options.filePath}`);
