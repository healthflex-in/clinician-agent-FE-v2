import React, { useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SectionTranscriptionBox from './section-transcription-box';
import SectionAudioRecorder from '../audio/section-audio-recorder';

interface FormSectionProps {
  title: string;
  sectionId: string;
  selected?: boolean;
  selectable?: boolean;
  isProcessing?: boolean;
  children: React.ReactNode;
  showAudioControls?: boolean;
  onSectionSubmit?: (sectionId: string) => void;
  onSectionReset?: (sectionId: string) => void;
  onSelectChange?: (sectionId: string, selected: boolean) => void;
  onTranscriptProcess?: (text: string, sectionId: string) => void;
  onAudioEncoded?: (base64Audio: string, sectionId: string) => void;
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
  onSectionReset,
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
    <div className="mb-4 rounded-2xl bg-white border border-stance-steel/8 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stance-steel/6 bg-stance-steel/[0.03]">
        <div className="flex items-center gap-2">
          {selectable && (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => {
                if (onSelectChange)
                  onSelectChange(sectionId, checked === true);
              }}
              id={`section-checkbox-${sectionId}`}
              className="h-3.5 w-3.5"
            />
          )}
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-stance-steel/60">
            {title}
          </span>
        </div>

        {showAudioControls && (
          <SectionAudioRecorder
            sectionId={sectionId}
            onAudioEncoded={handleAudioEncoded}
            isProcessing={isProcessing}
            size="sm"
            label={`Record for ${title}`}
          />
        )}
      </div>

      <div className="px-4 py-3">
        {showAudioControls && (
          <div className="mb-3">
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

        <div className="form-fields">{children}</div>
      </div>

      {(onSectionSubmit || onSectionReset) && (
        <div className="flex justify-end gap-2 px-4 py-2 border-t border-stance-steel/6">
          {onSectionReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSectionReset(sectionId)}
              className="flex items-center gap-1 h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          )}
          {onSectionSubmit && (
            <Button
              size="sm"
              onClick={() => onSectionSubmit(sectionId)}
              className="flex items-center gap-1 h-7 text-xs bg-stance-steel text-white"
            >
              <Save className="h-3 w-3" />
              Submit
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default FormSection;
