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

    // AUTO-SUBMIT TRIGGER FUNCTION
    const triggerAutoSubmit = React.useCallback(() => {
      if (!autoSubmitOnLLMUpdate) return;

      console.log('=== SCHEDULING AUTO-SUBMIT ===');

      // Mark that an LLM update occurred
      lastLLMUpdateRef.current = Date.now();
      setPendingAutoSubmit(true);

      // Clear any existing timeout
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }

      // Schedule auto-submit with delay
      autoSubmitTimeoutRef.current = setTimeout(() => {
        console.log('=== EXECUTING AUTO-SUBMIT ===');
        handleSubmitForm(true); // true = isAutoSubmit
        setPendingAutoSubmit(false);
        autoSubmitTimeoutRef.current = null;
      }, autoSubmitDelay);
    }, [autoSubmitOnLLMUpdate, autoSubmitDelay, handleSubmitForm]);

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
          console.log('=== CANCELLING AUTO-SUBMIT DUE TO USER INTERACTION ===');
          setPendingAutoSubmit(false);
          if (autoSubmitTimeoutRef.current) {
            clearTimeout(autoSubmitTimeoutRef.current);
            autoSubmitTimeoutRef.current = null;
          }
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
        console.log(
          `Manual test transcription change for ${testPath}: "${text}"`
        );

        if (recordingMode === 'global') {
          console.log(
            `Ignoring test transcription change - global mode active`
          );
          return;
        }

        // Allow override - remove from processed state if it exists
        if (processedPlans.has(testPath)) {
          console.log(
            `Test ${testPath} was already processed, but allowing override`
          );
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

        console.log(`Manual processing request for test ${testPath}`);

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
          console.log(
            `Test ${testPath} was already processed, allowing reprocessing`
          );
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

        console.log(`Processing transcription for test: ${testPath}`);

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
        console.log(
          `Updating plan transcription for ${planPath} with text: ${text}`
        );

        // Allow override - remove from processed state if it exists
        if (processedPlans.has(planPath)) {
          console.log(
            `Plan ${planPath} was already processed, but allowing override`
          );
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
        console.log(
          `Updating section transcription for ${sectionPath} with text: ${text}`
        );

        // Allow override - remove from processed state if it exists
        if (processedSections.has(sectionPath)) {
          console.log(
            `Section ${sectionPath} was already processed, but allowing override`
          );
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

    // Update form with LLM data - ENHANCED WITH AUTO-SUBMIT
    const updateFormWithLLMData = React.useCallback(
      (llmData: any) => {
        console.log('=== RECEIVED LLM DATA ===', llmData);

        // Handle structured payload (global processing)
        if (llmData.payloadType === 'structured' && llmData.formData) {
          console.log('Received structured form data - complete form filling');

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

          // **FIX: Extract the actual form data from the nested structure**
          const actualFormData = llmData.formData.formData || llmData.formData;

          llmData = { formData: actualFormData };

          // **TRIGGER AUTO-SUBMIT FOR STRUCTURED PAYLOADS**
          triggerAutoSubmit();
        }

        // Process suggestions
        if (llmData.suggestions) {
          setSuggestions(llmData.suggestions);
          setTimeout(() => setSuggestions(null), 7000);
        }

        // Process form data
        if (llmData.formData) {
          // Determine if this is a global or section-specific update
          const processingPath =
            llmData.currentlyProcessingPath || currentlyProcessingPath;
          const isGlobalUpdate =
            llmData.isGlobalRecording === true ||
            llmData.recordingType === 'global' ||
            (!processingPath && selectedSections.size === 0);

          console.log('=== FORM DATA TO APPLY ===', llmData.formData);
          console.log('=== IS GLOBAL UPDATE ===', isGlobalUpdate);

          if (isGlobalUpdate) {
            // GLOBAL UPDATE: Apply to entire form or selected sections
            console.log('=== APPLYING GLOBAL UPDATE ===');

            if (selectedSections.size === 0) {
              // No sections selected - update entire form
              console.log('=== ABOUT TO DISPATCH ===');
              console.log('dispatch function:', typeof dispatch, dispatch);
              console.log('Action object:', {
                type: 'MERGE_LLM_DATA',
                data: llmData.formData,
                source: 'llm',
              });

              dispatch({
                type: 'MERGE_LLM_DATA',
                data: llmData.formData,
                source: 'llm',
              });

              if (onLLMUpdate) onLLMUpdate(llmData.formData);
            } else {
              // Apply only to selected sections
              console.log(
                'Updating selected sections only:',
                Array.from(selectedSections)
              );
              const selectedSectionsData: any = {};
              Object.keys(llmData.formData).forEach((key) => {
                if (selectedSections.has(key)) {
                  selectedSectionsData[key] = llmData.formData[key];
                }
              });

              if (Object.keys(selectedSectionsData).length > 0) {
                dispatch({
                  type: 'MERGE_LLM_DATA',
                  data: selectedSectionsData,
                  source: 'llm',
                });
                if (onLLMUpdate) onLLMUpdate(selectedSectionsData);
              } else {
                toast({
                  title: 'No Updates for Selected Sections',
                  description:
                    'The AI did not provide data for your selected sections',
                });
              }
            }
          } else {
            // SECTION-SPECIFIC UPDATE: Apply only to the specific section/path
            console.log('=== APPLYING SECTION-SPECIFIC UPDATE ===');
            console.log('Target processing path:', processingPath);

            // Find the relevant data for this specific path
            const pathParts = processingPath.split('.');
            let relevantData: any = {};

            // Strategy 1: Try to extract data that belongs to this specific path
            if (pathParts.length === 1) {
              // Top-level section (e.g., "assessments", "plans")
              const sectionKey = pathParts[0];
              if (llmData.formData[sectionKey]) {
                relevantData[sectionKey] = llmData.formData[sectionKey];
                console.log('Found top-level section data for:', sectionKey);
              }
            } else if (pathParts.length >= 2) {
              // Nested path (e.g., "plans.0", "assessments.0.tests.1")
              const topLevelKey = pathParts[0];
              if (llmData.formData[topLevelKey]) {
                relevantData[topLevelKey] = llmData.formData[topLevelKey];
                console.log('Found nested section data for:', topLevelKey);
              }
            }

            // Strategy 2: If no specific match, be more selective
            if (Object.keys(relevantData).length === 0) {
              console.log('No direct match found, trying to find related data');

              // Look for any keys that might be related to the processing path
              const possibleKeys = Object.keys(llmData.formData).filter(
                (key) =>
                  processingPath.includes(key) || key.includes(pathParts[0])
              );

              if (possibleKeys.length > 0) {
                console.log('Found possible related keys:', possibleKeys);
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

            if (Object.keys(relevantData).length > 0) {
              console.log('Applying section-specific data:', relevantData);
              dispatch({
                type: 'MERGE_LLM_DATA',
                data: relevantData,
                source: 'llm',
              });
              if (onLLMUpdate) onLLMUpdate(relevantData);
            } else {
              toast({
                title: 'No Relevant Updates',
                description:
                  'The AI did not provide data relevant to this section',
              });
            }

            // Clear transcription for the specific path that was processed
            if (processingPath) {
              console.log(
                `=== CLEARING TRANSCRIPTION FOR PROCESSED PATH: ${processingPath} ===`
              );

              const isSection =
                Object.keys(sectionTranscriptions).includes(processingPath) ||
                processingPath.split('.').length === 1;

              if (isSection) {
                console.log(
                  'Clearing section transcription for:',
                  processingPath
                );
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
                console.log(
                  'Clearing plan/test transcription for:',
                  processingPath
                );
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

          // **TRIGGER AUTO-SUBMIT FOR REGULAR FORM DATA UPDATES**
          if (!llmData.payloadType) {
            triggerAutoSubmit();
          }
        }
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

    // 2. Add a cleanup function for resetting processed states
    const resetProcessedState = React.useCallback(
      (path: string) => {
        console.log('=== RESETTING PROCESSED STATE FOR:', path, '===');

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

    // Notify parent component when form data changes
    React.useEffect(() => {
      if (onChange) onChange(state);
    }, [state, onChange]);

    const handleTestAudioRecorded = React.useCallback(
      (base64Audio: string, testPath: string) => {
        console.log(`Test audio recorded for ${testPath}`);

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
    const renderInputForType = (
      type: string,
      value: any,
      path: string,
      isLLMUpdated: boolean,
      placeholder?: string
    ) => {
      return (
        <InputField
          type={type}
          value={value}
          path={path}
          isLLMUpdated={isLLMUpdated}
          placeholder={placeholder}
          onChange={handleUserChange} // Changed from handleChange for auto-submit cancellation
          onRejectLLMChange={rejectLLMChange}
        />
      );
    };

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
            {isTopLevelSection && renderSectionTranscriptionBox(path)}

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
            {isTopLevelSection && renderSectionTranscriptionBox(path)}
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
                  setPendingAutoSubmit(false);
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
