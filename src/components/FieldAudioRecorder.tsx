// FieldAudioRecorder.tsx
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';

interface FieldAudioRecorderProps {
  onAudioRecorded: (audioBase64: string, fieldPath: string) => void;
  fieldPath: string;
  isDisabled?: boolean;
}

const FieldAudioRecorder: React.FC<FieldAudioRecorderProps> = ({
  onAudioRecorded,
  fieldPath,
  isDisabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );

  const startRecording = useCallback(async () => {
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
            // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
            const base64Audio = (reader.result as string).split(',')[1];
            onAudioRecorded(base64Audio, fieldPath);
            setIsProcessing(false);
          }
        };

        reader.readAsDataURL(audioBlob);

        // Stop all tracks on the stream to release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }, [onAudioRecorded, fieldPath]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 w-8 p-0 rounded-full"
      onClick={handleClick}
      disabled={isDisabled || isProcessing}
      title={isRecording ? 'Stop recording' : 'Record audio for this section'}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <StopCircle className="h-4 w-4 text-red-500" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      <span className="sr-only">
        {isRecording ? 'Stop recording' : 'Record audio'}
      </span>
    </Button>
  );
};

export default FieldAudioRecorder;
