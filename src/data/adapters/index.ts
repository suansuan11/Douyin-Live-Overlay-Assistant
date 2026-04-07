import { BridgeAdapter } from './bridgeAdapter';
import { DouyinOfficialAdapter } from './douyinOfficialAdapter';
import { MockAdapter } from './mockAdapter';
import { WebSocketAdapter } from './websocketAdapter';
import type { LiveEventAdapter, LiveEventAdapterCallbacks, LiveEventAdapterConfig } from './types';

export type {
  DouyinOfficialAdapterConfig,
  DouyinOfficialSupportedEventType,
  LiveEventAdapter,
  LiveEventAdapterCallbacks,
  LiveEventAdapterConfig,
  MockAdapterConfig,
  WebSocketAdapterConfig
} from './types';

export { DouyinOfficialAdapter, mapDouyinOfficialCallbackToLiveEvent } from './douyinOfficialAdapter';
export { BridgeAdapter, BRIDGE_PROTOCOL, BRIDGE_PROTOCOL_VERSION, normalizeBridgeMessage } from './bridgeAdapter';
export type {
  DouyinOfficialCallbackData,
  DouyinOfficialCallbackEvent,
  DouyinOfficialCallbackOperator
} from './douyinOfficialAdapter';
export { MockAdapter } from './mockAdapter';
export { WebSocketAdapter } from './websocketAdapter';

export function createAdapter(
  config: LiveEventAdapterConfig,
  callbacks: LiveEventAdapterCallbacks
): LiveEventAdapter {
  if (config.kind === 'mock') {
    return new MockAdapter(config, callbacks);
  }
  if (config.kind === 'websocket') {
    return new WebSocketAdapter(config, callbacks);
  }
  if (config.kind === 'bridge') {
    return new BridgeAdapter(config, callbacks);
  }
  return new DouyinOfficialAdapter(config, callbacks);
}
