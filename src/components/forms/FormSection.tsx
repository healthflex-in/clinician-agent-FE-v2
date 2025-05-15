
import React, { useState } from 'react';
import AudioRecorder from '../audio/AudioRecorder';
import TranscriptionBox from '../audio/TranscriptionBox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  onAudioEncoded?: (base64Audio: string, sectionId: string) => void;
  onTranscriptProcess?: (text: string, sectionId: string) => void;
  isProcessing?: boolean;
  sectionId: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (sectionId: string, selected: boolean) => void;
  showAudioControls?: boolean;
}

const FormSection: React.FC<FormSectionProps> = ({
  title,
  children,
  onAudioEncoded,
  onTranscriptProcess,
  isProcessing = false,
  sectionId,
  selectable = false,
  selected = false,
  onSelectChange,
  showAudioControls = true
}) => {
  const [transcription, setTranscription] = useState('');

  const handleAudioEncoded = (base64Audio: string) => {
    if (onAudioEncoded) {
      onAudioEncoded(base64Audio, sectionId);
    }
  };

  const handleTranscriptProcess = () => {
    if (onTranscriptProcess && transcription.trim()) {
      onTranscriptProcess(transcription, sectionId);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectable && (
              <Checkbox 
                checked={selected}
                onCheckedChange={(checked) => {
                  if (onSelectChange) onSelectChange(sectionId, checked === true);
                }}
                id={`section-checkbox-${sectionId}`}
              />
            )}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          
          {showAudioControls && (
            <div className="flex items-center gap-2">
              <AudioRecorder 
                onAudioEncoded={handleAudioEncoded}
                isProcessing={isProcessing}
                size="sm"
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {showAudioControls && (
          <div className="mb-4">
            <TranscriptionBox
              value={transcription}
              onChange={setTranscription}
              isProcessing={isProcessing}
              autoProcess={handleTranscriptProcess}
              autoProcessDelay={5000}
              label={`${title} Transcription`}
              placeholder={`Enter ${title.toLowerCase()} details here...`}
            />
          </div>
        )}
        
        <div className="form-fields">
          {children}
        </div>
      </CardContent>
    </Card>
  );
};

export default FormSection;
