import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';

interface FieldAudioRecorderProps {
  fieldPath: string;
  isDisabled?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onAudioRecorded: (audioBase64: string, fieldPath: string) => void;
}

export const FieldAudioRecorder: React.FC<FieldAudioRecorderProps> = ({
  fieldPath,
  onAudioRecorded,
  isDisabled = false,
  onRecordingStart,
  onRecordingStop,
}) => {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null);

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      const audioChunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };

      recorder.onstop = async () => {
        setIsProcessing(true);
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const reader = new FileReader();

        reader.onload = () => {
          if (reader.result) {
            const base64Audio = (reader.result as string).split(',')[1];
            
            onAudioRecorded(base64Audio, fieldPath);
            setIsProcessing(false);
            
            // FIXED: Call onRecordingStop AFTER audio is processed
            if (onRecordingStop) {
              onRecordingStop();
            }
          }
        };

        // Stop all tracks on the stream to release the microphone
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // FIXED: Call onRecordingStart when recording actually starts
      if (onRecordingStart) {
        console.log(`=== NOTIFYING RECORDING START: ${fieldPath} ===`);
        onRecordingStart();
      }
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
      
      // FIXED: Reset states on error
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [onAudioRecorded, fieldPath, onRecordingStart, onRecordingStop]); // ADD: Include new deps

  const stopRecording = React.useCallback(() => {
    if (mediaRecorder && isRecording) {
      console.log(`=== STOPPING RECORDING: ${fieldPath} ===`);
      mediaRecorder.stop();
      setIsRecording(false);
      // Note: onRecordingStop will be called in the onstop handler after audio processing
    }
  }, [mediaRecorder, isRecording, fieldPath]);

  const handleClick = React.useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // FIXED: Cleanup on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      className={`h-8 w-8 p-0 rounded-full ${
        isRecording ? 'bg-red-50 border-red-300' : ''
      }`} // ADD: Visual feedback when recording
      disabled={isDisabled || isProcessing}
      title={
        isProcessing 
          ? 'Processing audio...'
          : isRecording 
          ? 'Stop recording' 
          : 'Record audio for this section'
      }
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <StopCircle className="h-4 w-4 text-red-500 animate-pulse" /> // ADD: Pulse animation
      ) : (
        <Mic className="h-4 w-4" />
      )}
      <span className="sr-only">
        {isProcessing 
          ? 'Processing audio'
          : isRecording 
          ? 'Stop recording' 
          : 'Record audio'
        }
      </span>
    </Button>
  );
};

export default FieldAudioRecorder;
