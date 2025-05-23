import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader, AlertTriangle } from 'lucide-react';
import { encodeWAV, detectSilence, getUserMedia } from '@/utils/audio';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RecorderProps {
  onAudioEncoded: (base64Audio: string) => void;
  isProcessing: boolean;
}

type RecorderState = 'inactive' | 'recording' | 'paused';

const Recorder: React.FC<RecorderProps> = ({
  onAudioEncoded,
  isProcessing,
}) => {
  const [state, setState] = useState<RecorderState>('inactive');
  const { toast } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<(() => void) | null>(null);

  // Process audio data from recorded chunks
  const processAudioData = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    try {
      const originalBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];

      const reader = new FileReader();

      return new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const offlineContext = new OfflineAudioContext(
              1,
              audioBuffer.duration * 16000,
              16000
            );

            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0);

            const renderedBuffer = await offlineContext.startRendering();

            const wavBlob = encodeWAV(renderedBuffer);

            const base64Audio = await new Promise<string>((resolveBase64) => {
              const reader2 = new FileReader();
              reader2.onloadend = () => {
                resolveBase64(reader2.result as string);
              };
              reader2.readAsDataURL(wavBlob);
            });

            onAudioEncoded(base64Audio);
            resolve();
          } catch (err) {
            console.error('Error processing audio:', err);
            reject(err);
          }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(originalBlob);
      });
    } catch (err) {
      console.error('Error processing audio:', err);
      toast({
        variant: 'destructive',
        title: 'Audio Processing Error',
        description: 'Failed to process audio data.',
      });
    }
  }, [onAudioEncoded, toast]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      try {
        const stream = await getUserMedia();
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;

        source.connect(analyser);
        analyserRef.current = analyser;
      } catch (err) {
        console.error('Error setting up audio:', err);
        toast({
          variant: 'destructive',
          title: 'Microphone Access Error',
          description:
            'Failed to access microphone. Please check your device and browser settings.',
        });
        return;
      }
    }

    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(streamRef.current!);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        await processAudioData();
      } catch (err) {
        console.error('Error handling recorded audio:', err);
      }
    };

    if (analyserRef.current) {
      silenceDetectorRef.current = detectSilence(
        analyserRef.current,
        -45,
        () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            pauseRecording();
          }
        },
        5000
      );
    }

    mediaRecorder.start();
    setState('recording');
  }, [processAudioData]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (silenceDetectorRef.current) {
      silenceDetectorRef.current();
      silenceDetectorRef.current = null;
    }

    setState('paused');
  }, []);

  // Toggle recording state
  const toggleRecording = useCallback(() => {
    if (state === 'inactive' || state === 'paused') {
      startRecording();
    } else if (state === 'recording') {
      pauseRecording();
    }
  }, [state, startRecording, pauseRecording]);

  // Generate and store userId and appointmentId if not exist
  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem(
        'userId',
        `user-${Math.random().toString(36).substring(2, 9)}`
      );
    }

    if (!localStorage.getItem('appointmentId')) {
      localStorage.setItem(
        'appointmentId',
        `apt-${Math.random().toString(36).substring(2, 9)}`
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceDetectorRef.current) {
        silenceDetectorRef.current();
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === 'recording'
      ) {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <>
      <div className="flex flex-col items-center">
        <div className="relative">
          {state === 'recording' && (
            <span className="absolute -inset-2 rounded-full bg-parrot-400/20 animate-pulse-ring"></span>
          )}
          <Button
            onClick={toggleRecording}
            disabled={isProcessing}
            className={`w-16 h-16 rounded-full transition-all duration-300 ease-in-out
              ${
                state === 'recording'
                  ? 'bg-parrot-600 hover:bg-parrot-700 animate-bounce-soft'
                  : 'bg-parrot-500 hover:bg-parrot-600'
              }`}
          >
            {isProcessing ? (
              <Loader className="h-6 w-6 animate-spin" />
            ) : state === 'recording' ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>

        <div className="text-sm mt-2 text-center font-medium">
          {state === 'inactive' && 'Tap to start recording'}
          {state === 'recording' && 'Recording... (tap to stop)'}
          {state === 'paused' && 'Paused (tap to resume)'}
          {isProcessing && 'Processing audio...'}
        </div>
      </div>
    </>
  );
};

export default Recorder;
