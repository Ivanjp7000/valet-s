# Public ticket status stream

The public tracker uses a process-local SSE event bus. The stream is disabled by default. If the server does not confirm a single-replica topology, it returns `503` with `X-Ticket-Stream-Disabled: true`; browsers then use the existing 30-second GET polling fallback.

## Enabling the stream

Set `PUBLIC_TICKET_STREAM_TOPOLOGY=single_replica` only after verifying that the Valet-S runtime has exactly one replica and all ticket writes go through that runtime's storage methods. The setting is an explicit deployment assertion; it does not discover Railway replica count. If the service is scaled out, remove the setting or change it to a non-single value before scaling. The foreground reconciliation remains enabled as a recovery bound if an event is missed.

Do not enable the stream for an unknown or multi-replica topology. The polling fallback preserves ticket freshness without relying on process-local event delivery.

## Database-read and freshness behavior

- A successful stream connection reads the ticket once for its initial snapshot. App-mediated ticket changes on that process are pushed immediately.
- While connected and visible, the client reconciles with one HTTP/Neon read every 10 minutes 30 seconds by default. Set `VITE_TICKET_STATUS_RECONCILE_MS` at build time to adjust it; values are clamped to at least six minutes so the interval remains above Neon’s five-minute idle window.
- If the stream is disabled or disconnected, visible clients use the existing 30-second polling fallback.
- Hidden tabs stop polling and close the stream. When the topology gate is enabled, returning opens a fresh stream snapshot; otherwise polling resumes. A PIN mismatch/deleted ticket clears the cached ticket and closes the stream.
- “Check now” and focus checks issue an immediate GET. A manual check may wake Neon by design.
- The SSE heartbeat is application-only and does not query Neon.

Out-of-process writes or writes on another replica are not pushed over this in-memory bus. A visible tracker sees them at the next 10-minute-30-second reconciliation; a hidden tracker refreshes its snapshot when it returns. Use shared event transport before claiming immediate updates across replicas.
