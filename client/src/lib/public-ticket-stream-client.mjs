const MAX_SSE_LINE_CHARACTERS = 64 * 1024;
const MAX_SSE_EVENT_CHARACTERS = 64 * 1024;

export async function consumePublicTicketStream(body, { onTicket, onHeartbeat, onAccessRevoked }, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines = [];
  let eventCharacters = 0;

  const dispatch = () => {
    if (dataLines.length > 0) {
      const data = dataLines.join("\n");
      if (eventName === "ticket") onTicket(data);
      else if (eventName === "heartbeat") onHeartbeat?.();
      else if (eventName === "access-revoked") onAccessRevoked?.();
    }
    eventName = "message";
    dataLines = [];
    eventCharacters = 0;
  };

  const processLine = (rawLine) => {
    if (rawLine.length > MAX_SSE_LINE_CHARACTERS) {
      throw new RangeError("SSE line exceeds the supported size limit");
    }
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line === "") { dispatch(); return; }
    if (line.startsWith(":")) { onHeartbeat?.(); return; }
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") {
      eventName = value;
      eventCharacters += value.length;
    } else if (field === "data") {
      eventCharacters += value.length + 1;
      dataLines.push(value);
    }
    if (eventCharacters > MAX_SSE_EVENT_CHARACTERS) {
      throw new RangeError("SSE event exceeds the supported size limit");
    }
  };

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_SSE_LINE_CHARACTERS && !buffer.includes("\n")) {
        throw new RangeError("SSE line exceeds the supported size limit");
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    }
    buffer += decoder.decode();
    if (buffer.length > 0) processLine(buffer);
    dispatch();
  } finally {
    try { await reader.cancel(); } catch {}
    try { reader.releaseLock(); } catch {}
  }
}
