import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import {
  encodeWAV,
  blobToBase64,
  detectSilence,
  getUserMedia,
  resampleAudio,
} from '@/utils/audio';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface RecorderProps {
  onAudioEncoded: (base64Audio: string) => void;
  isProcessing: boolean;
  isDisabled?: boolean; // NEW: Accept disabled state from parent
}

type RecorderState = 'inactive' | 'recording' | 'paused';

const Recorder: React.FC<RecorderProps> = ({
  onAudioEncoded,
  isProcessing,
  isDisabled = false, // NEW: Default to enabled
}) => {
  const [state, setState] = useState<RecorderState>('inactive');
  // REMOVED: Local permission management - parent handles this now
  const { toast } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<(() => void) | null>(null);

  // Initialize audio stream when component mounts (if not disabled)
  const initializeAudioStream = useCallback(async () => {
    if (isDisabled) return;

    try {
      const stream = await getUserMedia();
      streamRef.current = stream;

      // Create audio context and analyser
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

      console.log('Audio stream initialized successfully');
    } catch (err) {
      console.error('Error initializing audio stream:', err);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Error',
        description: 'Unable to access microphone for recording.',
      });
    }
  }, [isDisabled, toast]);

  // Initialize on mount or when disabled state changes
  useEffect(() => {
    if (!isDisabled) {
      initializeAudioStream();
    }

    return () => {
      // Clean up when disabled or unmounting
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isDisabled, initializeAudioStream]);

  // Improved audio processing method
  const processAudioData = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    try {
      console.log('Processing audio data...');
      // Create a blob from the audio chunks
      const originalBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];

      // Use FileReader to convert blob to ArrayBuffer
      const reader = new FileReader();

      // Return a promise that resolves when the audio is processed
      return new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;

            // Use offline AudioContext for resampling to 16kHz
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const offlineContext = new OfflineAudioContext(
              1, // mono
              audioBuffer.duration * 16000, // target sample rate
              16000 // target sample rate
            );

            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0);

            const renderedBuffer = await offlineContext.startRendering();

            // Encode as WAV
            const wavBlob = encodeWAV(renderedBuffer);

            // Convert to base64 with data URL prefix
            const base64Audio = await new Promise<string>((resolveBase64) => {
              const reader2 = new FileReader();
              reader2.onloadend = () => {
                const base64data = reader2.result as string;
                resolveBase64(base64data);
              };
              reader2.readAsDataURL(wavBlob);
            });

            console.log('Audio processing completed, calling onAudioEncoded');
            // Send to the parent component
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
  const startRecording = useCallback(() => {
    console.log('Starting recording...');
    console.log('Stream available:', !!streamRef.current);
    console.log('Analyser available:', !!analyserRef.current);

    if (!streamRef.current || !analyserRef.current) {
      console.error('Stream or analyser not available for recording');
      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: 'Microphone not ready. Please try again.',
      });
      return;
    }

    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('Recording stopped, processing audio...');
      try {
        await processAudioData();
        setState('paused'); // Set to paused after processing
      } catch (err) {
        console.error('Error handling recorded audio:', err);
        setState('inactive'); // Reset to inactive on error
      }
    };

    // Start the silence detector - stop recording after 5 seconds of silence
    if (analyserRef.current) {
      silenceDetectorRef.current = detectSilence(
        analyserRef.current,
        -45, // Silence threshold in dB
        () => {
          console.log('Silence detected, stopping recording');
          // This will be called when silence is detected for 5 seconds
          if (mediaRecorderRef.current?.state === 'recording') {
            pauseRecording();
          }
        },
        5000 // 5 seconds of silence
      );
    }

    mediaRecorder.start();
    setState('recording');
    console.log('Recording started successfully');
  }, [processAudioData, toast]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    console.log('Pausing recording...');
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Clear silence detector
    if (silenceDetectorRef.current) {
      silenceDetectorRef.current();
      silenceDetectorRef.current = null;
    }

    // Note: setState('paused') is called in mediaRecorder.onstop
  }, []);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    console.log('Toggle recording clicked');
    console.log('Current state:', state);
    console.log('Is disabled:', isDisabled);
    console.log('Is processing:', isProcessing);

    if (isDisabled || isProcessing) {
      console.log('Recording disabled or processing, ignoring click');
      return;
    }

    if (state === 'inactive' || state === 'paused') {
      startRecording();
    } else if (state === 'recording') {
      pauseRecording();
    }
  }, [state, startRecording, pauseRecording, isDisabled, isProcessing]);

  // Initialize localStorage IDs on mount
  useEffect(() => {
    // Check if the browser supports audio recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported',
        description: "Your browser doesn't support audio recording.",
      });
      return;
    }

    // Generate and store userId and appointmentId if they don't exist
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
  }, [toast]);

  // Clean up on unmount
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

  // Don't render anything if disabled
  if (isDisabled) {
    return (
      <div className="flex flex-col items-center">
        <Button
          disabled
          className="w-16 h-16 rounded-full bg-gray-400 text-white cursor-not-allowed"
        >
          <MicOff className="h-6 w-6" />
        </Button>
        <div className="text-sm mt-2 text-center font-medium text-gray-500">
          Recording disabled
        </div>
      </div>
    );
  }

  return (
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
  );
};

export default Recorder;
