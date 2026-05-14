import { useEffect, useState, useRef, useCallback } from 'react';

export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      if (unmounted.current) return;
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      if (unmounted.current) return;
      setLastMessage(event.data);
    };

    socket.onclose = (event) => {
      if (unmounted.current) return;
      setIsConnected(false);
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
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
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
