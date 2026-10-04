"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Microphone permission (web counterpart of Accompanist Permissions)  */
/* ------------------------------------------------------------------ */

export type MicState = "unsupported" | "prompt" | "granted" | "denied";

function supportsMediaDevices() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function queryMicState(): Promise<MicState> {
  if (!supportsMediaDevices()) return "unsupported";
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        return status.state as MicState;
      }
    }
  } catch {
    /* some browsers throw on unknown permission names */
  }
  return "prompt";
}

/** Actually triggers the browser permission prompt and returns a live stream when granted. */
export async function requestMicrophone(): Promise<{ state: MicState; stream?: MediaStream }> {
  if (!supportsMediaDevices()) return { state: "unsupported" };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return { state: "granted", stream };
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError") return { state: "denied" };
    if (name === "NotFoundError" || name === "NotSupportedError") return { state: "unsupported" };
    return { state: "denied" };
  }
}

export function useMicPermission() {
  const [state, setState] = useState<MicState>("prompt");

  const refresh = useCallback(async () => {
    setState(await queryMicState());
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      let status: PermissionStatus | undefined;
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((s) => {
          status = s;
          s.onchange = () => setState(s.state as MicState);
        })
        .catch(() => undefined);
      return () => {
        if (status) status.onchange = null;
      };
    }
  }, [refresh]);

  const request = useCallback(async () => {
    const res = await requestMicrophone();
    res.stream?.getTracks().forEach((t) => t.stop());
    setState(res.state);
    return res.state;
  }, []);

  return { state, refresh, request };
}

/* ------------------------------------------------------------------ */
/* Speech recognition (real engine: Web Speech API)                    */
/* ------------------------------------------------------------------ */

type SRAlternative = { transcript: string; confidence: number };
type SRResult = { 0: SRAlternative; isFinal: boolean; length: number };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const AR_LANGS = ["ar-SY", "ar-LB", "ar-JO", "ar-EG", "ar-SA", "ar-KW", "ar"];

export function isRecognitionSupported() {
  return getRecognitionCtor() !== null;
}

export interface VoiceCaptureState {
  status: "idle" | "requesting" | "listening" | "denied" | "unsupported" | "processing" | "error";
  finalText: string;
  interimText: string;
  errorMsg?: string;
  level: number; // 0..1 mic level for the pulse animation
  /** true when audio is recorded but the browser has no speech-to-text engine */
  noSTT?: boolean;
}

export interface CapturedAudio {
  base64: string;
  mimeType: string;
  durationMs: number;
}

/**
 * Runs the browser's real speech recognizer AND a MediaRecorder at the same time,
 * so we get both the transcript and the original voice for later replay in the Inbox.
 */
