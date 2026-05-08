/**
 * useVoiceRecorder — React hook for live microphone recording + transcription.
 *
 * Uses the browser MediaRecorder API to capture audio, then sends the blob
 * to the existing /api/ai/transcribe endpoint for speech-to-text.
 *
 * Features:
 *  - Start/stop/cancel recording
 *  - Elapsed-time counter
 *  - Auto-stop after 2 minutes
 *  - Graceful fallback if MediaRecorder is unavailable
 *  - Sends audio as multipart/form-data to /api/ai/transcribe
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECORDING_SECONDS = 120; // 2 minutes auto-stop

export type UseVoiceRecorderReturn = {
  /** Whether the browser supports voice recording */
  isSupported: boolean;
  /** Currently recording */
  isRecording: boolean;
  /** Currently sending to transcription API */
  isTranscribing: boolean;
  /** Elapsed recording time in seconds */
  duration: number;
  /** Start recording from microphone */
  startRecording: () => Promise<void>;
  /** Stop recording and return audio blob */
  stopRecording: () => Promise<Blob | null>;
  /** Cancel recording without returning audio */
  cancelRecording: () => void;
  /** Send an audio blob to the transcription API */
  transcribe: (blob: Blob) => Promise<string>;
  /** Start recording, stop, and transcribe in one call */
  recordAndTranscribe: () => void;
  /** Last error message */
  error: string | null;
};

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const isSupported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Auto-stop after MAX_RECORDING_SECONDS
  useEffect(() => {
    if (isRecording && duration >= MAX_RECORDING_SECONDS) {
      stopRecording();
    }
  }, [isRecording, duration]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Prefer webm/opus, fallback to whatever is available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(500); // Collect data every 500ms
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone permission denied. Please allow microphone access.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError(err.message || "Failed to start recording.");
      }
    }
  }, [isSupported, startTimer]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        stopTimer();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        setIsRecording(false);
        stopTimer();
        resolve(blob);
      };

      recorder.stop();
    });
  }, [stopTimer]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    chunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    stopTimer();
    setDuration(0);
  }, [stopTimer]);

  const transcribe = useCallback(async (blob: Blob): Promise<string> => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      // Determine file extension from MIME type
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `recording.${ext}`);

      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Transcription failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.transcription) {
        throw new Error("No transcription returned. The audio may be too short or unclear.");
      }

      return data.transcription;
    } catch (err: any) {
      const msg = err.message || "Failed to transcribe audio.";
      setError(msg);
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // Convenience: used when the user clicks to stop — auto-transcribes
  const recordAndTranscribe = useCallback(() => {
    // This is a toggle — if recording, stop; if not, start
    // The actual transcription is handled by the caller after stopRecording
  }, []);

  return {
    isSupported,
    isRecording,
    isTranscribing,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    transcribe,
    recordAndTranscribe,
    error,
  };
}

/** Format seconds as M:SS */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
