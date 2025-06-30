import React from 'react';
import { FORM_SECTIONS } from '@/constants';

export interface LLMUpdateHandlerProps {
  formKey: string;
  selectedSections: Set<string>;
  currentlyProcessingPath: string | null;
  activeSectionTranscription: string | null;
  activePlanTranscription: string | null;
  sectionRecorderKeys: Record<string, number>;
  sectionTranscriptions: Record<string, string>;
  toast: any;
  dispatch: React.Dispatch<any>;
  onLLMUpdate?: (data: any) => void;

  // State setters
  setProcessingQueue: React.Dispatch<React.SetStateAction<any[]>>;
  setIsAutoProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentlyProcessingPath: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setProcessedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  setProcessedPlans: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSectionTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setSectionRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  setPlanTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setPlanRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  setActiveSectionTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setActivePlanTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setSuggestions: React.Dispatch<React.SetStateAction<string | null>>;

  // Refs
  pathTimeoutsRef: React.MutableRefObject<Map<string, NodeJS.Timeout>>;
  processingQueueRef: React.MutableRefObject<any[]>;

  // Submit handler
  submitHandlers: {
    handleLLMUpdate: (data: any) => void;
  };
}

export const useLLMUpdateHandler = (props: LLMUpdateHandlerProps) => {
  const {
    formKey,
    selectedSections,
    currentlyProcessingPath,
    activeSectionTranscription,
    activePlanTranscription,
    sectionRecorderKeys,
    sectionTranscriptions,
    toast,
    dispatch,
    onLLMUpdate,
    setProcessingQueue,
    setIsAutoProcessing,
    setCurrentlyProcessingPath,
    setProcessedSections,
    setProcessedPlans,
    setSectionTranscriptions,
    setSectionRecorderKeys,
    setPlanTranscriptions,
    setPlanRecorderKeys,
    setActiveSectionTranscription,
    setActivePlanTranscription,
    setSuggestions,
    pathTimeoutsRef,
    processingQueueRef,
    submitHandlers,
  } = props;

  // Helper: Clear all processing state and transcriptions
  const clearAllProcessingState = React.useCallback(() => {
    // Clear all timeouts and processing state
    pathTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    pathTimeoutsRef.current.clear();

    processingQueueRef.current = [];
    setProcessingQueue([]);
    setIsAutoProcessing(false);
    setCurrentlyProcessingPath(null);

    // Reset processed sections to allow new recording
    setProcessedSections(new Set());
    setProcessedPlans(new Set());

    // Clear all transcriptions and reset recorder keys
    const allSections =
      FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
    const clearedTranscriptions: Record<string, string> = {};
    const resetRecorderKeys: Record<string, number> = {};

    allSections.forEach((section) => {
      clearedTranscriptions[section] = '';
      resetRecorderKeys[section] = (sectionRecorderKeys[section] || 0) + 1;
    });

    setSectionTranscriptions(clearedTranscriptions);
    setSectionRecorderKeys(resetRecorderKeys);

    // Clear all plan transcriptions and reset their recorder keys
    setPlanTranscriptions({});
    setPlanRecorderKeys((prev) => {
      const resetKeys: Record<string, number> = {};
      Object.keys(prev).forEach((key) => {
        resetKeys[key] = (prev[key] || 0) + 1;
      });
      return resetKeys;
    });
  }, [
    formKey,
    sectionRecorderKeys,
    pathTimeoutsRef,
    processingQueueRef,
    setProcessingQueue,
    setIsAutoProcessing,
    setCurrentlyProcessingPath,
    setProcessedSections,
    setProcessedPlans,
    setSectionTranscriptions,
    setSectionRecorderKeys,
    setPlanTranscriptions,
    setPlanRecorderKeys,
  ]);

  // Helper: Normalize objective assessment data
  const normalizeObjectiveAssessment = React.useCallback((formData: any) => {
    if (formData.objectiveAssessment && !formData.objectiveAssessment.tests) {
      if (Array.isArray(formData.objectiveAssessment)) {
        formData.objectiveAssessment = {
          tests: formData.objectiveAssessment,
        };
      }
    }
    return formData;
  }, []);

  // Helper: Handle structured payload processing
  const handleStructuredPayload = React.useCallback(
    (llmData: any) => {
      console.log('=== STRUCTURED PAYLOAD PROCESSING ===');
      console.log(
        'Original structured data:',
        JSON.stringify(llmData.formData, null, 2)
      );

      clearAllProcessingState();

      // Extract and normalize form data
      const actualFormData = llmData.formData.formData || llmData.formData;
      const normalizedData = normalizeObjectiveAssessment(actualFormData);

      console.log(
        'Extracted actualFormData:',
        JSON.stringify(normalizedData, null, 2)
      );

      // Apply form data
      if (normalizedData) {
        console.log('=== DISPATCHING MERGE_LLM_DATA ===');
        console.log(
          'Data being dispatched:',
          JSON.stringify(normalizedData, null, 2)
        );

        dispatch({
          type: 'MERGE_LLM_DATA',
          data: normalizedData,
          source: 'llm',
        });

        if (onLLMUpdate) {
          console.log('=== CALLING onLLMUpdate ===');
          console.log(
            'Data passed to onLLMUpdate:',
            JSON.stringify(normalizedData, null, 2)
          );
          onLLMUpdate(normalizedData);
        }
      } else {
        console.log('=== NO FORM DATA TO APPLY (structured) ===');
      }
    },
    [
      clearAllProcessingState,
      normalizeObjectiveAssessment,
      dispatch,
      onLLMUpdate,
    ]
  );

  // Helper: Handle global updates
  const handleGlobalUpdate = React.useCallback(
    (llmData: any) => {
      if (selectedSections.size === 0) {
        // No sections selected - update entire form
        console.log('=== GLOBAL UPDATE - ENTIRE FORM ===');
        console.log(
          'Data being applied to entire form:',
          JSON.stringify(llmData.formData, null, 2)
        );

        dispatch({
          type: 'MERGE_LLM_DATA',
          data: llmData.formData,
          source: 'llm',
        });

        if (onLLMUpdate) {
          console.log('=== CALLING onLLMUpdate (global) ===');
          onLLMUpdate(llmData.formData);
        }
      } else {
        // Apply only to selected sections
        console.log('=== GLOBAL UPDATE - SELECTED SECTIONS ===');

        const selectedSectionsData: any = {};
        Object.keys(llmData.formData).forEach((key) => {
          if (selectedSections.has(key)) {
            selectedSectionsData[key] = llmData.formData[key];
          }
        });

        console.log(
          'Selected sections data:',
          JSON.stringify(selectedSectionsData, null, 2)
        );

        if (Object.keys(selectedSectionsData).length > 0) {
          dispatch({
            type: 'MERGE_LLM_DATA',
            data: selectedSectionsData,
            source: 'llm',
          });
          if (onLLMUpdate) onLLMUpdate(selectedSectionsData);
        } else {
          console.log('=== NO DATA FOR SELECTED SECTIONS ===');
          toast({
            title: 'No Updates for Selected Sections',
            description:
              'The AI did not provide data for your selected sections',
          });
        }
      }
    },
    [selectedSections, dispatch, onLLMUpdate, toast]
  );

  // Helper: Handle section-specific updates
  const handleSectionSpecificUpdate = React.useCallback(
    (llmData: any, processingPath: string) => {
      console.log('=== SECTION-SPECIFIC UPDATE ===');

      // Find the relevant data for this specific path
      const pathParts = processingPath.split('.');
      let relevantData: any = {};

      // Strategy 1: Try to extract data that belongs to this specific path
      if (pathParts.length === 1) {
        // Top-level section (e.g., "assessments", "plans")
        const sectionKey = pathParts[0];
        if (llmData.formData[sectionKey]) {
          relevantData[sectionKey] = llmData.formData[sectionKey];
        }
      } else if (pathParts.length >= 2) {
        // Nested path (e.g., "plans.0", "assessments.0.tests.1")
        const topLevelKey = pathParts[0];
        if (llmData.formData[topLevelKey]) {
          relevantData[topLevelKey] = llmData.formData[topLevelKey];
        }
      }

      // Strategy 2: If no specific match, be more selective
      if (Object.keys(relevantData).length === 0) {
        // Look for any keys that might be related to the processing path
        const possibleKeys = Object.keys(llmData.formData).filter(
          (key) => processingPath.includes(key) || key.includes(pathParts[0])
        );

        if (possibleKeys.length > 0) {
          possibleKeys.forEach((key) => {
            relevantData[key] = llmData.formData[key];
          });
        } else {
          // Last resort: apply full data but log a warning
          console.warn(
            'No specific match found, applying full data as fallback'
          );
          relevantData = llmData.formData;
        }
      }

      console.log(
        'Relevant data for section-specific update:',
        JSON.stringify(relevantData, null, 2)
      );

      if (Object.keys(relevantData).length > 0) {
        dispatch({
          type: 'MERGE_LLM_DATA',
          data: relevantData,
          source: 'llm',
        });
        if (onLLMUpdate) onLLMUpdate(relevantData);
      } else {
        console.log('=== NO RELEVANT DATA FOR SECTION ===');
        toast({
          title: 'No Relevant Updates',
          description: 'The AI did not provide data relevant to this section',
        });
      }
    },
    [dispatch, onLLMUpdate, toast]
  );

  // Helper: Clear transcription for processed path
  const clearProcessedPathTranscription = React.useCallback(
    (processingPath: string) => {
      if (!processingPath) return;

      const isSection =
        Object.keys(sectionTranscriptions).includes(processingPath) ||
        processingPath.split('.').length === 1;

      console.log(
        'Clearing transcription for path:',
        processingPath,
        'isSection:',
        isSection
      );

      if (isSection) {
        setSectionTranscriptions((prev) => ({
          ...prev,
          [processingPath]: '',
        }));

        setSectionRecorderKeys((prev) => ({
          ...prev,
          [processingPath]: (prev[processingPath] || 0) + 1,
        }));

        setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.add(processingPath);
          return newSet;
        });

        if (activeSectionTranscription === processingPath) {
          setActiveSectionTranscription(null);
        }
      } else {
        // It's a plan or test
        setPlanTranscriptions((prev) => ({
          ...prev,
          [processingPath]: '',
        }));

        setPlanRecorderKeys((prev) => ({
          ...prev,
          [processingPath]: (prev[processingPath] || 0) + 1,
        }));

        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.add(processingPath);
          return newSet;
        });

        if (activePlanTranscription === processingPath) {
          setActivePlanTranscription(null);
        }
      }
    },
    [
      sectionTranscriptions,
      activeSectionTranscription,
      activePlanTranscription,
      setSectionTranscriptions,
      setSectionRecorderKeys,
      setProcessedSections,
      setActiveSectionTranscription,
      setPlanTranscriptions,
      setPlanRecorderKeys,
      setProcessedPlans,
      setActivePlanTranscription,
    ]
  );

  // Helper: Handle regular form data processing
  const handleRegularFormData = React.useCallback(
    (llmData: any) => {
      console.log('=== REGULAR FORM DATA PROCESSING ===');
      console.log(
        'Regular form data:',
        JSON.stringify(llmData.formData, null, 2)
      );

      // Normalize objective assessment
      const normalizedData = normalizeObjectiveAssessment(llmData.formData);

      // Determine if this is a global or section-specific update
      const processingPath =
        llmData.currentlyProcessingPath || currentlyProcessingPath;
      const isGlobalUpdate =
        llmData.isGlobalRecording === true ||
        llmData.recordingType === 'global' ||
        (!processingPath && selectedSections.size === 0);

      console.log('Processing path:', processingPath);
      console.log('Is global update:', isGlobalUpdate);
      console.log('Selected sections:', Array.from(selectedSections));

      if (isGlobalUpdate) {
        handleGlobalUpdate({ formData: normalizedData });
      } else {
        handleSectionSpecificUpdate(
          { formData: normalizedData },
          processingPath
        );
        clearProcessedPathTranscription(processingPath);
      }
    },
    [
      normalizeObjectiveAssessment,
      currentlyProcessingPath,
      selectedSections,
      handleGlobalUpdate,
      handleSectionSpecificUpdate,
      clearProcessedPathTranscription,
    ]
  );

  // Helper: Handle suggestions
  const handleSuggestions = React.useCallback(
    (suggestions: string) => {
      console.log('=== PROCESSING SUGGESTIONS ===');
      console.log('Suggestions:', JSON.stringify(suggestions, null, 2));
      setSuggestions(suggestions);
      setTimeout(() => setSuggestions(null), 7000);
    },
    [setSuggestions]
  );

  // Main LLM update handler
  const updateFormWithLLMData = React.useCallback(
    (llmData: any) => {
      console.log('=== FORM RENDERER: updateFormWithLLMData called ===');
      console.log('Input llmData:', JSON.stringify(llmData, null, 2));

      // Handle structured payload (global processing)
      if (llmData.payloadType === 'structured' && llmData.formData) {
        handleStructuredPayload(llmData);
      }

      // Process suggestions
      if (llmData.suggestions) {
        handleSuggestions(llmData.suggestions);
      }

      // Process regular form data
      if (llmData.formData && !llmData.payloadType) {
        handleRegularFormData(llmData);
      }

      // Trigger auto-submit if we have form data
      if (
        llmData.formData ||
        (llmData.payloadType === 'structured' && llmData.formData)
      ) {
        console.log('=== LLM data processed, triggering auto-submit ===');
        submitHandlers.handleLLMUpdate(llmData.formData || llmData);
      }

      console.log('=== END updateFormWithLLMData ===');
    },
    [
      handleStructuredPayload,
      handleSuggestions,
      handleRegularFormData,
      submitHandlers.handleLLMUpdate,
    ]
  );

  return {
    updateFormWithLLMData,
  };
};
