
import React, { useState } from 'react';
import SectionAudioRecorder from '../audio/SectionAudioRecorder';
import SectionTranscriptionBox from './SectionTranscriptionBox';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Save, RefreshCw } from 'lucide-react';

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
  onSectionSubmit?: (sectionId: string) => void;
  onSectionReset?: (sectionId: string) => void;
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
  showAudioControls = true,
  onSectionSubmit,
  onSectionReset
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
    <Card className="mb-6 border border-border bg-card">
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
                className="h-4 w-4"
              />
            )}
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </div>
          
          {showAudioControls && (
            <div className="flex items-center gap-2">
              <SectionAudioRecorder 
                sectionId={sectionId}
                onAudioEncoded={handleAudioEncoded}
                isProcessing={isProcessing}
                size="sm"
                label={`Record for ${title}`}
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {showAudioControls && (
          <div className="mb-4">
            <SectionTranscriptionBox
              value={transcription}
              onChange={setTranscription}
              isProcessing={isProcessing}
              onProcess={handleTranscriptProcess}
              autoProcess={true}
              autoProcessDelay={5000}
              sectionId={sectionId}
              label={`${title} Transcription`}
              placeholder={`Enter ${title.toLowerCase()} details here...`}
            />
          </div>
        )}
        
        <div className="form-fields">
          {children}
        </div>
      </CardContent>

      {(onSectionSubmit || onSectionReset) && (
        <CardFooter className="flex justify-end space-x-2 py-2">
          {onSectionReset && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onSectionReset(sectionId)}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          )}
          {onSectionSubmit && (
            <Button 
              size="sm" 
              onClick={() => onSectionSubmit(sectionId)}
              className="flex items-center gap-1"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Submit</span>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default FormSection;
