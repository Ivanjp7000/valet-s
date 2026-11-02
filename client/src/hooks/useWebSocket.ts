import { useEffect, useState, useRef, useCallback } from 'react';
import { closeIfWebSocketHeartbeatStale } from '@/lib/realtime-event-policy.mjs';

export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastServerHeartbeatAt = useRef(0);
  const visibilityListener = useRef<(() => void) | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      if (unmounted.current) return;
      lastServerHeartbeatAt.current = Date.now();
      setIsConnected(true);
      if (watchdogTimer.current) clearInterval(watchdogTimer.current);
      visibilityListener.current = checkForStaleHeartbeat;
      watchdogTimer.current = setInterval(checkForStaleHeartbeat, 10_000);
      document.addEventListener('visibilitychange', checkForStaleHeartbeat);
    };

    socket.onmessage = (event) => {
      if (unmounted.current) return;
      lastServerHeartbeatAt.current = Date.now();
      try {
        if (JSON.parse(event.data)?.type === 'heartbeat') return;
      } catch {}
      setLastMessage(event.data);
    };

    socket.onclose = (event) => {
      if (unmounted.current) return;
      setIsConnected(false);
      if (watchdogTimer.current) {
        clearInterval(watchdogTimer.current);
        watchdogTimer.current = null;
      }
      if (visibilityListener.current) document.removeEventListener('visibilitychange', visibilityListener.current);
      visibilityListener.current = null;
      // Code 1008 (Policy Violation) means the server rejected us as unauthenticated.
      // Stop reconnecting — the caller relies on HTTP polling for updates instead.
      if (event.code === 1008) return;
      // Auto-reconnect after 3 seconds for other close reasons
      reconnectTimeout.current = setTimeout(() => {
        if (!unmounted.current) connect();
      }, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    function checkForStaleHeartbeat() {
      closeIfWebSocketHeartbeatStale({
        isOpen: socket.readyState === WebSocket.OPEN && ws.current === socket,
        lastHeartbeatAt: lastServerHeartbeatAt.current,
        now: Date.now(),
        onStale: () => {
        setIsConnected(false);
        socket.close(4000, 'Heartbeat timeout');
        },
      });
    }
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (watchdogTimer.current) clearInterval(watchdogTimer.current);
      if (visibilityListener.current) document.removeEventListener('visibilitychange', visibilityListener.current);
      visibilityListener.current = null;
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { lastMessage, isConnected, sendMessage };
}
