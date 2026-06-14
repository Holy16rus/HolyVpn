import { useEffect, useRef, useCallback } from 'react';

type EventHandler = (data: Record<string, unknown>) => void;

export function useSSE(url: string, handlers: Record<string, EventHandler>) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      handlersRef.current['__open']?.({});
    };

    es.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current['message']?.(data);
      } catch {}
    });

    const knownEvents = ['status', 'metrics', 'log', 'done', 'geo_points', 'heartbeat', 'error'];
    for (const eventName of knownEvents) {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current[eventName]?.(data);
        } catch {}
      });
    }

    es.onerror = () => {
      handlersRef.current['__error']?.({});
      setTimeout(connect, 2000);
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return { reconnect: connect };
}
