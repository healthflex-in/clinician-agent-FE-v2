import React from 'react';

import AudioRecorder from './audio-recorder';
import { useToast } from '@/hooks/use-toast';

interface SectionAudioRecorderProps {
  label?: string;
  sectionId: string;
  isProcessing: boolean;
  size?: 'sm' | 'md' | 'lg';

  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onAudioEncoded: (base64Audio: string, sectionId: string) => void;
}

export const SectionAudioRecorder: React.FC<SectionAudioRecorderProps> = ({
  sectionId,
  size = 'sm',
  isProcessing,
  onAudioEncoded,
  onRecordingStart,
  onRecordingStop,
  label = 'Record Section Audio',
}) => {
  const { toast } = useToast();

  const handleAudioEncoded = React.useCallback(
    (base64Audio: string) => {
      onAudioEncoded(base64Audio, sectionId);
    },
    [onAudioEncoded, sectionId]
  );

  return (
    <div className="flex flex-col items-center">
      <AudioRecorder
        size={size}
        label={label}
        isProcessing={isProcessing}
        onRecordingStop={onRecordingStop}
        onRecordingStart={onRecordingStart}
        onAudioEncoded={handleAudioEncoded}
      />
    </div>
  );
};

export default SectionAudioRecorder;
