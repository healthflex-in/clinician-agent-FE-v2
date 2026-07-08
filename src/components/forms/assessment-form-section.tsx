import React, { useState } from 'react';
import { Save, RefreshCw, Plus, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SectionTranscriptionBox from './section-transcription-box';
import SectionAudioRecorder from '../audio/section-audio-recorder';

interface AssessmentFormSectionProps {
  title: string;
  sectionId: string;
  children: React.ReactNode;
  onAudioEncoded?: (base64Audio: string, sectionId: string) => void;
  onTranscriptProcess?: (text: string, sectionId: string) => void;
  isProcessing?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (sectionId: string, selected: boolean) => void;
  showAudioControls?: boolean;
  onSectionSubmit?: (sectionId: string) => void;
  onSectionReset?: (sectionId: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
  isArrayItem?: boolean;
  itemIndex?: number;
}

const AssessmentFormSection: React.FC<AssessmentFormSectionProps> = ({
  title,
  sectionId,
  children,
  onAudioEncoded,
  onTranscriptProcess,
  isProcessing = false,
  selectable = false,
  selected = false,
  onSelectChange,
  showAudioControls = true,
  onSectionSubmit,
  onSectionReset,
  onAddItem,
  onRemoveItem,
  isArrayItem = false,
  itemIndex,
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
    <div className={`mb-4 rounded-2xl bg-white border border-stance-steel/8 shadow-sm overflow-hidden ${isArrayItem ? 'ml-4' : ''}`}>
      {/* Section header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b border-stance-steel/6 ${isArrayItem ? 'bg-stance-steel/5' : 'bg-stance-steel/[0.03]'}`}>
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
            {isArrayItem && itemIndex !== undefined
              ? `${title} ${itemIndex + 1}`
              : title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showAudioControls && (
            <SectionAudioRecorder
              sectionId={sectionId}
              onAudioEncoded={handleAudioEncoded}
              isProcessing={isProcessing}
              size="sm"
              label={`Record for ${title}`}
            />
          )}

          {isArrayItem && onRemoveItem && (
            <button
              onClick={onRemoveItem}
              className="h-6 w-6 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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

      {(onAddItem || onSectionReset || onSectionSubmit) && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-stance-steel/6 bg-stance-steel/[0.02]">
          {onAddItem && !isArrayItem ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddItem}
              className="flex items-center gap-1 h-7 text-xs border-dashed border-stance-steel/30 text-stance-steel/60 hover:text-stance-steel"
            >
              <Plus className="h-3 w-3" />
              Add Item
            </Button>
          ) : <div />}

          <div className="flex gap-2">
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
        </div>
      )}
    </div>
  );
};

export default AssessmentFormSection;
