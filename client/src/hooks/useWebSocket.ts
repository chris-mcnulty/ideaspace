import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

interface UseWebSocketOptions {
  spaceId?: string;
  userId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: (info: { reconnected: boolean; attempt: number }) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

// Toggle `localStorage.setItem('WS_DEBUG', '1')` in the browser to enable
// verbose WebSocket tracing without recompiling.
const wsDebug = (...args: unknown[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('WS_DEBUG') === '1') {
      console.log('[ws]', ...args);
    }
  } catch {
    /* ignore — private mode etc. */
  }
};

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    spaceId,
    userId,
    onMessage,
    onOpen,
    onClose,
    onError,
    enabled = true,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  // Capped exponential backoff: 500ms, 1s, 2s, 4s, 8s, 16s, 30s (max).
  const baseDelayMs = 500;
  const maxDelayMs = 30_000;
  const maxReconnectAttempts = 20;

  const [isConnected, setIsConnected] = useState(false);

  // Stash the latest callbacks in refs so changing inline handlers doesn't
  // tear down and rebuild the socket on every render.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams();
      if (spaceId) qs.set('spaceId', spaceId);
      if (userId) qs.set('userId', userId);
      const params = qs.toString() ? `?${qs.toString()}` : '';
      const wsUrl = `${protocol}//${window.location.host}/ws${params}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        const attempt = reconnectAttemptsRef.current;
        const reconnected = attempt > 0;
        wsDebug('open', { reconnected, attempt });
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        onOpenRef.current?.({ reconnected, attempt });
      });

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('[ws] Failed to parse message:', error);
        }
      });

      ws.addEventListener('close', (event) => {
        wsDebug('close', { code: event.code, reason: event.reason });
        setIsConnected(false);
        onCloseRef.current?.();

        // Skip reconnect if the close was intentional (cleanup/unmount)
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false;
          return;
        }

        // Skip reconnect on terminal policy/protocol closes — retrying just
        // causes thundering-herd retries against an unrecoverable error
        // (e.g. expired session for a userId-scoped channel).
        // 1000 normal, 1001 going-away, 1002 protocol error, 1003 unsupported
        // data, 1008 policy violation, 1011 server error during auth.
        const terminalCloseCodes = new Set([1000, 1001, 1002, 1003, 1008, 1011]);
        if (terminalCloseCodes.has(event.code)) {
          wsDebug('terminal close — not reconnecting', { code: event.code });
          return;
        }

        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const attempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = attempt;
          // Exponential backoff capped at maxDelayMs, plus small jitter.
          const expDelay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
          const jitter = Math.floor(Math.random() * 250);
          const delay = expDelay + jitter;
          wsDebug('reconnect scheduled', { attempt, delay });

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      });

      ws.addEventListener('error', (error) => {
        wsDebug('error', error);
        onErrorRef.current?.(error);
      });
    } catch (error) {
      console.error('[ws] Connection error:', error);
    }
  }, [enabled, spaceId, userId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      wsDebug('send dropped — socket not open');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    send,
    disconnect,
    isConnected,
  };
}
