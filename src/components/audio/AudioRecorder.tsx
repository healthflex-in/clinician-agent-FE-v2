import React from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';

import {
  encodeWAV,
  getUserMedia,
  detectSilence,
} from '@/utils/audio';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface RecorderProps {
  label?: string;
  isDisabled?: boolean;
  isProcessing: boolean;
  size?: 'sm' | 'md' | 'lg';

  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onAudioEncoded: (base64Audio: string) => void;
}

type RecorderState = 'inactive' | 'recording' | 'paused';

export const Recorder: React.FC<RecorderProps> = ({
  label,
  size = 'md',
  isProcessing,
  onAudioEncoded,
  onRecordingStart,
  onRecordingStop,
  isDisabled = false,
}) => {
  const { toast } = useToast();

  const [state, setState] = React.useState<RecorderState>('inactive');
  const [isRequestingPermission, setIsRequestingPermission] = React.useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = React.useState<boolean | null>(null);

  const chunksRef = React.useRef<Blob[]>([]);
  const isProcessingAudioRef = React.useRef(false);
  const streamRef = React.useRef<MediaStream | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const silenceDetectorRef = React.useRef<(() => void) | null>(null);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-12 h-12'; // Smaller button
      case 'lg':
        return 'w-20 h-20'; // Larger button
      default:
        return 'w-16 h-16'; // Default (md)
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-4 w-4';
      case 'lg':
        return 'h-8 w-8';
      default:
        return 'h-6 w-6';
    }
  };

  // Handle permission request
  const requestPermission = React.useCallback(async () => {
    if (isRequestingPermission) return;
    
    setIsRequestingPermission(true);
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

      setIsPermissionGranted(true);
      console.log('Microphone permission granted');
    } catch (err) {
      console.error('Error getting audio permission:', err);
      setIsPermissionGranted(false);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please allow microphone access to record audio.',
      });
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRequestingPermission, toast]);

  // Process audio data
  const processAudioData = React.useCallback(async () => {
    if (chunksRef.current.length === 0 || isProcessingAudioRef.current) {
      console.log('No audio chunks or already processing');
      return;
    }

    isProcessingAudioRef.current = true;
    console.log('Processing audio data...');

    try {
      // Create a blob from the audio chunks
      const originalBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];

      // Convert blob to ArrayBuffer
      const arrayBuffer = await originalBlob.arrayBuffer();

      // Decode audio data
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create offline context for resampling to 16kHz
      const offlineContext = new OfflineAudioContext(
        1, // mono
        Math.floor(audioBuffer.duration * 16000), // target sample rate
        16000 // target sample rate
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);

      const renderedBuffer = await offlineContext.startRendering();

      // Encode as WAV
      const wavBlob = encodeWAV(renderedBuffer);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        console.log('Audio processed successfully');
        onAudioEncoded(base64Audio);
        isProcessingAudioRef.current = false;
      };
      reader.onerror = () => {
        console.error('Error reading audio blob');
        isProcessingAudioRef.current = false;
      };
      reader.readAsDataURL(wavBlob);

    } catch (err) {
      console.error('Error processing audio:', err);
      isProcessingAudioRef.current = false;
      toast({
        variant: 'destructive',
        title: 'Audio Processing Error',
        description: 'Failed to process audio data.',
      });
    }
  }, [onAudioEncoded, toast]);

  // Start recording
  const startRecording = React.useCallback(async () => {
    if (!streamRef.current || !analyserRef.current) {
      console.error('Stream or analyser not available');
      return;
    }

    // Ensure audio context is running
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    chunksRef.current = [];

    try {
      // Check if MediaRecorder supports the preferred format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Use default
        }
      }

      const mediaRecorder = new MediaRecorder(streamRef.current, 
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        console.log('Data available:', e.data.size);
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped');
        await processAudioData();
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setState('inactive');
      };

      // Start silence detection
      if (analyserRef.current) {
        silenceDetectorRef.current = detectSilence(
          analyserRef.current,
          -45, // Silence threshold in dB
          () => {
            console.log('Silence detected, stopping recording');
            if (mediaRecorderRef.current?.state === 'recording') {
              stopRecording();
            }
          },
          3000 // 3 seconds of silence
        );
      }

      mediaRecorder.start(100); // Record in 100ms chunks
      setState('recording');

      if (onRecordingStart) {
        onRecordingStart();
      }

      console.log('Recording started');
    } catch (err) {
      console.error('Error starting recording:', err);
      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: 'Failed to start recording.',
      });
    }
  }, [processAudioData, toast, onRecordingStart]);

  // Stop recording
  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Clear silence detector
    if (silenceDetectorRef.current) {
      silenceDetectorRef.current();
      silenceDetectorRef.current = null;
    }

    setState('paused');

    if (onRecordingStop) {
      onRecordingStop();
    }
  }, []);

  // Handle single click to toggle recording
  const handleRecordingClick = React.useCallback(async () => {
    console.log('Recording button clicked, current state:', state);

    if (isDisabled) {
      console.log('Recorder is disabled, ignoring click');
      return;
    }
    
    // Prevent multiple rapid clicks
    if (isProcessing || isProcessingAudioRef.current) {
      console.log('Already processing, ignoring click');
      return;
    }

    // If permission not granted, request it first
    if (!isPermissionGranted) {
      await requestPermission();
      return;
    }

    // Toggle recording state
    if (state === 'inactive' || state === 'paused') {
      await startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }, [state, isPermissionGranted, isProcessing, isDisabled, requestPermission, startRecording, stopRecording]);

  // Initialize on mount
  React.useEffect(() => {
    // Check if the browser supports audio recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported',
        description: "Your browser doesn't support audio recording.",
      });
      return;
    }

    // Check for existing permission and auto-initialize if granted
    const checkExistingPermission = async () => {
      try {
        const result = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
        if (result?.state === 'granted' && isPermissionGranted === null) {
          // Auto-initialize if permission already granted
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

            setIsPermissionGranted(true);
            console.log('Auto-initialized microphone permission');
          } catch (err) {
            console.error('Error auto-initializing microphone:', err);
            setIsPermissionGranted(false);
          }
        }
      } catch (err) {
        // Permission API not supported, that's okay
        console.log('Permission API not supported');
      }
    };

    checkExistingPermission();
  }, [toast]); // Only depend on toast

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (silenceDetectorRef.current) {
        silenceDetectorRef.current();
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Determine button state and styling
  const getButtonState = () => {
    if (isProcessing || isProcessingAudioRef.current) {
      return { icon: Loader, className: 'bg-gray-500', spinning: true };
    }
    
    if (isPermissionGranted === false) {
      return { icon: MicOff, className: 'bg-red-500 hover:bg-red-600' };
    }
    
    if (state === 'recording') {
      return { icon: MicOff, className: 'bg-red-600 hover:bg-red-700 animate-pulse' };
    }
    
    return { icon: Mic, className: 'bg-green-500 hover:bg-green-600' };
  };

  const { icon: IconComponent, className: buttonClassName, spinning } = getButtonState();

  // Determine status text
  const getStatusText = () => {
    if (isRequestingPermission) return 'Requesting mic access...';
    if (isPermissionGranted === false) return 'Microphone access denied - click to retry';
    if (isProcessing || isProcessingAudioRef.current) return 'Processing audio...';
    if (state === 'recording') return 'Recording... (click to stop)';
    if (state === 'paused') return 'Click to start new recording';
    if (isPermissionGranted) return 'Click to start recording';
    return 'Click to enable microphone';
  };

  return (
    <div className="flex flex-col items-center">
      {/* ADD: Optional label above button */}
      {label && (
        <div className="text-xs font-medium mb-2 text-center text-muted-foreground">
          {label}
        </div>
      )}
      
      <div className="relative">
        {state === 'recording' && !isDisabled && (
          <span className="absolute -inset-2 rounded-full bg-red-400/20 animate-ping"></span>
        )}
        <Button
          onClick={handleRecordingClick}
          disabled={isRequestingPermission || isDisabled}
          className={`${getSizeClasses()} rounded-full transition-all duration-300 ease-in-out ${buttonClassName} ${
            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <IconComponent className={`${getIconSize()} ${spinning ? 'animate-spin' : ''}`}/>
        </Button>
      </div>

      <div className="text-sm mt-2 text-center font-medium max-w-xs">
        {isDisabled ? 'Recording disabled' : getStatusText()}
      </div>
    </div>
  );
};

export default Recorder;