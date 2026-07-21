import React from 'react';
import {
  LLMUpdatesAlert,
  SuggestionsAlert,
  FormActionButtons,
  ProcessingQueueAlert,
} from './form-renderer.components';

import { useDynamicArrayManagement } from '@/hooks/use-dynamic-array-management';
import { useFormRenderer } from '@/hooks';
import { useFormHandlers } from '@/handlers';
import { Button } from '@/components/ui/button';
import { FormRendererRef, FormRendererProps } from '@/types';

// Import the modular handlers
import { useFieldRenderers } from './form-field-renderers';
import { useFormInitialization } from '../../utils/form-initialization';
import { useFormSubmitHandlers } from '../../handlers/form-submit-handlers';
import { useTranscriptionRenderers } from './form-transcription-renderers';
import { useLLMUpdateHandler } from '../../handlers/form-llm-update-handler';
import { useTranscriptionHandlers } from '../../handlers/form-transcription-handlers';

// Enhanced FormRendererProps interface with auto-submit options
interface EnhancedFormRendererProps extends FormRendererProps {
  autoSubmitOnLLMUpdate?: boolean;
  autoSubmitDelay?: number;
}

export const FormRenderer = React.forwardRef<
  FormRendererRef,
  EnhancedFormRendererProps
>(
  (
    {
      schema,
      formKey,
      formData,
      onChange,
      onLLMUpdate,
      onAudioRecorded,
      onTranscriptionProcess,
      isWebSocketConnected = true,
      isProcessing = false,
      recordingMode = 'idle',
      activeSectionPath = null,
      appointmentId,
      patientId,
      recordingStates = {},
      onRecordingStart,
      onRecordingStop,
      onSectionTranscriptionClear,
      onPlanTranscriptionClear,
      autoSubmitOnLLMUpdate = true,
      autoSubmitDelay = 3000,
    },
    ref
  ) => {
    // Selected sections state
    const [selectedSections, setSelectedSections] = React.useState<Set<string>>(
      new Set()
    );

    // Initialize form state management
    const formState = useFormRenderer(
      schema,
      formKey,
      formData,
      recordingMode,
      isProcessing,
      onTranscriptionProcess,
      activeSectionPath,
      selectedSections
    );

    // Initialize form with API data
    const { isInitialized } = useFormInitialization({
      formData,
      schema,
      state: formState.state,
      dispatch: formState.dispatch,
    });

    // Initialize submit handlers
    const submitHandlers = useFormSubmitHandlers({
      autoSubmitOnLLMUpdate,
      autoSubmitDelay,
      isInitialized,
      state: formState.state,
      appointmentId: appointmentId || '',
      toast: formState.toast,
      setIsSubmitting: formState.setIsSubmitting,
      onChange,
    });

    // Initialize transcription handlers
    const transcriptionHandlers = useTranscriptionHandlers({
      formKey,
      state: formState.state,
      toast: formState.toast,
      selectedSections,
      recordingMode,
      isProcessing,
      isAutoProcessing: formState.isAutoProcessing,
      currentlyProcessingPath: formState.currentlyProcessingPath,
      onTranscriptionProcess,
      processedPlans: formState.processedPlans,
      planTranscriptions: formState.planTranscriptions,
      planRecorderKeys: formState.planRecorderKeys,
      processedSections: formState.processedSections,
      sectionTranscriptions: formState.sectionTranscriptions,
      sectionRecorderKeys: formState.sectionRecorderKeys,
      setProcessedPlans: formState.setProcessedPlans,
      setPlanTranscriptions: formState.setPlanTranscriptions,
      setPlanRecorderKeys: formState.setPlanRecorderKeys,
      setProcessedSections: formState.setProcessedSections,
      setSectionTranscriptions: formState.setSectionTranscriptions,
      setSectionRecorderKeys: formState.setSectionRecorderKeys,
      setActivePlanTranscription: formState.setActivePlanTranscription,
      setActiveSectionTranscription: formState.setActiveSectionTranscription,
      setIsAutoProcessing: formState.setIsAutoProcessing,
      setCurrentlyProcessingPath: formState.setCurrentlyProcessingPath,
      setProcessingQueue: formState.setProcessingQueue,
      pathTimeoutsRef: formState.pathTimeoutsRef,
      processingQueueRef: formState.processingQueueRef,
      addToProcessingQueue: formState.addToProcessingQueue,
    });

    // Initialize LLM update handler
    const llmUpdateHandler = useLLMUpdateHandler({
      formKey,
      selectedSections,
      currentlyProcessingPath: formState.currentlyProcessingPath,
      activeSectionTranscription: formState.activeSectionTranscription,
      activePlanTranscription: formState.activePlanTranscription,
      sectionRecorderKeys: formState.sectionRecorderKeys,
      sectionTranscriptions: formState.sectionTranscriptions,
      toast: formState.toast,
      dispatch: formState.dispatch,
      onLLMUpdate,
      setProcessingQueue: formState.setProcessingQueue,
      setIsAutoProcessing: formState.setIsAutoProcessing,
      setCurrentlyProcessingPath: formState.setCurrentlyProcessingPath,
      setProcessedSections: formState.setProcessedSections,
      setProcessedPlans: formState.setProcessedPlans,
      setSectionTranscriptions: formState.setSectionTranscriptions,
      setSectionRecorderKeys: formState.setSectionRecorderKeys,
      setPlanTranscriptions: formState.setPlanTranscriptions,
      setPlanRecorderKeys: formState.setPlanRecorderKeys,
      setActiveSectionTranscription: formState.setActiveSectionTranscription,
      setActivePlanTranscription: formState.setActivePlanTranscription,
      setSuggestions: formState.setSuggestions,
      pathTimeoutsRef: formState.pathTimeoutsRef,
      processingQueueRef: formState.processingQueueRef,
      submitHandlers,
    });

    // Initialize form handlers
    const handlers = useFormHandlers(
      formState.toast,
      formState.state,
      schema,
      formKey,
      formState.dispatch,
      isProcessing,
      formState.isAutoProcessing,
      formState.processedPlans,
      selectedSections,
      formState.processedSections,
      formState.currentlyProcessingPath,
      formState.planTranscriptions,
      formState.sectionTranscriptions,
      recordingMode,
      formState.setIsSubmitting,
      formState.setProcessingQueue,
      formState.setIsAutoProcessing,
      formState.setProcessedPlans,
      formState.setLlmUpdatedFields,
      formState.setProcessedSections,
      formState.setActivePlanTranscription,
      formState.setCurrentlyProcessingPath,
      formState.setPlanRecorderKeys,
      formState.setActiveSectionTranscription,
      formState.setPlanTranscriptions,
      formState.setSectionRecorderKeys,
      formState.setSectionTranscriptions,
      formState.processingQueueRef,
      formState.addToProcessingQueue,
      formState.pathTimeoutsRef,
      formState.isSubmitting,
      patientId,
      undefined,
      appointmentId,
      onRecordingStart,
      onRecordingStop,
      recordingStates,
      onAudioRecorded,
      onTranscriptionProcess
    );

    // Initialize array management
    const { addArrayItem, removeArrayItem, canRemoveArrayItem } =
      useDynamicArrayManagement({
        formKey,
        state: formState.state,
        dispatch: formState.dispatch,
        setLlmUpdatedFields: formState.setLlmUpdatedFields,
      });

    // Enhanced user change handler
    const handleUserChange = React.useCallback(
      (path: string, value: any) => {
        return submitHandlers.handleUserChange(
          path,
          value,
          handlers.handleChange
        );
      },
      [submitHandlers.handleUserChange, handlers.handleChange]
    );

    // Section selection handler
    const handleSectionSelection = React.useCallback(
      (sectionPath: string, checked: boolean) => {
        setSelectedSections((prev) => {
          const newSet = new Set(prev);
          if (checked) {
            newSet.add(sectionPath);
          } else {
            newSet.delete(sectionPath);
          }
          return newSet;
        });
      },
      []
    );

    // Test audio recorded handler
    const handleTestAudioRecorded = React.useCallback(
      (base64Audio: string, testPath: string) => {
        transcriptionHandlers.clearPlanTranscription(testPath);
        formState.setPlanRecorderKeys((prev) => ({
          ...prev,
          [testPath]: (prev[testPath] || 0) + 1,
        }));
        if (onAudioRecorded) {
          onAudioRecorded(base64Audio, testPath);
        }
      },
      [
        transcriptionHandlers.clearPlanTranscription,
        formState.setPlanRecorderKeys,
        onAudioRecorded,
      ]
    );

    // Initialize field and transcription renderers
    const transcriptionRenderers = useTranscriptionRenderers({
      formKey,
      recordingMode,
      isProcessing,
      isAutoProcessing: formState.isAutoProcessing,
      isWebSocketConnected,
      selectedSections,
      activeSectionPath,
      currentlyProcessingPath: formState.currentlyProcessingPath,
      recordingStates,
      sectionTranscriptions: formState.sectionTranscriptions,
      planTranscriptions: formState.planTranscriptions,
      processedSections: formState.processedSections,
      processedPlans: formState.processedPlans,
      processingQueue: formState.processingQueue,
      sectionRecorderKeys: formState.sectionRecorderKeys,
      planRecorderKeys: formState.planRecorderKeys,
      handleSectionSelection,
      clearSectionTranscription:
        transcriptionHandlers.clearSectionTranscription,
      clearPlanTranscription: transcriptionHandlers.clearPlanTranscription,
      handleSectionAudioRecorded: handlers.handleSectionAudioRecorded,
      handlePlanAudioRecorded: handlers.handlePlanAudioRecorded,
      handleSectionTranscriptionProcess:
        handlers.handleSectionTranscriptionProcess,
      handlePlanTranscriptionProcess: handlers.handlePlanTranscriptionProcess,
      handleTranscriptionChange: handlers.handleTranscriptionChange,
      handlePlanTranscriptionChange: handlers.handlePlanTranscriptionChange,
      handleTestTranscriptionChange:
        transcriptionHandlers.handleTestTranscriptionChange,
      handleTestAudioRecorded,
      onRecordingStart,
      onRecordingStop,
      onSectionTranscriptionClear,
    });

    const fieldRenderers = useFieldRenderers({
      state: formState.state,
      formKey,
      llmUpdatedFields: formState.llmUpdatedFields,
      handleUserChange,
      rejectLLMChange: handlers.rejectLLMChange,
      handleResetField: handlers.handleResetField,
      addArrayItem,
      removeArrayItem,
      canRemoveArrayItem,
      renderTestTranscriptionBox:
        transcriptionRenderers.renderTestTranscriptionBox,
    });

    // Reset processed state helper
    const resetProcessedState = React.useCallback(
      (path: string) => {
        formState.setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.delete(path);
          return newSet;
        });
        formState.setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.delete(path);
          return newSet;
        });
        formState.setSectionRecorderKeys((prev) => ({
          ...prev,
          [path]: (prev[path] || 0) + 1,
        }));
        formState.setPlanRecorderKeys((prev) => ({
          ...prev,
          [path]: (prev[path] || 0) + 1,
        }));
      },
      [
        formState.setProcessedSections,
        formState.setProcessedPlans,
        formState.setSectionRecorderKeys,
        formState.setPlanRecorderKeys,
      ]
    );

    // Expose methods to parent via ref
    React.useImperativeHandle(
      ref,
      () => ({
        updateFormWithLLMData: llmUpdateHandler.updateFormWithLLMData,
        updatePlanTranscription: transcriptionHandlers.updatePlanTranscription,
        clearPlanTranscription: transcriptionHandlers.clearPlanTranscription,
        updateSectionTranscription:
          transcriptionHandlers.updateSectionTranscription,
        clearSectionTranscription:
          transcriptionHandlers.clearSectionTranscription,
        resetProcessedState,
      }),
      [
        llmUpdateHandler.updateFormWithLLMData,
        transcriptionHandlers,
        resetProcessedState,
      ]
    );

    // Notify parent of form data changes after initialization
    React.useEffect(() => {
      if (onChange && isInitialized) {
        onChange(formState.state);
      }
    }, [formState.state, onChange, isInitialized]);

    return (
      <div className="w-full max-w-screen">
        {!isInitialized ? (
          /* Placeholder to prevent CLS — reserves space until form data is ready */
          <div className="animate-pulse space-y-4 py-4">
            <div className="h-10 bg-stance-steel/5 rounded-xl" />
            <div className="h-24 bg-stance-steel/5 rounded-xl" />
            <div className="h-10 bg-stance-steel/5 rounded-xl" />
            <div className="h-24 bg-stance-steel/5 rounded-xl" />
            <div className="h-10 bg-stance-steel/5 rounded-xl" />
          </div>
        ) : (
        <>
        {/* Processing queue status */}
        <ProcessingQueueAlert
          processingQueue={formState.processingQueue}
          currentlyProcessingPath={formState.currentlyProcessingPath}
        />

        {/* Suggestions */}
        <SuggestionsAlert suggestions={formState.suggestions} />

        {/* LLM updates */}
        <LLMUpdatesAlert
          onAcceptAll={handlers.acceptAllLLMChanges}
          llmUpdatedFields={formState.llmUpdatedFields}
        />

        {/* Auto-submit indicator */}
        {submitHandlers.pendingAutoSubmit && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm text-blue-700">
                Auto-submitting form in{' '}
                {Math.ceil(submitHandlers.autoSubmitDelay / 1000)} seconds...
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={submitHandlers.cancelAutoSubmit}
                className="ml-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-2">
          {fieldRenderers.renderField(schema, '', 'root')}
        </div>

        </>
        )}
      </div>
    );
  }
);

export default FormRenderer;
