import type { Response } from 'express';
import type { AgentEvent } from '../agent/agent.types.js';

export interface EventStream {
  send(event: AgentEvent): void;
  close(): void;
}

/**
 * Turns the response into a server-sent event stream: `event: <type>` and the
 * event as JSON `data`, plus a comment heartbeat so idle proxies keep the
 * connection open while the model thinks.
 */
export function openEventStream(
  res: Response,
  heartbeatMs = 15_000,
): EventStream {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable response buffering in nginx-style proxies.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Never write to a response the client has closed.
  const writable = () => !res.writableEnded && !res.destroyed;
  const heartbeat = setInterval(() => {
    if (writable()) res.write(': ping\n\n');
  }, heartbeatMs);
  heartbeat.unref();

  return {
    send(event) {
      if (!writable()) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    },
    close() {
      clearInterval(heartbeat);
      if (writable()) res.end();
    },
  };
}
