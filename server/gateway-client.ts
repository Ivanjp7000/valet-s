/**
 * Gateway WebSocket Client (On-Demand)
 *
 * Connects to OpenClaw Gateway via WebSocket on-demand for NL Command chat.
 * Each chat request creates a new connection, sends the message, collects
 * the response, and closes. This is simpler and more reliable than maintaining
 * a persistent connection.
 *
 * Gateway URL: ws://127.0.0.1:18789 (loopback, local only)
 * Session: Dedicated NL Command session for context continuity
 */

import { WebSocket } from 'ws';

const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';
const NL_SESSION_KEY = process.env.NL_SESSION_KEY || 'agent:main:nl-command';

interface GatewayMessage {
  method: string;
  params?: Record<string, any>;
  id?: number | string;
}

let requestCounter = 0;

function getWsUrl(): string {
  const authQuery = GATEWAY_TOKEN ? `?token=${encodeURIComponent(GATEWAY_TOKEN)}` : '';
  return `${GATEWAY_URL}${authQuery}`;
}

function sendRequest(method: string, params?: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `nl-${++requestCounter}`;
    const ws = new WebSocket(getWsUrl());
    let resolved = false;

    const cleanup = () => {
      ws.removeAllListeners();
      clearTimeout(timeoutHandle);
      if (!resolved) {
        reject(new Error('Gateway request timed out'));
      }
    };

    const timeoutHandle = setTimeout(() => cleanup(), 120_000);

    ws.once('open', () => {
      ws.send(JSON.stringify({ method, params, id }));
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          resolved = true;
          clearTimeout(timeoutHandle);
          ws.removeAllListeners();
          ws.close();

          if (msg.error) {
            reject(new Error(msg.error.message || 'Gateway error'));
          } else {
            resolve(msg.result ?? msg);
          }
        }
        // Ignore other messages (events, broadcasts)
      } catch (err: any) {
        // Ignore parse errors for non-JSON messages
      }
    });

    ws.once('error', (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);
        reject(err);
      }
    });

    ws.once('close', (code) => {
      if (!resolved && code !== 1000) {
        resolved = true;
        clearTimeout(timeoutHandle);
        reject(new Error(`Gateway connection closed: ${code}`));
      }
    });
  });
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Send a message to the Gateway chat session and collect the full response.
 * 
 * This connects to Gateway, sends the message, waits for all response
 * events, and returns the complete assistant reply.
 */
export async function gatewayChatSend(
  sessionKey: string,
  message: string,
  onStream?: (chunk: string) => void,
): Promise<string> {
  // Step 1: Send the message
  const sendResult = await sendRequest('chat.send', {
    sessionKey,
    message,
  });

  // If the response is inline (no streaming), return it
  if (sendResult?.content) {
    return sendResult.content;
  }
  if (sendResult?.message?.content) {
    return sendResult.message.content;
  }

  // Step 2: For streaming responses, connect again and listen for events
  // (Gateway may send the response in a separate event)
  return new Promise((resolve, reject) => {
    let fullResponse = '';
    let done = false;
    const ws = new WebSocket(getWsUrl());

    const cleanup = () => {
      ws.removeAllListeners();
      clearTimeout(timeoutHandle);
      if (!done) {
        resolve(fullResponse || '[Response incomplete]');
      }
    };

    const timeoutHandle = setTimeout(() => cleanup(), 120_000);

    ws.once('open', () => {
      // Subscribe to session events by requesting history first
      ws.send(JSON.stringify({
        method: 'chat.history',
        params: { sessionKey, limit: 5 },
        id: `hist-${requestCounter}`,
      }));
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        
        // Handle chat events
        if (msg.method === 'chat' || (msg.params?.sessionKey === sessionKey)) {
          const content = msg.params?.content || msg.params?.text || msg.params?.output || '';
          if (content) {
            fullResponse += content;
            onStream?.(content);
          }
          if (msg.params?.done === true) {
            done = true;
            clearTimeout(timeoutHandle);
            ws.removeAllListeners();
            ws.close();
            resolve(fullResponse);
          }
        }

        // Handle inline response from chat.send
        if (msg.id && msg.result) {
          const content = msg.result?.content || msg.result?.message?.content || '';
          if (content && !fullResponse) {
            fullResponse = content;
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.once('error', (err: Error) => {
      if (!done) {
        done = true;
        clearTimeout(timeoutHandle);
        reject(err);
      }
    });

    ws.once('close', (code) => {
      if (!done && code !== 1000) {
        done = true;
        clearTimeout(timeoutHandle);
        reject(new Error(`Gateway closed: ${code}`));
      } else if (!done) {
        cleanup();
        resolve(fullResponse || '[No response from Gateway]');
      }
    });
  });
}

/**
 * Get chat history for a session.
 */
export async function gatewayChatHistory(sessionKey: string): Promise<any[]> {
  const result = await sendRequest('chat.history', {
    sessionKey,
    limit: 20,
  });

  if (result?.entries) return result.entries;
  if (result?.rows) return result.rows;
  return [];
}

/**
 * Test Gateway connectivity.
 */
export async function testGatewayConnection(): Promise<boolean> {
  try {
    // Try a lightweight health check
    await sendRequest('health', {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Get connection status.
 */
export function getGatewayStatus(): { connected: boolean; url: string; sessionKey: string } {
  // For on-demand mode, we can't know if connected without testing
  return {
    connected: false, // Will be set to true after successful test
    url: GATEWAY_URL,
    sessionKey: NL_SESSION_KEY,
  };
}

/**
 * Initialize — no-op for on-demand mode (connection happens per-request).
 */
export function initGatewayClient(): void {
  console.log(`[gateway-client] On-demand mode — connecting to ${GATEWAY_URL} per request`);
}

/**
 * Disconnect — no-op for on-demand mode.
 */
export function disconnect(): void {
  // No persistent connection to close
}
