
import React, { useState } from 'react';
import SectionAudioRecorder from '../audio/SectionAudioRecorder';
import SectionTranscriptionBox from './SectionTranscriptionBox';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Save, RefreshCw, Plus, Minus } from 'lucide-react';
import { themeColors } from '@/styles/theme';

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
    <Card className={`mb-6 border border-border bg-card ${isArrayItem ? 'ml-4' : ''}`}>
      <CardHeader className={`pb-2 ${isArrayItem ? 'bg-background/50' : ''}`}>
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
            <CardTitle className="text-lg font-semibold">
              {isArrayItem && itemIndex !== undefined ? `${title} ${itemIndex + 1}` : title}
            </CardTitle>
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
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRemoveItem}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Minus className="h-4 w-4" />
                <span className="sr-only">Remove Item</span>
              </Button>
            )}
          </div>
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

      <CardFooter className="flex justify-end space-x-2 py-2">
        {onAddItem && !isArrayItem && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddItem}
            className="mr-auto flex items-center gap-1 border-dashed border-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </Button>
        )}
      
        {(onSectionReset || onSectionSubmit) && (
          <div>
            {onSectionReset && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSectionReset(sectionId)}
                className="flex items-center gap-1 mr-2"
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
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default AssessmentFormSection;