export function useVoiceCapture({
  lang = "ar",
  onLevel,
  onAudio,
}: {
  lang?: string;
  onLevel?: (l: number) => void;
  onAudio?: (audio: CapturedAudio) => void;
}) {
  const onAudioRef = useRef(onAudio);
  onAudioRef.current = onAudio;
  const [state, setState] = useState<VoiceCaptureState>({
    status: "idle",
    finalText: "",
    interimText: "",
    level: 0,
  });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const analyserRef = useRef<{ raf: number; ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const startedAtRef = useRef<number>(0);
  const audioRef = useRef<CapturedAudio | null>(null);
  const stoppedByUserRef = useRef(false);

  const cleanupAudioGraph = useCallback(() => {
    if (analyserRef.current) {
      cancelAnimationFrame(analyserRef.current.raf);
      void analyserRef.current.ctx.close().catch(() => undefined);
      analyserRef.current = null;
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    cleanupAudioGraph();
    setState((s) => ({ ...s, level: 0 }));
    onLevel?.(0);
  }, [cleanupAudioGraph, onLevel]);

  const startLevelMeter = useCallback(
    (stream: MediaStream) => {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
          const level = Math.min(1, peak * 2.2);
          setState((s) => ({ ...s, level }));
          onLevel?.(level);
          analyserRef.current!.raf = requestAnimationFrame(tick);
        };
        analyserRef.current = { raf: requestAnimationFrame(tick), ctx, analyser };
      } catch {
        /* meter is cosmetic only */
      }
    },
    [onLevel],
  );

  const start = useCallback(async () => {
    audioRef.current = null;
    chunksRef.current = [];
    stoppedByUserRef.current = false;
    setState({ status: "requesting", finalText: "", interimText: "", level: 0 });

    const mic = await requestMicrophone();
    if (mic.state !== "granted" || !mic.stream) {
      setState((s) => ({ ...s, status: mic.state === "unsupported" ? "unsupported" : "denied", level: 0 }));
      return;
    }
    const stream = mic.stream;
    startedAtRef.current = Date.now();

    // 1) keep the raw voice so the user can replay it later from the Inbox
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const buf = await blob.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buf);
          const CH = 0x8000;
          for (let i = 0; i < bytes.length; i += CH) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as unknown as number[]);
          }
          const captured: CapturedAudio = {
            base64: btoa(binary),
            mimeType: blob.type || "audio/webm",
            durationMs: Date.now() - startedAtRef.current,
          };
          audioRef.current = captured;
          onAudioRef.current?.(captured);
        }
        stream.getTracks().forEach((t) => t.stop());
        stopLevelMeter();
        setState((s) => ({ ...s, status: "idle", level: 0 }));
      };
      recorder.start(250);
      recorderRef.current = recorder;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
    }

    // 2) real speech-to-text
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      // No speech engine here: still record the voice for the Inbox, the user types the text.
      if (recorderRef.current) {
        setState((s) => ({ ...s, status: "listening", noSTT: true }));
        return;
      }
      setState((s) => ({ ...s, status: "unsupported", noSTT: true }));
      stopLevelMeter();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setState((s) => ({ ...s, status: "listening" }));
    recognition.onresult = (event: SREvent) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res?.[0]?.transcript ?? "";
        if (res?.isFinal) finalChunk += `${txt.trim()} `;
        else interim += txt;
      }
      setState((s) => ({
        ...s,
        finalText: s.finalText + finalChunk,
        interimText: interim.trim(),
        status: "listening",
      }));
    };
    recognition.onerror = (e) => {
      const code = e?.error ?? "unknown";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setState((s) => ({ ...s, status: "denied", errorMsg: code }));
      } else if (code === "no-speech") {
        setState((s) => ({ ...s, errorMsg: code }));
      } else if (code === "language-not-supported") {
        // retry with plain Arabic
        try {
          recognition.lang = "ar";
          recognition.start();
        } catch {
          setState((s) => ({ ...s, status: "error", errorMsg: code }));
        }
      } else {
        setState((s) => ({ ...s, errorMsg: code }));
      }
    };
    recognition.onend = () => {
      // Chrome ends recognition after silence; keep listening until the user stops.
      if (!stoppedByUserRef.current && recorderRef.current?.state === "recording") {
        try {
          recognition.start();
          return;
        } catch {
          /* already started */
        }
      }
      setState((s) => ({ ...s, interimText: "", status: s.status === "listening" ? "processing" : s.status }));
    };

    recognitionRef.current = recognition;
    startLevelMeter(stream);
    try {
      recognition.start();
    } catch {
      setState((s) => ({ ...s, status: "error", errorMsg: "start-failed" }));
    }
  }, [lang, startLevelMeter, stopLevelMeter]);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {
      /* noop */
    }
    setState((s) => ({ ...s, interimText: "", status: "processing" }));
  }, []);

  const takeAudio = useCallback((): CapturedAudio | null => {
    const a = audioRef.current;
    audioRef.current = null;
    return a;
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", finalText: "", interimText: "", level: 0 });
  }, []);

  useEffect(
    () => () => {
      stoppedByUserRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      try {
        recorderRef.current?.state === "recording" && recorderRef.current.stop();
      } catch {
        /* noop */
      }
      cleanupAudioGraph();
    },
    [cleanupAudioGraph],
  );

  return { ...state, start, stop, reset, takeAudio };
}

/* ------------------------------------------------------------------ */
/* Speech synthesis (real voices installed on the device)              */
/* ------------------------------------------------------------------ */

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

export function rankArabicVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const ar = voices.filter((v) => v.lang?.toLowerCase().startsWith("ar"));
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang?.toLowerCase() ?? "";
    let s = 0;
    if (lang === "ar-sy") s += 100;
    else if (["ar-lb", "ar-jo", "ar-ps"].includes(lang)) s += 70;
    else if (["ar-eg", "ar-sa", "ar-ae", "ar-kw"].includes(lang)) s += 50;
    else if (lang.startsWith("ar")) s += 30;
    if (/google/i.test(v.name)) s += 25; // Chrome's network Arabic voice is the most natural
    if (/natural|neural|premium|enhanced/i.test(v.name)) s += 20;
    if (!v.localService) s += 8;
    if (v.default) s += 4;
    return s;
  };
  return [...ar].sort((a, b) => score(b) - score(a));
}

export function useSpeechVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [arabicVoices, setArabicVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const s = synth();
    if (!s) return;
    setSupported(true);
    const load = () => {
      const all = s.getVoices();
      setVoices(all);
      setArabicVoices(rankArabicVoices(all));
    };
    load();
    s.addEventListener("voiceschanged", load);
    const timer = window.setTimeout(load, 400);
    return () => {
      s.removeEventListener("voiceschanged", load);
      window.clearTimeout(timer);
    };
  }, []);

  return { voices, arabicVoices, supported };
}

export function useSpeechOutput() {
  const { arabicVoices, voices, supported } = useSpeechVoices();
  const [speaking, setSpeaking] = useState(false);

  const pick = useCallback(
    (voiceUri?: string | null) => {
      if (voiceUri) {
        const found = voices.find((v) => v.voiceURI === voiceUri);
        if (found) return found;
      }
      return arabicVoices[0] ?? null;
    },
    [arabicVoices, voices],
  );

  const speak = useCallback(
    (text: string, opts?: { voiceUri?: string | null; rate?: number; pitch?: number; lang?: string }) => {
      const s = synth();
      if (!s || !text.trim()) return;
      s.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pick(opts?.voiceUri);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = opts?.lang ?? "ar-SY";
      }
      utter.rate = opts?.rate ?? 1;
      utter.pitch = opts?.pitch ?? 1;
      utter.volume = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      s.speak(utter);
    },
    [pick],
  );

  const cancel = useCallback(() => {
    synth()?.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => () => synth()?.cancel(), []);

  return { speak, cancel, speaking, supported, arabicVoices, voices };
}
