import React from 'react';
import { TranscriptionBox, FieldAudioRecorder } from '@/components/audio';
import { SectionTranscriptionBox, PlanTranscriptionBox } from './form-renderer.components';

export interface TranscriptionRenderersProps {
  formKey: string;
  recordingMode: 'idle' | 'global' | 'section';
  isProcessing: boolean;
  isAutoProcessing: boolean;
  isWebSocketConnected: boolean;
  selectedSections: Set<string>;
  activeSectionPath: string | null;
  currentlyProcessingPath: string | null;
  recordingStates: { [path: string]: boolean };
  
  // Transcription states
  sectionTranscriptions: Record<string, string>;
  planTranscriptions: Record<string, string>;
  processedSections: Set<string>;
  processedPlans: Set<string>;
  processingQueue: any[];
  sectionRecorderKeys: Record<string, number>;
  planRecorderKeys: Record<string, number>;
  
  // Handlers
  handleSectionSelection: (sectionPath: string, checked: boolean) => void;
  clearSectionTranscription: (sectionPath: string) => void;
  clearPlanTranscription: (planPath: string) => void;
  handleSectionAudioRecorded: (base64Audio: string, sectionPath: string) => void;
  handlePlanAudioRecorded: (base64Audio: string, planPath: string) => void;
  handleSectionTranscriptionProcess: (sectionPath: string) => void;
  handlePlanTranscriptionProcess: (planPath: string) => void;
  handleTranscriptionChange: (sectionPath: string, text: string) => void;
  handlePlanTranscriptionChange: (planPath: string, text: string) => void;
  handleTestTranscriptionChange: (testPath: string, text: string) => void;
  handleTestAudioRecorded: (base64Audio: string, testPath: string) => void;
  onRecordingStart?: (path?: string) => void;
  onRecordingStop?: (path?: string) => void;
  onSectionTranscriptionClear?: (sectionPath: string) => void;
}

