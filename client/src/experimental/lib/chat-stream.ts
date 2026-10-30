/** Decode SSE across byte boundaries, including an unterminated final event. */
export async function* readChatEvents(response: Response): AsyncGenerator<Record<string, any>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The chat response did not include a stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (block: string) => {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
    if (!data.trim()) return null;
    if (data.trim() === "[DONE]") return { done: true };
    let event;
    try { event = JSON.parse(data); } catch { throw new Error("The chat response contained an invalid stream event."); }
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("The chat response contained an invalid stream event.");
    return event;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = parse(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (event) yield event;
      }
      if (done) {
        const event = parse(buffer);
        if (event) yield event;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
