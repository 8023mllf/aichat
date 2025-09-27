const API_BASE = import.meta.env.VITE_API_BASE || "";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function createSession(personaSlug?: string) {
  const r = await fetch(`${API_BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaSlug: personaSlug ?? null })
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).sessionId as string;
}

export async function streamChat(params: {
  sessionId: string; userMessage: string; personaSlug?: string;
  onDelta: (text: string) => void; signal?: AbortSignal;
}) {
  const r = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: params.sessionId,
      userMessage: params.userMessage,
      personaSlug: params.personaSlug ?? null
    }),
    signal: params.signal
  });
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = chunk.split("\n").map(s => s.trim());
      const dataLine = lines.find(l => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      try {
        const j = JSON.parse(payload);
        if (typeof j.delta === "string" && j.delta.length) {
          params.onDelta(j.delta);
        }
      } catch { /* ignore */ }
    }
  }
}

export async function ttsToBlob(
  text: string,
  opts?: { voice?: string; format?: "mp3" | "wav"; sampleRate?: number; token?: string; }
) {
  const r = await fetch(`${API_BASE}/api/voice/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice: opts?.voice ?? "xiaoyun",
      format: opts?.format ?? "mp3",
      sample_rate: opts?.sampleRate ?? 16000,
      token: opts?.token ?? null
    })
  });
  if (!r.ok) throw new Error(`TTS HTTP ${r.status}`);
  return await r.blob();
}

export async function getIsiToken() {
  const r = await fetch(`${API_BASE}/api/isi/token`);
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}


// src/api.ts 里追加
export async function fetchCategoriesMeta(): Promise<{
  traits: string[]; background: string[]; style: string[];
}> {
  const r = await fetch(`${API_BASE}/api/meta/categories`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
