// components/FormRenderer.components.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MinusCircle,
  PlusCircle,
  AlertCircle,
  Save,
  RefreshCw,
  SendHorizonal,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import FieldAudioRecorder from './FieldAudioRecorder';
import TranscriptionBox from '@/components/audio/TranscriptionBox';
import { ProcessingQueueItem } from '../types/FormRenderer.types';

// Processing Queue Alert Component
interface ProcessingQueueAlertProps {
  processingQueue: ProcessingQueueItem[];
  currentlyProcessingPath: string | null;
}

export const ProcessingQueueAlert: React.FC<ProcessingQueueAlertProps> = ({
  processingQueue,
  currentlyProcessingPath,
}) => {
  if (processingQueue.length === 0) return null;

  return (
    <Alert className="mb-2 bg-blue-50 border-blue-300">
      <AlertCircle className="h-3 w-3" />
      <AlertTitle className="text-xs">Processing Queue</AlertTitle>
      <AlertDescription className="text-2xs">
        {processingQueue.length} item(s) queued for processing
        {currentlyProcessingPath &&
          ` • Currently processing: ${currentlyProcessingPath}`}
      </AlertDescription>
    </Alert>
  );
};

// Suggestions Alert Component
interface SuggestionsAlertProps {
  suggestions: string | null;
}

export const SuggestionsAlert: React.FC<SuggestionsAlertProps> = ({
  suggestions,
}) => {
  if (!suggestions) return null;

  return (
    <Alert
      variant="default"
      className="mb-2 bg-slate-900 text-white border-slate-800 p-1.5 text-xs"
    >
      <AlertCircle className="h-3 w-3" />
      <AlertTitle className="text-xs">Suggestions</AlertTitle>
      <AlertDescription>
        <div className="text-2xs whitespace-pre-wrap max-h-20 overflow-y-auto">
          {typeof suggestions === 'string' &&
          suggestions.includes('[') &&
          suggestions.includes(']')
            ? (() => {
                try {
                  const suggestionsText = suggestions.substring(
                    suggestions.indexOf('['),
                    suggestions.lastIndexOf(']') + 1
                  );
                  const parsedSuggestions = JSON.parse(suggestionsText);
                  const limitedSuggestions = parsedSuggestions.slice(0, 2);

                  return (
                    <ul className="list-disc pl-4">
                      {limitedSuggestions.map(
                        (suggestion: string, index: number) => (
                          <li key={index}>{suggestion}</li>
                        )
                      )}
                    </ul>
                  );
                } catch (e) {
                  return suggestions;
                }
              })()
            : suggestions}
        </div>
      </AlertDescription>
    </Alert>
  );
};

// LLM Updates Alert Component
interface LLMUpdatesAlertProps {
  llmUpdatedFields: Set<string>;
  onAcceptAll: () => void;
}

