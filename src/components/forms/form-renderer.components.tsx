import React from 'react';
import {
  Save,
  Loader2,
  RefreshCw,
  MinusCircle,
  AlertCircle,
  SendHorizonal,
} from 'lucide-react';

import { ProcessingQueueItem } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { TranscriptionBox, FieldAudioRecorder } from '@/components/audio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

interface LLMUpdatesAlertProps {
  llmUpdatedFields: Set<string>;
  onAcceptAll: () => void;
}

export const LLMUpdatesAlert: React.FC<LLMUpdatesAlertProps> = ({
  onAcceptAll,
  llmUpdatedFields,
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

interface SectionTranscriptionBoxProps {
  isInQueue: boolean;
  sectionPath: string;
  isSelected: boolean;
  isRecording: boolean;
  transcription: string;
  isProcessing: boolean;
  isActiveSection: boolean;
  isAutoProcessing: boolean;
  sectionRecorderKey: number;
  isAlreadyProcessed: boolean;
  isWebSocketConnected: boolean;
  isCurrentlyProcessing: boolean;
  recordingMode: 'idle' | 'global' | 'section';

  onTranscriptionClear: (sectionPath: string) => void;
  onSectionTranscriptionProcess: (sectionPath: string) => void;
  onTranscriptionChange: (sectionPath: string, text: string) => void;
  onSectionSelection: (sectionPath: string, checked: boolean) => void;
  onSectionAudioRecorded: (base64Audio: string, sectionPath: string) => void;
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
  isRecording,
  onSectionSelection,
  onTranscriptionClear,
  onTranscriptionChange,
  onSectionAudioRecorded,
  onSectionTranscriptionProcess,
}) => {
  // Determine if this section is currently being processed
  const isThisSectionProcessing =
    isCurrentlyProcessing && (isProcessing || isAutoProcessing);
  const isThisSectionLoading =
    isThisSectionProcessing || (isInQueue && isProcessing);

  // ADD: Determine if transcription should be disabled
  const isTranscriptionDisabled =
    isThisSectionLoading ||
    isRecording ||
    (recordingMode === 'global' && !isActiveSection) ||
    (recordingMode === 'section' && isActiveSection && isRecording);

  // ADD: Handle audio recording start to clear transcription
  const handleAudioRecorded = (base64Audio: string) => {
    // Clear transcription when new recording starts
    onTranscriptionClear(sectionPath);
    onSectionAudioRecorded(base64Audio, sectionPath);
  };

  return (
    <div
      className={`mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 ${
        isThisSectionProcessing
          ? 'bg-yellow-50 border-yellow-300'
          : 'bg-blue-50'
      }`}
    >
      <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            id={`section-${sectionPath}`}
            disabled={isThisSectionProcessing}
            onChange={(e) => onSectionSelection(sectionPath, e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <label
            htmlFor={`section-${sectionPath}`}
            className={`text-xs font-medium cursor-pointer ${
              isThisSectionProcessing ? 'text-yellow-700' : 'text-blue-700'
            }`}
          >
            Section Audio:
          </label>
          <FieldAudioRecorder
            fieldPath={sectionPath}
            onAudioRecorded={handleAudioRecorded}
            key={`${sectionPath}-${sectionRecorderKey}`}
            isDisabled={
              !isWebSocketConnected ||
              isProcessing ||
              isAutoProcessing ||
              isThisSectionProcessing ||
              (recordingMode === 'global' && transcription.trim() !== '')
            }
          />

          {isThisSectionProcessing && (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
              <span className="text-xs text-yellow-600">Processing...</span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          type="button"
          onClick={() => onSectionTranscriptionProcess(sectionPath)}
          variant={
            isAlreadyProcessed
              ? 'secondary'
              : isThisSectionProcessing
              ? 'ghost'
              : 'outline'
          }
          className={`h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation ${
            isThisSectionProcessing ? 'cursor-not-allowed opacity-60' : ''
          }`}
          disabled={
            isProcessing ||
            isAutoProcessing ||
            isThisSectionProcessing ||
            !transcription.trim() ||
            !isWebSocketConnected ||
            (recordingMode === 'global' && transcription.trim() !== '')
          }
          title={
            isThisSectionProcessing
              ? 'Processing in progress...'
              : isAlreadyProcessed
              ? 'Click to override/reprocess this section'
              : 'Process this section'
          }
        >
          {isThisSectionProcessing ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <SendHorizonal className="h-4 w-4" />
              <span>
                {isInQueue
                  ? 'Queued'
                  : isAlreadyProcessed
                  ? 'Override'
                  : recordingMode === 'global' && transcription.trim() !== ''
                  ? 'Global Mode'
                  : 'Process'}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Processing status indicator */}
      {isThisSectionProcessing && (
        <div className="mb-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded flex items-center gap-2">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-yellow-600 border-t-transparent"></div>
          <span>AI is processing this section...</span>
        </div>
      )}

      {/* Override indicator */}
      {isAlreadyProcessed && !isThisSectionProcessing && (
        <div className="mb-2 text-xs text-blue-600 bg-blue-100 p-1 rounded">
          This section has been processed. You can still record/type to override
          it.
        </div>
      )}

      {/* ADD: Recording indicator */}
      {isRecording && isActiveSection && recordingMode === 'section' && (
        <div className="mb-2 text-xs text-red-600 bg-red-100 p-1 rounded flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span>Recording in progress... Transcription is disabled.</span>
        </div>
      )}

      <TranscriptionBox
        value={transcription}
        onChange={(text) => onTranscriptionChange(sectionPath, text)}
        isProcessing={isThisSectionLoading}
        autoProcess={() => {}}
        autoProcessDelay={5000}
        className={`min-h-12 text-sm ${
          isTranscriptionDisabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        placeholder={
          isThisSectionLoading
            ? isThisSectionProcessing
              ? 'Processing in progress...'
              : 'Sending to server...'
            : isRecording && isActiveSection && recordingMode === 'section'
            ? 'Recording in progress... Please wait.'
            : isRecording && recordingMode === 'global'
            ? 'Global recording active...'
            : 'Speak or type to enter information for this specific section...'
        }
        disabled={isTranscriptionDisabled}
      />
    </div>
  );
};

interface PlanTranscriptionBoxProps {
  planPath: string;
  isInQueue: boolean;
  isRecording: boolean;
  transcription: string;
  isProcessing: boolean;
  planRecorderKey: number;
  isAutoProcessing: boolean;
  isAlreadyProcessed: boolean;
  isWebSocketConnected: boolean;
  isCurrentlyProcessing: boolean;
  recordingMode: 'idle' | 'global' | 'section';

  onPlanTranscriptionClear: (planPath: string) => void;
  onPlanTranscriptionProcess: (planPath: string) => void;
  onPlanTranscriptionChange: (planPath: string, text: string) => void;
  onPlanAudioRecorded: (base64Audio: string, planPath: string) => void;
}

export const PlanTranscriptionBox: React.FC<PlanTranscriptionBoxProps> = ({
  planPath,
  isInQueue,
  isRecording,
  isProcessing,
  transcription,
  recordingMode,
  planRecorderKey,
  isAutoProcessing,
  isAlreadyProcessed,
  isWebSocketConnected,
  isCurrentlyProcessing,

  onPlanAudioRecorded,
  onPlanTranscriptionClear,
  onPlanTranscriptionChange,
  onPlanTranscriptionProcess,
}) => {
  // Determine if this plan is currently being processed
  const isThisPlanProcessing =
    isCurrentlyProcessing && (isProcessing || isAutoProcessing);
  const isThisPlanLoading = isThisPlanProcessing || (isInQueue && isProcessing);

  // ADD: Determine if transcription should be disabled
  const isTranscriptionDisabled =
    isThisPlanLoading ||
    isRecording ||
    (recordingMode === 'global' && transcription.trim() !== '');

  // ADD: Handle audio recording start to clear transcription
  const handleAudioRecorded = (base64Audio: string) => {
    // Clear transcription when new recording starts
    onPlanTranscriptionClear(planPath);
    onPlanAudioRecorded(base64Audio, planPath);
  };

  return (
    <div
      className={`mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 ${
        isThisPlanLoading ? 'bg-yellow-50 border-yellow-300' : 'bg-purple-50'
      }`}
    >
      {/* REMOVED: The errant "Hi" text that was causing the error */}
      <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <span
            className={`text-xs font-medium ${
              isThisPlanLoading ? 'text-yellow-700' : 'text-purple-700'
            }`}
          >
            Plan Audio:
          </span>
          <FieldAudioRecorder
            fieldPath={planPath}
            onAudioRecorded={handleAudioRecorded}
            key={`${planPath}-${planRecorderKey}`}
            isDisabled={
              !isWebSocketConnected ||
              isProcessing ||
              isAutoProcessing ||
              isThisPlanLoading ||
              (recordingMode === 'global' && transcription.trim() !== '')
            }
          />

          {isThisPlanLoading && (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
              <span className="text-xs text-yellow-600">
                {isThisPlanProcessing ? 'Processing...' : 'Sending...'}
              </span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          type="button"
          onClick={() => onPlanTranscriptionProcess(planPath)}
          variant={
            isAlreadyProcessed
              ? 'secondary'
              : isThisPlanLoading
              ? 'ghost'
              : 'outline'
          }
          className={`h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation ${
            isThisPlanLoading ? 'cursor-not-allowed opacity-60' : ''
          }`}
          disabled={
            isProcessing ||
            isAutoProcessing ||
            isThisPlanLoading ||
            !transcription.trim() ||
            !isWebSocketConnected ||
            (recordingMode === 'global' && transcription.trim() !== '')
          }
        >
          {isThisPlanLoading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
              <span>
                {isThisPlanProcessing ? 'Processing...' : 'Sending...'}
              </span>
            </>
          ) : (
            <>
              <SendHorizonal className="h-4 w-4" />
              <span>
                {isInQueue
                  ? 'Queued'
                  : isAlreadyProcessed
                  ? 'Override'
                  : 'Process'}
              </span>
            </>
          )}
        </Button>
      </div>
      {isThisPlanLoading && (
        <div className="mb-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded flex items-center gap-2">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-yellow-600 border-t-transparent"></div>
          <span>
            {isThisPlanProcessing
              ? 'AI is processing this plan...'
              : 'Sending data to server...'}
          </span>
        </div>
      )}
      {/* ADD: Recording indicator */}
      {isRecording && (
        <div className="mb-2 text-xs text-red-600 bg-red-100 p-1 rounded flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span>Recording in progress... Transcription is disabled.</span>
        </div>
      )}
      <TranscriptionBox
        value={transcription}
        autoProcessDelay={5000}
        autoProcess={() => {}}
        isProcessing={isThisPlanLoading}
        onChange={(text) => onPlanTranscriptionChange(planPath, text)}
        className={`min-h-12 text-sm ${
          isTranscriptionDisabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        placeholder={
          isThisPlanLoading
            ? isThisPlanProcessing
              ? 'Processing in progress...'
              : 'Sending to server...'
            : isRecording
            ? 'Recording in progress... Please wait.'
            : 'Speak or type to enter information for this specific plan...'
        }
        disabled={isTranscriptionDisabled}
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

  onRejectLLMChange: (path: string) => void;
  onChange: (path: string, value: any) => void;
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
  const baseClassName = isLLMUpdated
    ? 'border-yellow-400 bg-yellow-50'
    : 'border-stance-steel/12 bg-white focus-visible:ring-stance-steel/20 focus-visible:ring-1 text-stance-steel/80 placeholder:text-stance-steel/25 rounded-xl';

  switch (type) {
    case 'number':
      return (
        <div className="relative">
          <Input
            type="number"
            placeholder={placeholder}
            onChange={(e) => onChange(path, Number(e.target.value))}
            value={value === null || value === undefined ? '' : value}
            className={`${baseClassName} text-sm form-input touch-manipulation`}
          />
          {isLLMUpdated && (
            <button
              title="Reject this AI suggestion"
              onClick={() => onRejectLLMChange(path)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
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
            placeholder={placeholder}
            onChange={(e) => onChange(path, e.target.value)}
            className={`${baseClassName} text-sm form-textarea touch-manipulation`}
          />
          {isLLMUpdated && (
            <button
              title="Reject this AI suggestion"
              onClick={() => onRejectLLMChange(path)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 touch-manipulation"
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
            placeholder={placeholder}
            onChange={(e) => onChange(path, e.target.value)}
            className={`${baseClassName} text-sm form-input touch-manipulation`}
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

interface FormActionButtonsProps {
  isSubmitting: boolean;
  onResetForm: () => void;
  onSubmitForm: () => void;
}

export const FormActionButtons: React.FC<FormActionButtonsProps> = ({
  onResetForm,
  onSubmitForm,
  isSubmitting,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-[#F0F3F8] border-t border-stance-steel/8 safe-area-bottom">
      <div className="max-w-3xl mx-auto px-6 py-3 flex gap-2.5">
        <Button
          variant="ghost"
          onClick={onResetForm}
          disabled={isSubmitting}
          className="w-28 h-11 flex items-center justify-center gap-1.5 text-sm font-medium text-stance-steel/50 hover:text-stance-steel/80 hover:bg-stance-steel/6 rounded-xl touch-manipulation shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset
        </Button>

        <Button
          variant="default"
          onClick={onSubmitForm}
          disabled={isSubmitting}
          className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-bold bg-stance-steel text-white hover:bg-stance-steel/90 active:scale-[0.98] rounded-xl touch-manipulation shadow-md ring-2 ring-stance-neon ring-offset-2 ring-offset-[#F0F3F8] transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Assessment'
          )}
        </Button>
      </div>
    </div>
  );
};
