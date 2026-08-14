'use client';

import { useState, useRef, useCallback } from 'react';

export interface UseAudioIOReturn {
  isCapturing: boolean;
  isMicPermissionDenied: boolean;
  frequencyData: Uint8Array | null;
  startCapture: (
    onChunk: (base64Pcm: string) => void,
    onSpeechRecognized?: (transcript: string) => void
  ) => Promise<void>;
  stopCapture: () => void;
  playAudioChunk: (base64Pcm: string, sampleRate?: number) => void;
  stopPlayback: () => void;
  resetSpeechState: () => void;
}

export function useAudioIO(): UseAudioIOReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMicPermissionDenied, setIsMicPermissionDenied] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const nextScheduledTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const onSpeechRecognizedRef = useRef<((text: string) => void) | undefined>(undefined);
  const onChunkRef = useRef<((base64: string) => void) | undefined>(undefined);
  const lastRecognizedTextRef = useRef<string>('');
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCapturingRef = useRef<boolean>(false);

  // Helper: Convert Float32Array to 16-bit PCM ArrayBuffer
  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Helper: ArrayBuffer to base64 string
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Helper: base64 string to Float32Array (normalized 16-bit PCM)
  const base64ToFloat32PCM = (base64: string): Float32Array => {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const dataView = new DataView(bytes.buffer);
    const numSamples = Math.floor(len / 2);
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      float32[i] = int16 / (int16 < 0 ? 32768 : 32767);
    }
    return float32;
  };

  const resetSpeechState = useCallback(() => {
    lastRecognizedTextRef.current = '';
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
  }, []);

  // Start Continuous Mic Capture + Self-Healing Speech Recognition
  const startCapture = useCallback(
    async (
      onChunk: (base64Pcm: string) => void,
      onSpeechRecognized?: (transcript: string) => void
    ) => {
      onChunkRef.current = onChunk;
      onSpeechRecognizedRef.current = onSpeechRecognized;

      if (isCapturingRef.current) return;

      try {
        setIsMicPermissionDenied(false);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        source.connect(analyser);

        // Animation loop for frequency data
        const freqArray = new Uint8Array(analyser.frequencyBinCount);
        const updateFreq = () => {
          if (analyserRef.current && isCapturingRef.current) {
            analyserRef.current.getByteFrequencyData(freqArray);
            setFrequencyData(new Uint8Array(freqArray));
            animFrameRef.current = requestAnimationFrame(updateFreq);
          }
        };

        // ScriptProcessorNode for audio chunking
        const scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
        scriptNodeRef.current = scriptNode;

        scriptNode.onaudioprocess = (e) => {
          if (!isCapturingRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcm16);
          if (onChunkRef.current) {
            onChunkRef.current(base64);
          }
        };

        source.connect(scriptNode);
        scriptNode.connect(audioCtx.destination);

        isCapturingRef.current = true;
        setIsCapturing(true);
        updateFreq();

        // Continuous Self-Restarting Web Speech Recognition
        if (typeof window !== 'undefined') {
          const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognition) {
            const initRecognition = () => {
              if (!isCapturingRef.current) return;
              try {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                  let finalTranscript = '';
                  for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                      finalTranscript += event.results[i][0].transcript;
                    }
                  }

                  const clean = finalTranscript.trim();
                  if (clean && clean !== lastRecognizedTextRef.current) {
                    lastRecognizedTextRef.current = clean;
                    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
                    speechDebounceTimerRef.current = setTimeout(() => {
                      if (onSpeechRecognizedRef.current) {
                        onSpeechRecognizedRef.current(clean);
                      }
                      // Reset lastRecognizedText after 1.5s so next query can be heard immediately
                      setTimeout(() => {
                        lastRecognizedTextRef.current = '';
                      }, 1500);
                    }, 350);
                  }
                };

                recognition.onerror = (event: any) => {
                  if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.warn('Speech recognition notice:', event.error);
                  }
                };

                recognition.onend = () => {
                  if (isCapturingRef.current) {
                    setTimeout(() => {
                      initRecognition();
                    }, 100);
                  }
                };

                recognition.start();
                recognitionRef.current = recognition;
              } catch (e) {
                console.warn('Recognition init notice:', e);
              }
            };

            initRecognition();
          }
        }
      } catch (err: any) {
        console.error('Mic capture error:', err);
        setIsMicPermissionDenied(true);
      }
    },
    []
  );

  // Stop Mic Capture
  const stopCapture = useCallback(() => {
    isCapturingRef.current = false;
    setIsCapturing(false);
    setFrequencyData(null);

    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  // Audio Playback
  const playAudioChunk = useCallback(
    (base64Pcm: string, sampleRate = 24000) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
          playbackCtxRef.current = new AudioCtx({ sampleRate });
          nextScheduledTimeRef.current = playbackCtxRef.current.currentTime;
        }

        const ctx = playbackCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const float32 = base64ToFloat32PCM(base64Pcm);
        const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
        audioBuffer.getChannelData(0).set(float32);

        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(ctx.destination);

        const startTime = Math.max(ctx.currentTime, nextScheduledTimeRef.current);
        sourceNode.start(startTime);
        nextScheduledTimeRef.current = startTime + audioBuffer.duration;
      } catch (err) {
        console.error('Audio playback error:', err);
      }
    },
    []
  );

  // Stop Playback
  const stopPlayback = useCallback(() => {
    if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    nextScheduledTimeRef.current = 0;
  }, []);

  return {
    isCapturing,
    isMicPermissionDenied,
    frequencyData,
    startCapture,
    stopCapture,
    playAudioChunk,
    stopPlayback,
    resetSpeechState,
  };
}
