import { createMockEvent } from '../mockEvents';
import type { LiveEventAdapter, LiveEventAdapterCallbacks, MockAdapterConfig } from './types';

export class MockAdapter implements LiveEventAdapter {
  readonly name = 'mock';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: MockAdapterConfig,
    private readonly callbacks: LiveEventAdapterCallbacks
  ) {}

  start(): void {
    this.callbacks.onStatus({
      connected: true,
      connecting: false,
      retryAttempt: 0
    });

    const intervalMs = this.config.intervalMs ?? 320;
    const burstProbability = this.config.burstProbability ?? 0.18;
    this.timer = setInterval(() => {
      const count = Math.random() < burstProbability ? 3 : 1;
      this.callbacks.onEvents(Array.from({ length: count }, () => createMockEvent()));
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
