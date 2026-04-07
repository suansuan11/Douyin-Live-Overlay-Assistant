import { normalizeLiveEvent } from '../eventSchema';
import { WebSocketAdapter, type SocketAdapterConfig } from './websocketAdapter';
import type { LiveEvent } from '../../shared/events';
import type { LiveEventAdapterCallbacks, WebSocketAdapterConfig } from './types';

export const BRIDGE_PROTOCOL = 'douyin-live-overlay-bridge';
export const BRIDGE_PROTOCOL_VERSION = 1;

export interface BridgeEnvelope {
  protocol: typeof BRIDGE_PROTOCOL;
  version: typeof BRIDGE_PROTOCOL_VERSION;
  events: LiveEvent[];
}

export interface BridgeAdapterConfig extends SocketAdapterConfig {
  kind: 'bridge';
}

export function normalizeBridgeMessage(input: unknown): LiveEvent[] {
  if (Array.isArray(input)) {
    return input.flatMap((item) => normalizeOne(item));
  }

  const direct = normalizeLiveEvent(input);
  if (direct) {
    return [direct];
  }

  if (!isBridgeEnvelope(input)) {
    return [];
  }

  return input.events.flatMap((event) => normalizeOne(event));
}

export class BridgeAdapter extends WebSocketAdapter {
  override readonly name = 'bridge' as const;

  constructor(config: BridgeAdapterConfig, callbacks: LiveEventAdapterCallbacks) {
    super(config, callbacks, {
      normalizeMessage: normalizeBridgeMessage,
      helloMessage: {
        protocol: BRIDGE_PROTOCOL,
        version: BRIDGE_PROTOCOL_VERSION,
        client: 'douyin-live-overlay-assistant',
        intent: 'receive-events'
      }
    });
  }
}

function normalizeOne(input: unknown): LiveEvent[] {
  const event = normalizeLiveEvent(input);
  return event ? [event] : [];
}

function isBridgeEnvelope(value: unknown): value is BridgeEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { protocol?: unknown }).protocol === BRIDGE_PROTOCOL &&
    (value as { version?: unknown }).version === BRIDGE_PROTOCOL_VERSION &&
    Array.isArray((value as { events?: unknown }).events)
  );
}
