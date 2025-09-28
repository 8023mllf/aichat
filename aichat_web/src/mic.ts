// src/mic.ts
// 语音识别（Web Speech API） + 录音工具（MediaRecorder）
// 并提供 beginVoiceCapture：一次点击开始，再次点击结束，返回 {blob, asr}

export function isSpeechSupported() {
  // @ts-ignore
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startSpeechOnce(lang = "zh-CN"): Promise<string> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error("SpeechRecognition not supported"));
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let resolved = false;
    rec.onresult = (e: any) => {
      if (resolved) return;
      resolved = true;
      const text = e.results?.[0]?.[0]?.transcript || "";
      resolve(text);
      try { rec.stop(); } catch {}
    };
    rec.onerror = (e: any) => {
      if (resolved) return;
      resolved = true;
      reject(e.error || e);
      try { rec.stop(); } catch {}
    };
    rec.onend = () => {
      if (!resolved) resolve("");
    };
    rec.start();
  });
}

/** 选择当前浏览器最可能支持的音频 MIME（用于 MediaRecorder） */
export function pickSupportedAudioMime(): string {
  const cand = [
    "audio/webm;codecs=opus", // Chrome/Edge 首选
    "audio/webm",
    "audio/mp4",              // Safari 常见
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  const isSup = (t: string) =>
    (window as any).MediaRecorder?.isTypeSupported?.(t);

  return (
    cand.find(isSup) ||
    cand.find((t) => t.startsWith("audio/webm")) ||
    "audio/webm"
  );
}

// --- 原始录音：开始 -> 返回 stop 函数（stop 后产出 Blob） ---
let _rec: MediaRecorder | null = null;
let _chunks: BlobPart[] = [];
let _stream: MediaStream | null = null;

export async function startRawRecording(
  mime?: string
): Promise<() => Promise<Blob>> {
  const useMime = mime || pickSupportedAudioMime();
  _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  _chunks = [];
  _rec = new MediaRecorder(_stream, { mimeType: useMime });

  _rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) _chunks.push(e.data);
  };
  _rec.start();

  return async () => {
    if (!_rec) throw new Error("no recorder");
    const rec = _rec;
    _rec = null;

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });

    _stream?.getTracks().forEach((t) => t.stop());
    _stream = null;

    return new Blob(_chunks, { type: useMime });
  };
}

/**
 * 一键开始语音采集：包含“原始录音 + 并发 ASR”。
 * 返回一个 stop 函数，调用后得到 { blob, asr }。
 */
export async function beginVoiceCapture(): Promise<
  () => Promise<{ blob: Blob; asr: string }>
> {
  const mime = pickSupportedAudioMime();
  const stopRaw = await startRawRecording(mime);
  const asrPromise = isSpeechSupported()
    ? startSpeechOnce("zh-CN").catch(() => "")
    : Promise.resolve("");

  return async () => {
    const [blob, asr] = await Promise.all([stopRaw(), asrPromise]);
    return { blob, asr: asr || "" };
  };
}