export const LLMUpdatesAlert: React.FC<LLMUpdatesAlertProps> = ({
  llmUpdatedFields,
  onAcceptAll,
}) => {
  if (llmUpdatedFields.size === 0) return null;

  return (
    <Card className="mb-3 bg-yellow-50 border-yellow-300">
      <CardContent className="p-2 form-card-content">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium text-xs">
              AI suggested {llmUpdatedFields.size} update
              {llmUpdatedFields.size > 1 ? 's' : ''}
            </h3>
            <p className="text-2xs text-muted-foreground">
              Review highlighted fields
            </p>
          </div>
          <Button
            onClick={onAcceptAll}
            variant="default"
            size="sm"
            className="text-2xs h-7 px-2 form-button touch-manipulation"
          >
            Accept All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Section Transcription Box Component
interface SectionTranscriptionBoxProps {
  sectionPath: string;
  transcription: string;
  isActiveSection: boolean;
  isSelected: boolean;
  isAlreadyProcessed: boolean;
  isCurrentlyProcessing: boolean;
  isInQueue: boolean;
  isWebSocketConnected: boolean;
  isProcessing: boolean;
  isAutoProcessing: boolean;
  recordingMode: 'idle' | 'global' | 'section';
  sectionRecorderKey: number;
  onSectionSelection: (sectionPath: string, checked: boolean) => void;
  onSectionAudioRecorded: (base64Audio: string, sectionPath: string) => void;
  onSectionTranscriptionProcess: (sectionPath: string) => void;
  onTranscriptionChange: (sectionPath: string, text: string) => void;
}

export const SectionTranscriptionBox: React.FC<
  SectionTranscriptionBoxProps
> = ({
  sectionPath,
  transcription,
  isActiveSection,
  isSelected,
  isAlreadyProcessed,
  isCurrentlyProcessing,
  isInQueue,
  isWebSocketConnected,
  isProcessing,
  isAutoProcessing,
  recordingMode,
  sectionRecorderKey,
  onSectionSelection,
  onSectionAudioRecorded,
  onSectionTranscriptionProcess,
  onTranscriptionChange,
}) => {
  // Audio recorder should be enabled when:
  // 1. WebSocket is connected
  // 2. Not currently processing globally
  // 3. Not in auto-processing state
  // 4. Either in idle/section mode OR global mode has completed (empty transcription indicates completion)
  const isAudioRecorderDisabled =
    !isWebSocketConnected ||
    isProcessing ||
    isAutoProcessing ||
    (recordingMode === 'global' && transcription.trim() !== ''); // Only disable during active global mode

  return (
    <div className="mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 bg-gray-50">
      <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Checkbox
              id={`select-${sectionPath}`}
              checked={isSelected}
              onCheckedChange={(checked) =>
                onSectionSelection(sectionPath, checked === true)
              }
              className="border-black text-black form-checkbox touch-manipulation"
            />
            <label
              htmlFor={`select-${sectionPath}`}
              className="text-xs font-medium text-slate-700 cursor-pointer"
            >
              Process
            </label>
          </div>
          <FieldAudioRecorder
            key={`${sectionPath}-${sectionRecorderKey}`}
            onAudioRecorded={(base64Audio) =>
              onSectionAudioRecorded(base64Audio, sectionPath)
            }
            fieldPath={sectionPath}
            isDisabled={isAudioRecorderDisabled}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation"
          onClick={() => onSectionTranscriptionProcess(sectionPath)}
          disabled={
            isProcessing ||
            isAutoProcessing ||
            !transcription.trim() ||
            !isWebSocketConnected ||
            isAlreadyProcessed
          }
        >
          <SendHorizonal className="h-4 w-4" />
          <span>
            {isCurrentlyProcessing
              ? 'Processing...'
              : isInQueue
              ? 'Queued'
              : isAlreadyProcessed
              ? 'Processed'
              : 'Process'}
          </span>
        </Button>
      </div>
      <TranscriptionBox
        value={transcription}
        onChange={(text) => onTranscriptionChange(sectionPath, text)}
        isProcessing={
          isCurrentlyProcessing && (isProcessing || isAutoProcessing)
        }
        autoProcess={() => {}}
        autoProcessDelay={5000}
        className="min-h-12 text-sm"
        placeholder={
          recordingMode === 'global' && transcription.trim() !== ''
            ? 'Global recording mode - section input temporarily disabled'
            : 'Speak or type to enter information for this section...'
        }
        disabled={recordingMode === 'global' && transcription.trim() !== ''} // Only disable during active global mode
      />
    </div>
  );
};

// Plan Transcription Box Component
interface PlanTranscriptionBoxProps {
  planPath: string;
  transcription: string;
  isAlreadyProcessed: boolean;
  isCurrentlyProcessing: boolean;
  isInQueue: boolean;
  isWebSocketConnected: boolean;
  isProcessing: boolean;
  isAutoProcessing: boolean;
  recordingMode: 'idle' | 'global' | 'section';
  planRecorderKey: number;
  onPlanAudioRecorded: (base64Audio: string, planPath: string) => void;
  onPlanTranscriptionProcess: (planPath: string) => void;
  onPlanTranscriptionChange: (planPath: string, text: string) => void;
}

export const PlanTranscriptionBox: React.FC<PlanTranscriptionBoxProps> = ({
  planPath,
  transcription,
  isAlreadyProcessed,
  isCurrentlyProcessing,
  isInQueue,
  isWebSocketConnected,
  isProcessing,
  isAutoProcessing,
  recordingMode,
  planRecorderKey,
  onPlanAudioRecorded,
  onPlanTranscriptionProcess,
  onPlanTranscriptionChange,
}) => {
  // Plan audio recorder should be enabled when:
  // 1. WebSocket is connected
  // 2. Not currently processing globally
  // 3. Not in auto-processing state
  // 4. Either not in global mode OR global mode has completed (empty transcription)
  const isPlanAudioRecorderDisabled =
    !isWebSocketConnected ||
    isProcessing ||
    isAutoProcessing ||
    (recordingMode === 'global' && transcription.trim() !== ''); // Only disable during active global mode

  return (
    <div className="mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 bg-blue-50">
      <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-xs font-medium text-blue-700">Plan Audio:</span>
          <FieldAudioRecorder
            key={`${planPath}-${planRecorderKey}`}
            onAudioRecorded={(base64Audio) =>
              onPlanAudioRecorded(base64Audio, planPath)
            }
            fieldPath={planPath}
            isDisabled={isPlanAudioRecorderDisabled}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation"
          onClick={() => onPlanTranscriptionProcess(planPath)}
          disabled={
            isProcessing ||
            isAutoProcessing ||
            !transcription.trim() ||
            !isWebSocketConnected ||
            isAlreadyProcessed ||
            (recordingMode === 'global' && transcription.trim() !== '') // Only disable during active global mode
          }
        >
          <SendHorizonal className="h-4 w-4" />
          <span>
            {isCurrentlyProcessing
              ? 'Processing...'
              : isInQueue
              ? 'Queued'
              : isAlreadyProcessed
              ? 'Processed'
              : recordingMode === 'global' && transcription.trim() !== ''
              ? 'Global Mode'
              : 'Process'}
          </span>
        </Button>
      </div>
      <TranscriptionBox
        value={transcription}
        onChange={(text) => onPlanTranscriptionChange(planPath, text)}
        isProcessing={
          isCurrentlyProcessing && (isProcessing || isAutoProcessing)
        }
        autoProcess={() => {}}
        autoProcessDelay={5000}
        className="min-h-12 text-sm"
        placeholder={
          recordingMode === 'global' && transcription.trim() !== ''
            ? 'Global recording mode - plan audio temporarily disabled'
            : 'Speak or type to enter information for this specific plan...'
        }
        disabled={recordingMode === 'global' && transcription.trim() !== ''} // Only disable during active global mode
      />
    </div>
  );
};

// Input Field Component
interface InputFieldProps {
  type: string;
  value: any;
  path: string;
  isLLMUpdated: boolean;
  placeholder?: string;
  onChange: (path: string, value: any) => void;
  onRejectLLMChange: (path: string) => void;
}

export const InputField: React.FC<InputFieldProps> = ({
  type,
  value,
  path,
  isLLMUpdated,
  placeholder,
  onChange,
  onRejectLLMChange,
}) => {
  const baseClassName = isLLMUpdated ? 'border-yellow-400 bg-yellow-50' : '';

  switch (type) {
    case 'number':
      return (
        <div className="relative">
          <Input
            type="number"
            value={value === null || value === undefined ? '' : value}
            onChange={(e) => onChange(path, Number(e.target.value))}
            className={`${baseClassName} text-sm form-input touch-manipulation`}
            placeholder={placeholder}
          />
          {isLLMUpdated && (
            <button
              onClick={() => onRejectLLMChange(path)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
              title="Reject this AI suggestion"
            >
              <MinusCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    case 'textarea':
      return (
        <div className="relative">
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(path, e.target.value)}
            className={`${baseClassName} text-sm form-textarea touch-manipulation`}
            placeholder={placeholder}
          />
          {isLLMUpdated && (
            <button
              onClick={() => onRejectLLMChange(path)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 touch-manipulation"
              title="Reject this AI suggestion"
            >
              <MinusCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    default:
      return (
        <div className="relative">
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(path, e.target.value)}
            className={`${baseClassName} text-sm form-input touch-manipulation`}
            placeholder={placeholder}
          />
          {isLLMUpdated && (
            <button
              onClick={() => onRejectLLMChange(path)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
              title="Reject this AI suggestion"
            >
              <MinusCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      );
  }
};

// Form Action Buttons Component
interface FormActionButtonsProps {
  onResetForm: () => void;
  onSubmitForm: () => void;
  isSubmitting: boolean;
}

export const FormActionButtons: React.FC<FormActionButtonsProps> = ({
  onResetForm,
  onSubmitForm,
  isSubmitting,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-3 flex justify-between gap-3 z-10 form-bottom-bar shadow-md safe-area-bottom">
      <Button
        variant="outline"
        onClick={onResetForm}
        disabled={isSubmitting}
        className="flex-1 h-10 flex items-center justify-center gap-1 text-xs form-button touch-manipulation"
      >
        <RefreshCw className="h-4 w-4" />
        Reset
      </Button>

      <Button
        variant="default"
        onClick={onSubmitForm}
        disabled={isSubmitting}
        className="flex-1 h-10 flex items-center justify-center gap-1 text-xs form-button touch-manipulation"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
            Submitting...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Submit
          </>
        )}
      </Button>
    </div>
  );
};
