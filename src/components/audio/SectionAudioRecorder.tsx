
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AudioRecorder from './AudioRecorder';
import { themeColors } from '@/styles/theme';

interface SectionAudioRecorderProps {
  sectionId: string;
  isProcessing: boolean;
  onAudioEncoded: (base64Audio: string, sectionId: string) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SectionAudioRecorder: React.FC<SectionAudioRecorderProps> = ({
  sectionId,
  isProcessing,
  onAudioEncoded,
  label = 'Record Section Audio',
  size = 'sm',
}) => {
  const { toast } = useToast();

  const handleAudioEncoded = useCallback((base64Audio: string) => {
    onAudioEncoded(base64Audio, sectionId);
  }, [onAudioEncoded, sectionId]);

  return (
    <div className="flex flex-col items-center">
      <AudioRecorder
        onAudioEncoded={handleAudioEncoded}
        isProcessing={isProcessing}
        size={size}
        label={label}
      />
    </div>
  );
};

export default SectionAudioRecorder;
