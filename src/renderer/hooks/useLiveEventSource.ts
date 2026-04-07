import { useEffect, useMemo, useRef } from 'react';
import { LiveEventClient } from '../../data/liveEventClient';
import type { AppConfig } from '../../shared/config';
import type { LiveEvent } from '../../shared/events';
import { useAppStore } from '../store';

export function useLiveEventSource(config: AppConfig): void {
  const pushEvents = useAppStore((state) => state.pushEvents);
  const setConnection = useAppStore((state) => state.setConnection);
  const pendingRef = useRef<LiveEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clientOptions = useMemo(
    () => ({
      mode: config.data.mode,
      wsUrl: config.data.wsUrl,
      bridgeUrl: config.data.bridgeUrl,
      maxEvents: config.overlay.maxEvents,
      reconnectMinMs: config.data.reconnectMinMs,
      reconnectMaxMs: config.data.reconnectMaxMs,
      likeAggregationEnabled: config.overlay.likeAggregation.enabled,
      likeAggregateWindowMs: config.overlay.likeAggregation.windowMs
    }),
    [
      config.data.mode,
      config.data.bridgeUrl,
      config.data.reconnectMaxMs,
      config.data.reconnectMinMs,
      config.data.wsUrl,
      config.overlay.likeAggregation.enabled,
      config.overlay.likeAggregation.windowMs,
      config.overlay.maxEvents
    ]
  );

  useEffect(() => {
    const flush = (): void => {
      const next = pendingRef.current;
      pendingRef.current = [];
      flushTimerRef.current = null;
      if (next.length > 0) {
        pushEvents(next);
      }
    };

    const scheduleFlush = (): void => {
      if (flushTimerRef.current !== null) {
        return;
      }
      flushTimerRef.current = setTimeout(flush, 100);
    };

    const client = new LiveEventClient(clientOptions, {
      onEvents: (events) => {
        pendingRef.current.push(...events);
        scheduleFlush();
      },
      onStatus: setConnection,
      onError: (error) => window.electronBridge?.log('warn', 'Live event client error', error.message)
    });

    client.start();
    return () => {
      client.stop();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [clientOptions, pushEvents, setConnection]);
}
