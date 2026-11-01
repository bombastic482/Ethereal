/**
 * Dictation through the browser's own speech recognition (Chrome, Edge, Safari). Nothing here
 * sends audio anywhere itself; the browser handles recognition the way it does for any site,
 * which on some browsers means its vendor's speech service. Only offered where supported.
 */
import { useEffect, useRef, useState } from 'preact/hooks';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Live dictation: `text` fills in as you speak, `onFinal` gets the whole phrase when you stop.
 */
export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const finalCb = useRef(onFinal);
  finalCb.current = onFinal;

  useEffect(() => {
    setSupported(!!ctor());
    return () => rec.current?.abort();
  }, []);

  const start = () => {
    const C = ctor();
    if (!C || listening) return;
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setText((finalText + interim).trim());
    };
    r.onerror = (e) => {
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone permission is off for this site.'
          : e.error === 'no-speech'
            ? 'Didn’t catch that. Try again, a little closer.'
            : 'Voice input stopped. You can type instead.',
      );
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (finalText.trim()) finalCb.current(finalText.trim());
    };
    setError(null);
    setText('');
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };
  const stop = () => rec.current?.stop();
  return { supported, listening, text, error, start, stop };
}