export const useTranscriptionRenderers = (props: TranscriptionRenderersProps) => {
  const {
    formKey,
    recordingMode,
    isProcessing,
    isAutoProcessing,
    isWebSocketConnected,
    selectedSections,
    activeSectionPath,
    currentlyProcessingPath,
    recordingStates,
    sectionTranscriptions,
    planTranscriptions,
    processedSections,
    processedPlans,
    processingQueue,
    sectionRecorderKeys,
    planRecorderKeys,
    handleSectionSelection,
    clearSectionTranscription,
    clearPlanTranscription,
    handleSectionAudioRecorded,
    handlePlanAudioRecorded,
    handleSectionTranscriptionProcess,
    handlePlanTranscriptionProcess,
    handleTranscriptionChange,
    handlePlanTranscriptionChange,
    handleTestTranscriptionChange,
    handleTestAudioRecorded,
    onRecordingStart,
    onRecordingStop,
    onSectionTranscriptionClear,
  } = props;

  // Helper: Get common transcription state for a path
  const getTranscriptionState = React.useCallback((path: string, isSection: boolean = false) => {
    const transcription = isSection 
      ? sectionTranscriptions[path] || ''
      : planTranscriptions[path] || '';
    
    const isAlreadyProcessed = isSection
      ? processedSections.has(path)
      : processedPlans.has(path);
    
    const isCurrentlyProcessing = currentlyProcessingPath === path;
    const isInQueue = processingQueue.some((item) => item.path === path);
    const isRecording = recordingStates[path] || false;
    const recorderKey = isSection 
      ? sectionRecorderKeys[path] || 0
      : planRecorderKeys[path] || 0;

    return {
      transcription,
      isAlreadyProcessed,
      isCurrentlyProcessing,
      isInQueue,
      isRecording,
      recorderKey,
      isThisProcessing: isCurrentlyProcessing && (isProcessing || isAutoProcessing),
    };
  }, [
    sectionTranscriptions,
    planTranscriptions,
    processedSections,
    processedPlans,
    currentlyProcessingPath,
    processingQueue,
    recordingStates,
    sectionRecorderKeys,
    planRecorderKeys,
    isProcessing,
    isAutoProcessing,
  ]);

  // Helper: Get placeholder text for transcription box
  const getPlaceholderText = React.useCallback((
    isThisProcessing: boolean,
    isRecording: boolean,
    isAlreadyProcessed: boolean,
    recordingMode: string,
    transcription: string,
    itemType: 'section' | 'plan' | 'test'
  ) => {
    if (isThisProcessing) {
      return 'Processing in progress...';
    }
    if (isRecording) {
      return 'Recording in progress... Please wait.';
    }
    if (recordingMode === 'global' && transcription.trim() !== '') {
      return `Global recording mode - ${itemType} audio temporarily disabled`;
    }
    if (isAlreadyProcessed) {
      return `This ${itemType} is processed. Speak or type to override...`;
    }
    return `Speak or type to enter information for this specific ${itemType}...`;
  }, []);

  // Render section transcription box
  const renderSectionTranscriptionBox = React.useCallback((sectionPath: string) => {
    const isActiveSection = activeSectionPath === sectionPath;
    const isSelected = selectedSections.has(sectionPath);
    const state = getTranscriptionState(sectionPath, true);

    return (
      <SectionTranscriptionBox
        sectionPath={sectionPath}
        transcription={state.transcription}
        isActiveSection={isActiveSection}
        isSelected={isSelected}
        isAlreadyProcessed={state.isAlreadyProcessed}
        isCurrentlyProcessing={state.isCurrentlyProcessing}
        isInQueue={state.isInQueue}
        isWebSocketConnected={isWebSocketConnected}
        isProcessing={isProcessing}
        isAutoProcessing={isAutoProcessing}
        recordingMode={recordingMode}
        sectionRecorderKey={state.recorderKey}
        isRecording={state.isRecording}
        onSectionSelection={handleSectionSelection}
        onTranscriptionClear={onSectionTranscriptionClear || clearSectionTranscription}
        onSectionAudioRecorded={handleSectionAudioRecorded}
        onSectionTranscriptionProcess={handleSectionTranscriptionProcess}
        onTranscriptionChange={handleTranscriptionChange}
      />
    );
  }, [
    activeSectionPath,
    selectedSections,
    getTranscriptionState,
    isWebSocketConnected,
    isProcessing,
    isAutoProcessing,
    recordingMode,
    handleSectionSelection,
    onSectionTranscriptionClear,
    clearSectionTranscription,
    handleSectionAudioRecorded,
    handleSectionTranscriptionProcess,
    handleTranscriptionChange,
  ]);

  // Render plan transcription box
  const renderPlanTranscriptionBox = React.useCallback((planPath: string) => {
    const state = getTranscriptionState(planPath, false);

    return (
      <PlanTranscriptionBox
        planPath={planPath}
        transcription={state.transcription}
        isAlreadyProcessed={state.isAlreadyProcessed}
        isCurrentlyProcessing={state.isCurrentlyProcessing}
        isInQueue={state.isInQueue}
        isWebSocketConnected={isWebSocketConnected}
        isProcessing={isProcessing}
        isAutoProcessing={isAutoProcessing}
        recordingMode={recordingMode}
        planRecorderKey={state.recorderKey}
        isRecording={recordingMode === 'global'}
        onPlanTranscriptionClear={clearPlanTranscription}
        onPlanAudioRecorded={handlePlanAudioRecorded}
        onPlanTranscriptionProcess={handlePlanTranscriptionProcess}
        onPlanTranscriptionChange={handlePlanTranscriptionChange}
      />
    );
  }, [
    getTranscriptionState,
    isWebSocketConnected,
    isProcessing,
    isAutoProcessing,
    recordingMode,
    clearPlanTranscription,
    handlePlanAudioRecorded,
    handlePlanTranscriptionProcess,
    handlePlanTranscriptionChange,
  ]);

  // Render test transcription box (for Physio forms)
  const renderTestTranscriptionBox = React.useCallback((testPath: string) => {
    const state = getTranscriptionState(testPath, false);
    const placeholderText = getPlaceholderText(
      state.isThisProcessing,
      state.isRecording,
      state.isAlreadyProcessed,
      recordingMode,
      state.transcription,
      'test'
    );

    return (
      <div
        className={`mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 ${
          state.isThisProcessing
            ? 'bg-yellow-50 border-yellow-300'
            : 'bg-green-50'
        }`}
      >
        {/* Header with audio recorder */}
        <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <span
              className={`text-xs font-medium ${
                state.isThisProcessing ? 'text-yellow-700' : 'text-green-700'
              }`}
            >
              Test Audio:
            </span>
            
            <FieldAudioRecorder
              key={`${testPath}-${state.recorderKey}`}
              fieldPath={testPath}
              isDisabled={
                !isWebSocketConnected ||
                isProcessing ||
                isAutoProcessing ||
                state.isThisProcessing ||
                (recordingMode === 'global' && state.transcription.trim() !== '')
              }
              onAudioRecorded={(base64Audio) =>
                handleTestAudioRecorded(base64Audio, testPath)
              }
              onRecordingStart={() =>
                onRecordingStart && onRecordingStart(testPath)
              }
              onRecordingStop={() =>
                onRecordingStop && onRecordingStop(testPath)
              }
            />

            {/* Processing spinner */}
            {state.isThisProcessing && (
              <div className="flex items-center gap-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
                <span className="text-xs text-yellow-600">Processing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Status indicators */}
        {state.isThisProcessing && (
          <div className="mb-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-yellow-600 border-t-transparent"></div>
            <span>AI is processing this test...</span>
          </div>
        )}

        {state.isAlreadyProcessed && !state.isThisProcessing && (
          <div className="mb-2 text-xs text-green-600 bg-green-100 p-1 rounded">
            ✓ This test has been processed. You can still record/type to override it.
          </div>
        )}

        {state.isRecording && (
          <div className="mb-2 text-xs text-red-600 bg-red-100 p-1 rounded flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>Recording in progress... Transcription is disabled.</span>
          </div>
        )}

        {/* Transcription box */}
        <TranscriptionBox
          value={state.transcription}
          onChange={(text) => handleTestTranscriptionChange(testPath, text)}
          isProcessing={state.isThisProcessing}
          autoProcess={() => {}}
          autoProcessDelay={5000}
          className={`min-h-12 text-sm ${
            state.isThisProcessing || state.isRecording
              ? 'opacity-60 cursor-not-allowed'
              : ''
          }`}
          placeholder={placeholderText}
          disabled={state.isThisProcessing || state.isRecording}
        />
      </div>
    );
  }, [
    getTranscriptionState,
    getPlaceholderText,
    recordingMode,
    isWebSocketConnected,
    isProcessing,
    isAutoProcessing,
    handleTestTranscriptionChange,
    handleTestAudioRecorded,
    onRecordingStart,
    onRecordingStop,
  ]);

  return {
    renderSectionTranscriptionBox,
    renderPlanTranscriptionBox,
    renderTestTranscriptionBox,
  };
};