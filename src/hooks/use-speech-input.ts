// useSpeechInput — thin, feature-detected wrapper over the Web Speech API so
// every open-text field in the app can offer voice dictation without pulling in
// a dependency. Returns { supported, listening, start, stop } and streams
// transcribed text (interim + final) back through onTranscript. Designed for
// low-confidence writers: talking is easier than typing.
//
// The browser SpeechRecognition types aren't in lib.dom for all targets, so we
// declare the minimal surface we use rather than reaching for `any`.

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * @param onTranscript called with the full text for the current dictation —
 *   base text captured at start() plus everything heard since. Callers can set
 *   their field value to it directly (it already includes the pre-existing text).
 */
export function useSpeechInput(onTranscript: (text: string) => void) {
  const [supported] = useState(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  // Keep the latest callback without re-subscribing the recognition handlers.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback((baseText = "") => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Tear down any prior instance before starting a fresh capture.
    recognitionRef.current?.abort();

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseTextRef.current = baseText ? baseText.replace(/\s+$/, "") + " " : "";

    rec.onresult = (e) => {
      let heard = "";
      for (let i = 0; i < e.results.length; i++) {
        heard += e.results[i][0].transcript;
      }
      onTranscriptRef.current(baseTextRef.current + heard);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
