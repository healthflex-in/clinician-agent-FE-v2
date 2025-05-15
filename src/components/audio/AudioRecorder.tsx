
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { encodeWAV, getUserMedia, resampleAudio } from '@/utils/audio';
import { useTheme } from '@/styles/theme-provider';

interface AudioRecorderProps {
  onAudioEncoded: (base64Audio: string) => void;
  isProcessing: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onAudioEncoded, 
  isProcessing,
  size = 'md',
  label
}) => {
  const [state, setState] = useState<'inactive' | 'recording' | 'paused'>('inactive');
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const { toast } = useToast();
  const theme = useTheme();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<(() => void) | null>(null);
  
  // Determine button size based on prop
  const buttonSize = {
    sm: { width: '40px', height: '40px', fontSize: '0.875rem' },
    md: { width: '54px', height: '54px', fontSize: '1rem' },
    lg: { width: '64px', height: '64px', fontSize: '1.125rem' }
  }[size];
  
  // Handle permission request
  const requestPermission = useCallback(async () => {
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
    } catch (err) {
      console.error('Error getting audio permission:', err);
      setIsPermissionGranted(false);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record audio."
      });
    } finally {
      setIsRequestingPermission(false);
    }
  }, [toast]);

  // Audio processing method
  const processAudioData = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    
    try {
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
        variant: "destructive",
        title: "Audio Processing Error",
        description: "Failed to process audio data."
      });
    }
  }, [onAudioEncoded, toast]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current || !analyserRef.current) return;
    
    chunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
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
    
    // Start silence detector
    if (analyserRef.current) {
      // Implementation of detectSilence is available in the audio.ts utility
      // This will stop recording after 5 seconds of silence
      // silenceDetectorRef.current = detectSilence(analyserRef.current, -45, () => {
      //   if (mediaRecorderRef.current?.state === 'recording') {
      //     pauseRecording();
      //   }
      // }, 5000);
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
    
    // Clear silence detector
    if (silenceDetectorRef.current) {
      silenceDetectorRef.current();
      silenceDetectorRef.current = null;
    }
    
    setState('paused');
  }, []);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (state === 'inactive' || state === 'paused') {
      startRecording();
    } else if (state === 'recording') {
      pauseRecording();
    }
  }, [state, startRecording, pauseRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (silenceDetectorRef.current) {
        silenceDetectorRef.current();
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      {isPermissionGranted === null ? (
        <Button
          onClick={requestPermission}
          disabled={isRequestingPermission}
          className={`rounded-full bg-primary hover:bg-primary-dark text-white`}
          style={{ width: buttonSize.width, height: buttonSize.height }}
        >
          {isRequestingPermission ? (
            <Loader className="h-5 w-5 animate-spin" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      ) : !isPermissionGranted ? (
        <Button
          onClick={requestPermission}
          className={`rounded-full bg-destructive hover:bg-destructive/90 text-white`}
          style={{ width: buttonSize.width, height: buttonSize.height }}
        >
          <MicOff className="h-5 w-5" />
        </Button>
      ) : (
        <div className="relative">
          {state === 'recording' && (
            <span className="absolute -inset-2 rounded-full bg-primary-light/20 animate-pulse-ring"></span>
          )}
          <Button
            onClick={toggleRecording}
            disabled={isProcessing}
            className={`rounded-full transition-all duration-300 ease-in-out
              ${state === 'recording' 
                ? 'bg-secondary hover:bg-secondary-dark animate-bounce-soft' 
                : 'bg-primary hover:bg-primary-dark'}`}
            style={{ width: buttonSize.width, height: buttonSize.height }}
          >
            {isProcessing ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : state === 'recording' ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}
      
      {label && (
        <div className="text-sm mt-2 text-center font-medium">
          {isRequestingPermission && 'Requesting mic access...'}
          {isPermissionGranted === false && 'Microphone access denied'}
          {state === 'inactive' && isPermissionGranted && label}
          {state === 'recording' && 'Recording... (tap to stop)'}
          {state === 'paused' && 'Paused (tap to resume)'}
          {isProcessing && 'Processing audio...'}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
