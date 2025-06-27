import React from 'react';
import { RefreshCw } from 'lucide-react';

import {
  isPlanPath,
  isTestPath,
  shouldHaveAudioRecording,
} from '@/utils/form-renderer.utils';
import {
  InputField,
  LLMUpdatesAlert,
  SuggestionsAlert,
  FormActionButtons,
  ProcessingQueueAlert,
  PlanTranscriptionBox,
  SectionTranscriptionBox,
} from './form-renderer.components';

import { ArrayItemControls } from '@/components/forms/array-item-controls';
import { useDynamicArrayManagement } from '@/hooks/use-dynamic-array-management';

import { useFormRenderer } from '@/hooks';
import { FORM_SECTIONS } from '@/constants';
import { useFormHandlers } from '@/handlers';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getNestedValue } from '@/utils/schema-utils';
import { Card, CardContent } from '@/components/ui/card';
import { FormRendererRef, FormRendererProps } from '@/types';
import { FieldAudioRecorder, TranscriptionBox } from '@/components/audio';

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
      autoSubmitOnLLMUpdate = true, // Default to true
      autoSubmitDelay = 3000, // Default 3 second delay
    },
    ref
  ) => {
    // New state for selected sections - starts with empty set (none selected)
    const [selectedSections, setSelectedSections] = React.useState<Set<string>>(
      new Set()
    );

    // AUTO-SUBMIT STATE VARIABLES
    const [pendingAutoSubmit, setPendingAutoSubmit] = React.useState(false);
    const autoSubmitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const lastLLMUpdateRef = React.useRef<number>(0);
    const isLLMUpdateInProgress = React.useRef(false);

    // FORM INITIALIZATION STATE - FIX FOR PRE-FILLED DATA
    const [isInitialized, setIsInitialized] = React.useState(false);
    const initializationRef = React.useRef(false);
    const [isStateUpdated, setIsStateUpdated] = React.useState(false);

    // Use custom hook for form state management
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

    const {
      state,
      llmUpdatedFields,
      suggestions,
      sectionTranscriptions,
      planTranscriptions,
      activeSectionTranscription,
      activePlanTranscription,
      processedSections,
      processedPlans,
      isSubmitting,
      isAutoProcessing,
      processingQueue,
      currentlyProcessingPath,
      sectionRecorderKeys,
      planRecorderKeys,
      setLlmUpdatedFields,
      setSuggestions,
      setSectionTranscriptions,
      setPlanTranscriptions,
      setActiveSectionTranscription,
      setActivePlanTranscription,
      setProcessedSections,
      setProcessedPlans,
      setIsSubmitting,
      setIsAutoProcessing,
      setProcessingQueue,
      setCurrentlyProcessingPath,
      setSectionRecorderKeys,
      setPlanRecorderKeys,
      dispatch,
      addToProcessingQueue,
      processNextInQueue,
      pathTimeoutsRef,
      processingQueueRef,
      toast,
    } = formState;

    // Use custom hook for form handlers
    const handlers = useFormHandlers(
      toast,
      state,
      schema,
      formKey,
      dispatch,
      isProcessing,
      isAutoProcessing,
      processedPlans,
      selectedSections,
      processedSections,
      currentlyProcessingPath,
      planTranscriptions,
      sectionTranscriptions,
      recordingMode,
      setIsSubmitting,
      setProcessingQueue,
      setIsAutoProcessing,
      setProcessedPlans,
      setLlmUpdatedFields,
      setProcessedSections,
      setActivePlanTranscription,
      setCurrentlyProcessingPath,
      setPlanRecorderKeys,
      setActiveSectionTranscription,
      setPlanTranscriptions,
      setSectionRecorderKeys,
      setSectionTranscriptions,
      processingQueueRef,
      addToProcessingQueue,
      pathTimeoutsRef,
      isSubmitting,
      patientId,
      undefined,
      appointmentId,
      onRecordingStart,
      onRecordingStop,
      recordingStates,
      onAudioRecorded,
      onTranscriptionProcess
    );

    const {
      handleChange,
      handleAddArrayItem,
      handleRemoveArrayItem,
      acceptAllLLMChanges,
      rejectLLMChange,
      handleSectionAudioRecorded,
      handlePlanAudioRecorded,
      handleTranscriptionChange,
      handlePlanTranscriptionChange,
      handleSectionTranscriptionProcess,
      handlePlanTranscriptionProcess,
      handleResetField,
      handleResetForm,
      handleSubmitForm,
    } = handlers;

    // Add dynamic array management
    const { addArrayItem, removeArrayItem, canRemoveArrayItem } =
      useDynamicArrayManagement({
        formKey,
        state,
        dispatch,
        setLlmUpdatedFields,
      });

    // FIX: Initialize form state when formData is received from API
    React.useEffect(() => {
      if (!formData || initializationRef.current) return;

      const isSame = JSON.stringify(state) === JSON.stringify(formData); // shallow equality is not enough

      if (isSame) {
        setIsInitialized(true);

        return;
      }

      const hasApiContent =
        formData.advice ||
        (formData.plans &&
          formData.plans.some(
            (plan: any) =>
              plan.exercise ||
              plan.comments ||
              (plan.set && (plan.set.repetitions || plan.set.load))
          )) ||
        // ADD: Check for assessment form content
        formData.plan ||
        formData.subjectiveAssessment ||
        formData.objectiveAssessment ||
        formData.rpe;

      if (hasApiContent) {
        dispatch({ type: 'REPLACE_STATE', data: formData });
      } else {
        dispatch({ type: 'REPLACE_STATE', data: schema });
      }

      initializationRef.current = true;
      setIsInitialized(true);
    }, [formData, dispatch, schema, state]);

    // FIXED: Auto-submit trigger function - now directly executes the timeout
    const triggerAutoSubmit = React.useCallback(() => {
      if (!autoSubmitOnLLMUpdate || !isInitialized) {
        console.log(
          '=== Auto-submit skipped - not enabled or not initialized ==='
        );
        return;
      }

      console.log('=== triggerAutoSubmit called ===');
      console.log(
        '=== Checking state before auto-submit ===',
        JSON.stringify(state, null, 2)
      );

      // Ensure that the form has valid data before submitting
      if (
        !state.plan?.plans?.some((plan) => plan.exercise) ||
        !state.subjectiveAssessment?.assessment ||
        !state.objectiveAssessment?.tests?.length
      ) {
        console.log('=== Form has empty fields, cannot submit ===');
        toast({
          title: 'Incomplete Form',
          description: 'Please ensure all required fields are filled.',
          variant: 'destructive',
        });
        return;
      }

      console.log('=== Proceeding with auto-submit ===');

      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }

      lastLLMUpdateRef.current = Date.now();
      isLLMUpdateInProgress.current = true;
      setPendingAutoSubmit(true);

      // Proceed with the auto-submit process only if the state is correctly populated
      setTimeout(async () => {
        console.log('=== Auto-submit timeout executed ===');

        try {
          if (onChange) {
            console.log('=== Calling onChange with current state ===');
            onChange(state); // Ensure latest state is passed to parent
          }

          await new Promise((resolve) => setTimeout(resolve, 100));

          console.log('=== Calling handleSubmitForm (auto-submit) ===');
          await handleSubmitForm(true); // true = isAutoSubmit

          console.log('=== Auto-submit completed successfully ===');
        } catch (error) {
          console.error('=== Auto-submit failed ===', error);
        } finally {
          setPendingAutoSubmit(false);
          isLLMUpdateInProgress.current = false;
          autoSubmitTimeoutRef.current = null;
        }
      }, 500); // Reduced delay to ensure state is propagated before submission

      console.log(`=== Auto-submit scheduled for 500ms delay ===`);
    }, [
      autoSubmitOnLLMUpdate,
      isInitialized,
      onChange,
      state,
      handleSubmitForm,
      autoSubmitDelay,
    ]);

    // CLEANUP TIMEOUT ON UNMOUNT
    React.useEffect(() => {
      return () => {
        if (autoSubmitTimeoutRef.current) {
          clearTimeout(autoSubmitTimeoutRef.current);
        }
      };
    }, []);

    // CANCEL AUTO-SUBMIT ON USER INTERACTION
    const handleUserChange = React.useCallback(
      (path: string, value: any) => {
        // Call original handleChange
        handleChange(path, value);

        // Cancel pending auto-submit if user makes changes after LLM update
        const timeSinceLastLLMUpdate = Date.now() - lastLLMUpdateRef.current;
        if (
          pendingAutoSubmit &&
          timeSinceLastLLMUpdate < autoSubmitDelay + 1000
        ) {
          console.log('=== Canceling auto-submit due to user interaction ===');
          setPendingAutoSubmit(false);
          if (autoSubmitTimeoutRef.current) {
            clearTimeout(autoSubmitTimeoutRef.current);
            autoSubmitTimeoutRef.current = null;
          }
          isLLMUpdateInProgress.current = false;
        }
      },
      [handleChange, pendingAutoSubmit, autoSubmitDelay]
    );

    // Add section selection handler
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

    // Handle test transcription changes (for Physio forms)
    const handleTestTranscriptionChange = React.useCallback(
      (testPath: string, text: string) => {
        if (recordingMode === 'global') {
          return;
        }

        // Allow override - remove from processed state if it exists
        if (processedPlans.has(testPath)) {
          setProcessedPlans((prev) => {
            const newSet = new Set(prev);
            newSet.delete(testPath);
            return newSet;
          });
        }

        setPlanTranscriptions((prev) => ({
          ...prev,
          [testPath]: text,
        }));

        setActivePlanTranscription(testPath);
        addToProcessingQueue(testPath, text);
      },
      [
        recordingMode,
        processedPlans,
        setPlanTranscriptions,
        setProcessedPlans,
        setActivePlanTranscription,
        addToProcessingQueue,
      ]
    );

    // Handle test transcription processing (for Physio forms)
    const handleTestTranscriptionProcess = React.useCallback(
      (testPath: string) => {
        if (
          !onTranscriptionProcess ||
          isProcessing ||
          isAutoProcessing ||
          recordingMode === 'global'
        )
          return;

        // Remove from queue if it exists
        processingQueueRef.current = processingQueueRef.current.filter(
          (item) => item.path !== testPath
        );
        setProcessingQueue([...processingQueueRef.current]);

        // Clear timeout
        const existingTimeout = pathTimeoutsRef.current.get(testPath);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          pathTimeoutsRef.current.delete(testPath);
        }

        const transcription = planTranscriptions[testPath] || '';

        if (!transcription.trim()) {
          toast({
            title: 'Empty transcription',
            description: 'Please record audio or enter text to process',
            variant: 'destructive',
          });
          return;
        }

        // ALLOW REPROCESSING: Don't check if already processed
        // If it was already processed, remove it from processed state
        if (processedPlans.has(testPath)) {
          setProcessedPlans((prev) => {
            const newSet = new Set(prev);
            newSet.delete(testPath);
            return newSet;
          });
        }

        setIsAutoProcessing(true);
        setCurrentlyProcessingPath(testPath);

        const context = {
          formKey,
          formData: state,
          testPath, // Use testPath for tests
          selectedSections: Array.from(selectedSections),
        };

        onTranscriptionProcess(transcription, context);
      },
      [
        formKey,
        state,
        planTranscriptions,
        onTranscriptionProcess,
        toast,
        selectedSections,
        processedPlans,
        isProcessing,
        isAutoProcessing,
        recordingMode,
        setIsAutoProcessing,
        setCurrentlyProcessingPath,
        setProcessedPlans,
        setProcessingQueue,
        pathTimeoutsRef,
        processingQueueRef,
      ]
    );

    // Plan transcription update function
    const updatePlanTranscription = React.useCallback(
      (planPath: string, text: string) => {
        // Allow override - remove from processed state if it exists
        if (processedPlans.has(planPath)) {
          setProcessedPlans((prev) => {
            const newSet = new Set(prev);
            newSet.delete(planPath);
            return newSet;
          });
        }

        setPlanTranscriptions((prev) => ({
          ...prev,
          [planPath]: text,
        }));
        setActivePlanTranscription(planPath);
        addToProcessingQueue(planPath, text);
      },
      [
        processedPlans,
        setPlanTranscriptions,
        setActivePlanTranscription,
        addToProcessingQueue,
        setProcessedPlans, // Add this dependency
      ]
    );

    // Clear plan transcription
    const clearPlanTranscription = React.useCallback(
      (planPath: string) => {
        setPlanTranscriptions((prev) => ({
          ...prev,
          [planPath]: '',
        }));

        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.delete(planPath);
          return newSet;
        });

        setActivePlanTranscription(planPath);

        const existingTimeout = pathTimeoutsRef.current.get(planPath);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          pathTimeoutsRef.current.delete(planPath);
        }

        processingQueueRef.current = processingQueueRef.current.filter(
          (item) => item.path !== planPath
        );
        setProcessingQueue([...processingQueueRef.current]);
      },
      [
        setPlanTranscriptions,
        setProcessedPlans,
        setActivePlanTranscription,
        setProcessingQueue,
        pathTimeoutsRef,
        processingQueueRef,
      ]
    );

    // Update section transcription function
    const updateSectionTranscription = React.useCallback(
      (sectionPath: string, text: string) => {
        // Allow override - remove from processed state if it exists
        if (processedSections.has(sectionPath)) {
          setProcessedSections((prev) => {
            const newSet = new Set(prev);
            newSet.delete(sectionPath);
            return newSet;
          });
        }

        // Check if this update is appropriate based on recording mode
        if (
          (recordingMode === 'section' && activeSectionPath === sectionPath) ||
          recordingMode === 'idle' ||
          !activeSectionPath
        ) {
          setSectionTranscriptions((prev) => ({
            ...prev,
            [sectionPath]: text,
          }));
          setActiveSectionTranscription(sectionPath);
          addToProcessingQueue(sectionPath, text);
        }
      },
      [
        processedSections,
        recordingMode,
        activeSectionPath,
        setSectionTranscriptions,
        setActiveSectionTranscription,
        addToProcessingQueue,
        setProcessedSections,
      ]
    );

    // Clear section transcription
    const clearSectionTranscription = React.useCallback(
      (sectionPath: string) => {
        setSectionTranscriptions((prev) => ({
          ...prev,
          [sectionPath]: '',
        }));

        setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.delete(sectionPath);
          return newSet;
        });

        setActiveSectionTranscription(sectionPath);

        const existingTimeout = pathTimeoutsRef.current.get(sectionPath);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          pathTimeoutsRef.current.delete(sectionPath);
        }

        processingQueueRef.current = processingQueueRef.current.filter(
          (item) => item.path !== sectionPath
        );
        setProcessingQueue([...processingQueueRef.current]);
      },
      [
        setSectionTranscriptions,
        setProcessedSections,
        setActiveSectionTranscription,
        setProcessingQueue,
        pathTimeoutsRef,
        processingQueueRef,
      ]
    );

    // FIXED: Update form with LLM data - SINGLE AUTO-SUBMIT TRIGGER
    const updateFormWithLLMData = React.useCallback(
      (llmData: any) => {
        console.log('=== FORM RENDERER: updateFormWithLLMData called ===');
        console.log('Input llmData:', JSON.stringify(llmData, null, 2));

        // Handle structured payload (global processing)
        if (llmData.payloadType === 'structured' && llmData.formData) {
          console.log('=== STRUCTURED PAYLOAD PROCESSING ===');
          console.log(
            'Original structured data:',
            JSON.stringify(llmData.formData, null, 2)
          );

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
            resetRecorderKeys[section] =
              (sectionRecorderKeys[section] || 0) + 1;
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

          // **EXTRACT FORM DATA**
          const actualFormData = llmData.formData.formData || llmData.formData;
          console.log(
            'Extracted actualFormData:',
            JSON.stringify(actualFormData, null, 2)
          );

          llmData = { formData: actualFormData };
          console.log('Modified llmData:', JSON.stringify(llmData, null, 2));

          // Apply form data
          if (llmData.formData) {
            console.log('=== DISPATCHING MERGE_LLM_DATA ===');
            console.log(
              'Data being dispatched:',
              JSON.stringify(llmData.formData, null, 2)
            );

            dispatch({
              type: 'MERGE_LLM_DATA',
              data: llmData.formData,
              source: 'llm',
            });

            if (onLLMUpdate) {
              console.log('=== CALLING onLLMUpdate ===');
              console.log(
                'Data passed to onLLMUpdate:',
                JSON.stringify(llmData.formData, null, 2)
              );
              onLLMUpdate(llmData.formData);
            }
          } else {
            console.log('=== NO FORM DATA TO APPLY (structured) ===');
          }
        }

        // Process suggestions
        if (llmData.suggestions) {
          console.log('=== PROCESSING SUGGESTIONS ===');
          console.log(
            'Suggestions:',
            JSON.stringify(llmData.suggestions, null, 2)
          );
          setSuggestions(llmData.suggestions);
          setTimeout(() => setSuggestions(null), 7000);
        }

        // Process form data
        if (llmData.formData && !llmData.payloadType) {
          console.log('=== REGULAR FORM DATA PROCESSING ===');
          console.log(
            'Regular form data:',
            JSON.stringify(llmData.formData, null, 2)
          );

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
            // GLOBAL UPDATE: Apply to entire form or selected sections

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
          } else {
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
                (key) =>
                  processingPath.includes(key) || key.includes(pathParts[0])
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
                description:
                  'The AI did not provide data relevant to this section',
              });
            }

            // Clear transcription for the specific path that was processed
            if (processingPath) {
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
            }
          }
        }

        // FIXED: Single auto-submit trigger at the end - with immediate execution
        if (
          llmData.formData ||
          (llmData.payloadType === 'structured' && llmData.formData)
        ) {
          console.log('=== LLM data processed, triggering auto-submit ===');

          // Use setTimeout to ensure state has been updated first
          setTimeout(() => {
            console.log('=== Delayed auto-submit trigger ===');
            triggerAutoSubmit();
          }, 200); // Slightly longer delay to ensure dispatch completes
        }

        console.log('=== END updateFormWithLLMData ===');
        setIsStateUpdated(true);
      },
      [
        onLLMUpdate,
        selectedSections,
        toast,
        currentlyProcessingPath,
        activeSectionTranscription,
        activePlanTranscription,
        formKey,
        sectionRecorderKeys,
        sectionTranscriptions,
        dispatch,
        pathTimeoutsRef,
        processingQueueRef,
        setProcessingQueue,
        setIsAutoProcessing,
        setCurrentlyProcessingPath,
        setProcessedSections,
        setSectionTranscriptions,
        setSectionRecorderKeys,
        setPlanTranscriptions,
        setPlanRecorderKeys,
        setProcessedPlans,
        setActiveSectionTranscription,
        setActivePlanTranscription,
        setSuggestions,
        triggerAutoSubmit,
      ]
    );

    React.useEffect(() => {
      if (isStateUpdated) {
        console.log('=== Triggering auto-submit after state update ===');
        triggerAutoSubmit(); // Trigger auto-submit after state is updated
        setIsStateUpdated(false); // Reset state update flag
      }
    }, [isStateUpdated]);

    // 2. Add a cleanup function for resetting processed states
    const resetProcessedState = React.useCallback(
      (path: string) => {
        // Remove from processed sections
        setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.delete(path);
          return newSet;
        });

        // Remove from processed plans
        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.delete(path);
          return newSet;
        });

        // Reset recorder keys to allow new recordings
        setSectionRecorderKeys((prev) => ({
          ...prev,
          [path]: (prev[path] || 0) + 1,
        }));

        setPlanRecorderKeys((prev) => ({
          ...prev,
          [path]: (prev[path] || 0) + 1,
        }));
      },
      [
        setProcessedSections,
        setProcessedPlans,
        setSectionRecorderKeys,
        setPlanRecorderKeys,
      ]
    );

    // IMPORTANT: Expose methods to the parent via ref
    React.useImperativeHandle(
      ref,
      () => ({
        updateFormWithLLMData,
        updatePlanTranscription,
        clearPlanTranscription,
        updateSectionTranscription,
        clearSectionTranscription,
        resetProcessedState,
      }),
      [
        updatePlanTranscription,
        clearPlanTranscription,
        updateFormWithLLMData,
        updateSectionTranscription,
        clearSectionTranscription,
        resetProcessedState,
      ]
    );

    // FIX: Only notify parent component of form data changes after initialization - MINIMAL FIX
    React.useEffect(() => {
      if (onChange && isInitialized) {
        onChange(state);
      }
    }, [state, onChange, isInitialized]);

    const handleTestAudioRecorded = React.useCallback(
      (base64Audio: string, testPath: string) => {
        // Clear any existing transcription when new audio is recorded
        clearPlanTranscription(testPath);

        // Reset recorder key to refresh the component
        setPlanRecorderKeys((prev) => ({
          ...prev,
          [testPath]: (prev[testPath] || 0) + 1,
        }));

        // Call the parent's audio recorded handler
        if (onAudioRecorded) {
          onAudioRecorded(base64Audio, testPath);
        }
      },
      [clearPlanTranscription, setPlanRecorderKeys, onAudioRecorded]
    );

    // Render section transcription box
    const renderSectionTranscriptionBox = (sectionPath: string) => {
      const transcription = sectionTranscriptions[sectionPath] || '';
      const isActiveSection = activeSectionPath === sectionPath;
      const isSelected = selectedSections.has(sectionPath);
      const isAlreadyProcessed = processedSections.has(sectionPath);
      const isCurrentlyProcessing = currentlyProcessingPath === sectionPath;
      const isInQueue = processingQueue.some(
        (item) => item.path === sectionPath
      );

      // GET RECORDING STATE FOR THIS SECTION
      const isRecording = recordingStates[sectionPath] || false;

      return (
        <SectionTranscriptionBox
          sectionPath={sectionPath}
          transcription={transcription}
          isActiveSection={isActiveSection}
          isSelected={isSelected}
          isAlreadyProcessed={isAlreadyProcessed}
          isCurrentlyProcessing={isCurrentlyProcessing}
          isInQueue={isInQueue}
          isWebSocketConnected={isWebSocketConnected}
          isProcessing={isProcessing}
          isAutoProcessing={isAutoProcessing}
          recordingMode={recordingMode}
          sectionRecorderKey={sectionRecorderKeys[sectionPath] || 0}
          isRecording={isRecording} // FIXED: Pass actual recording state
          onSectionSelection={handleSectionSelection}
          onTranscriptionClear={
            onSectionTranscriptionClear || clearSectionTranscription
          } // FIXED
          onSectionAudioRecorded={handleSectionAudioRecorded}
          onSectionTranscriptionProcess={handleSectionTranscriptionProcess}
          onTranscriptionChange={handleTranscriptionChange}
        />
      );
    };

    // Render plan transcription box
    const renderPlanTranscriptionBox = (planPath: string) => {
      const transcription = planTranscriptions[planPath] || '';
      const isAlreadyProcessed = processedPlans.has(planPath);
      const isCurrentlyProcessing = currentlyProcessingPath === planPath;
      const isInQueue = processingQueue.some((item) => item.path === planPath);

      return (
        <PlanTranscriptionBox
          planPath={planPath}
          transcription={transcription}
          isAlreadyProcessed={isAlreadyProcessed}
          isCurrentlyProcessing={isCurrentlyProcessing}
          isInQueue={isInQueue}
          isWebSocketConnected={isWebSocketConnected}
          isProcessing={isProcessing}
          isAutoProcessing={isAutoProcessing}
          recordingMode={recordingMode}
          planRecorderKey={planRecorderKeys[planPath] || 0}
          isRecording={recordingMode === 'global'}
          onPlanTranscriptionClear={clearPlanTranscription}
          onPlanAudioRecorded={handlePlanAudioRecorded}
          onPlanTranscriptionProcess={handlePlanTranscriptionProcess}
          onPlanTranscriptionChange={handlePlanTranscriptionChange}
        />
      );
    };

    // Render test transcription box (for Physio forms)
    const renderTestTranscriptionBox = (testPath: string) => {
      const transcription = planTranscriptions[testPath] || '';
      const isAlreadyProcessed = processedPlans.has(testPath);
      const isCurrentlyProcessing = currentlyProcessingPath === testPath;
      const isInQueue = processingQueue.some((item) => item.path === testPath);

      // GET RECORDING STATE FOR THIS TEST
      const isRecording = recordingStates[testPath] || false;

      // Determine if this test is currently being processed
      const isThisTestProcessing =
        isCurrentlyProcessing && (isProcessing || isAutoProcessing);

      return (
        <div
          className={`mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 ${
            isThisTestProcessing
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-green-50'
          }`}
        >
          <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <span
                className={`text-xs font-medium ${
                  isThisTestProcessing ? 'text-yellow-700' : 'text-green-700'
                }`}
              >
                Test Audio:
              </span>
              <FieldAudioRecorder
                key={`${testPath}-${planRecorderKeys[testPath] || 0}`}
                fieldPath={testPath}
                isDisabled={
                  !isWebSocketConnected ||
                  isProcessing ||
                  isAutoProcessing ||
                  isThisTestProcessing ||
                  (recordingMode === 'global' && transcription.trim() !== '')
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

              {/* Add loading spinner for this test */}
              {isThisTestProcessing && (
                <div className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
                  <span className="text-xs text-yellow-600">Processing...</span>
                </div>
              )}
            </div>
          </div>
          {/* Processing status indicator */}
          {isThisTestProcessing && (
            <div className="mb-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-yellow-600 border-t-transparent"></div>
              <span>AI is processing this test...</span>
            </div>
          )}
          {/* Override indicator */}
          {isAlreadyProcessed && !isThisTestProcessing && (
            <div className="mb-2 text-xs text-green-600 bg-green-100 p-1 rounded">
              ✓ This test has been processed. You can still record/type to
              override it.
            </div>
          )}
          {/* FIXED: Recording indicator */}
          {isRecording && (
            <div className="mb-2 text-xs text-red-600 bg-red-100 p-1 rounded flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>Recording in progress... Transcription is disabled.</span>
            </div>
          )}
          <TranscriptionBox
            value={transcription}
            onChange={(text) => handleTestTranscriptionChange(testPath, text)}
            isProcessing={isThisTestProcessing}
            autoProcess={() => {}}
            autoProcessDelay={5000}
            className={`min-h-12 text-sm ${
              isThisTestProcessing || isRecording
                ? 'opacity-60 cursor-not-allowed'
                : ''
            }`}
            placeholder={
              isThisTestProcessing
                ? 'Processing in progress...'
                : isRecording
                ? 'Recording in progress... Please wait.'
                : recordingMode === 'global' && transcription.trim() !== ''
                ? 'Global recording mode - test audio temporarily disabled'
                : isAlreadyProcessed
                ? 'This test is processed. Speak or type to override...'
                : 'Speak or type to enter information for this specific test...'
            }
            disabled={isThisTestProcessing || isRecording}
          />
        </div>
      );
    };

    // Determine the appropriate input field type based on the data type
    const renderInputForType = React.useCallback(
      (
        type: string,
        value: any,
        path: string,
        isLLMUpdated: boolean,
        placeholder?: string
      ) => {
        return (
          <InputField
            key={path} // Add key to prevent recreation
            type={type}
            value={value}
            path={path}
            isLLMUpdated={isLLMUpdated}
            placeholder={placeholder}
            onChange={handleUserChange} // Changed from handleChange for auto-submit cancellation
            onRejectLLMChange={rejectLLMChange}
          />
        );
      },
      [handleUserChange, rejectLLMChange]
    );

    // Render a field based on its type (string, number, object, array)
    const renderField = (
      fieldSchema: any,
      path: string,
      fieldName: string,
      parentIsArray: boolean = false
    ): JSX.Element => {
      // Skip "record" fields as requested
      if (fieldName === 'record') {
        return <></>;
      }

      // Get current value from state
      const value = path ? getNestedValue(state, path) : state;

      // Check if this field was updated by LLM
      const isLLMUpdated = llmUpdatedFields.has(path);

      // Check if this section should have audio recording
      const isTopLevelSection = shouldHaveAudioRecording(path, formKey);

      // Check if this is a plan that should have audio recording
      const isPlan = isPlanPath(path, formKey);

      // Check if this is a test that should have audio recording (for Physio forms)
      const isTest = isTestPath(path, formKey);

      // Skip rendering the "root" field label
      if (fieldName === 'root') {
        return (
          <div className="space-y-2">
            {/* Only render main form sections from FORM_SECTIONS */}
            {Object.entries(fieldSchema)
              .filter(([key, _]) => {
                const sections =
                  FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
                return sections.includes(key);
              })
              .map(([key, nestedSchema]) => (
                <div key={key} className="mb-3">
                  {renderField(
                    nestedSchema,
                    path ? `${path}.${key}` : key,
                    key
                  )}
                </div>
              ))}
          </div>
        );
      }

      // Handle different field types
      if (Array.isArray(fieldSchema)) {
        // It's an array of items
        const arrayPlaceholder =
          fieldName.charAt(0).toUpperCase() +
          fieldName
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();

        return (
          <div
            className={`mb-4 ${
              isLLMUpdated ? 'p-2 border-2 border-yellow-300 rounded' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">
                  {arrayPlaceholder}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-full touch-manipulation"
                  onClick={() => handleResetField(path)}
                  title="Reset this section"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Reset section</span>
                </Button>
              </div>

              {/* UPDATED: Use new ArrayItemControls for adding */}
              <ArrayItemControls
                itemPath={`${path}.0`} // dummy path for add button
                arrayPath={path}
                canRemove={false} // not applicable for add button
                onAdd={addArrayItem}
                onRemove={() => {}} // not used
                addButtonText={`Add ${
                  parentIsArray ? 'Item' : arrayPlaceholder.slice(0, -1)
                }`}
                className=""
                showOnlyAdd={true}
              />
            </div>

            {/* Add transcription box for top-level sections */}
            {/* {isTopLevelSection && renderSectionTranscriptionBox(path)} */}

            <div className="space-y-3">
              {value?.map((item: any, index: number) => {
                const itemPath = `${path}.${index}`;
                const isItemPlan = isPlanPath(itemPath, formKey);
                const isItemTest = isTestPath(itemPath, formKey);

                return (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-2 form-card-content">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-xs">
                          {arrayPlaceholder} {index + 1}
                        </h3>

                        {/* UPDATED: Use new ArrayItemControls for removing */}
                        <ArrayItemControls
                          itemPath={itemPath}
                          arrayPath={path}
                          canRemove={canRemoveArrayItem(itemPath)}
                          onAdd={() => {}} // not used here
                          onRemove={removeArrayItem}
                          removeButtonText="Remove"
                          showOnlyRemove={true}
                          variant="compact"
                        />
                      </div>

                      {/* Add transcription box for individual tests (Physio forms) */}
                      {isItemTest && renderTestTranscriptionBox(itemPath)}

                      {/* Render each field in the array item */}
                      <div className="space-y-2">
                        {Object.entries(fieldSchema[0] || {}).map(
                          ([key, subSchema]) => (
                            <div key={key} className="mb-2">
                              {renderField(
                                subSchema,
                                `${path}.${index}.${key}`,
                                key,
                                true
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {(!value || value.length === 0) && (
                <div className="text-center py-2 text-muted-foreground text-xs">
                  No {arrayPlaceholder.toLowerCase()} added yet
                </div>
              )}
            </div>
          </div>
        );
      } else if (typeof fieldSchema === 'object' && fieldSchema !== null) {
        // It's an object (nested fields)
        const sectionName =
          fieldName.charAt(0).toUpperCase() +
          fieldName
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();

        return (
          <div
            className={`mb-4 ${
              isLLMUpdated ? 'p-2 border-2 border-yellow-300 rounded' : ''
            }`}
          >
            {!parentIsArray && (
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-base font-semibold block">
                  {sectionName}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-full touch-manipulation"
                  onClick={() => handleResetField(path)}
                  title="Reset this section"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Reset section</span>
                </Button>
              </div>
            )}
            {/* Add transcription box for top-level sections */}
            {/* {isTopLevelSection && renderSectionTranscriptionBox(path)} */}
            <div
              className={parentIsArray ? '' : 'pl-2 border-l-2 border-border'}
            >
              {Object.entries(fieldSchema).map(([key, nestedSchema]) => (
                <div key={key} className="mb-2">
                  {renderField(
                    nestedSchema,
                    path ? `${path}.${key}` : key,
                    key
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      } else {
        // It's a primitive field (string, number, etc.)
        const fieldType = typeof fieldSchema;
        const labelText =
          fieldName.charAt(0).toUpperCase() +
          fieldName
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();

        return (
          <div
            className={`mb-3 ${
              isLLMUpdated ? 'transition-all duration-300' : ''
            }`}
            key={`field-${path}`} // Stable key to prevent recreation
          >
            <Label htmlFor={path} className="block mb-1 text-sm">
              {labelText}
            </Label>

            {fieldName.toLowerCase().includes('comment') ||
            fieldName.toLowerCase().includes('advice') ||
            fieldName.toLowerCase().includes('notes') ||
            fieldName.toLowerCase().includes('description')
              ? renderInputForType(
                  'textarea',
                  value,
                  path,
                  isLLMUpdated,
                  `Enter ${labelText.toLowerCase()}`
                )
              : renderInputForType(
                  fieldType,
                  value,
                  path,
                  isLLMUpdated,
                  `Enter ${labelText.toLowerCase()}`
                )}
          </div>
        );
      }
    };

    return (
      <div className="w-full max-w-screen">
        {/* Show processing queue status */}
        <ProcessingQueueAlert
          processingQueue={processingQueue}
          currentlyProcessingPath={currentlyProcessingPath}
        />

        {/* Show suggestions */}
        <SuggestionsAlert suggestions={suggestions} />

        {/* Show LLM updates */}
        <LLMUpdatesAlert
          onAcceptAll={acceptAllLLMChanges}
          llmUpdatedFields={llmUpdatedFields}
        />

        {/* AUTO-SUBMIT INDICATOR */}
        {pendingAutoSubmit && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm text-blue-700">
                Auto-submitting form in {Math.ceil(autoSubmitDelay / 1000)}{' '}
                seconds...
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('=== Auto-submit cancelled by user ===');
                  setPendingAutoSubmit(false);
                  isLLMUpdateInProgress.current = false;
                  if (autoSubmitTimeoutRef.current) {
                    clearTimeout(autoSubmitTimeoutRef.current);
                    autoSubmitTimeoutRef.current = null;
                  }
                }}
                className="ml-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">{renderField(schema, '', 'root')}</div>

        {/* Form action buttons with auto-submit support */}
        <FormActionButtons
          isSubmitting={isSubmitting || pendingAutoSubmit}
          onResetForm={handleResetForm}
          onSubmitForm={() => handleSubmitForm(false)} // false = manual submit
        />
      </div>
    );
  }
);

export default FormRenderer;
