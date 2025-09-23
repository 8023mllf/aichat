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
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      resolve(text);
    };
    rec.onerror = (e: any) => reject(e.error || e);
    rec.onend = () => {};
    rec.start();
  });
}
