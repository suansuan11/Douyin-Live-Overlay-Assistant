import type { ConnectionStatus, LiveEvent, LiveEventType } from '../../shared/events';

export interface LiveEventAdapterCallbacks {
  onEvents(events: LiveEvent[]): void;
  onStatus(status: ConnectionStatus): void;
  onError(error: Error): void;
}

export interface LiveEventAdapter {
  readonly name: string;
  start(): void;
  stop(): void;
}

export interface MockAdapterConfig {
  kind: 'mock';
  intervalMs?: number;
  burstProbability?: number;
}

export interface WebSocketAdapterConfig {
  kind: 'websocket';
  wsUrl: string;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
}

export interface BridgeAdapterConfig {
  kind: 'bridge';
  wsUrl: string;
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
}

export interface DouyinOfficialAdapterConfig {
  kind: 'douyinOfficial';
  /**
   * Placeholder configuration only. Values and verification must follow the
   * official live platform documentation available to the app owner.
   */
  appId?: string;
  clientKey?: string;
  callbackSecret?: string;
  callbackUrl?: string;
  verifySignature?: boolean;
  enabledEventTypes?: DouyinOfficialSupportedEventType[];
}

export type DouyinOfficialSupportedEventType = Exclude<LiveEventType, 'system'>;

export type LiveEventAdapterConfig =
  | MockAdapterConfig
  | WebSocketAdapterConfig
  | BridgeAdapterConfig
  | DouyinOfficialAdapterConfig;
