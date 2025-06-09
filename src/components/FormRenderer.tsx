// FormRenderer.tsx
import React, {
  useCallback,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { getNestedValue } from '@/utils/schemaUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  MinusCircle,
  PlusCircle,
  RefreshCw,
  SendHorizonal,
} from 'lucide-react';
import FieldAudioRecorder from './FieldAudioRecorder';
import TranscriptionBox from '@/components/audio/TranscriptionBox';

// Import modular components
import {
  FormRendererProps,
  FormRendererRef,
} from '../types/FormRenderer.types';
import { FORM_SECTIONS } from '../constants/FormRenderer.constants';
import {
  isPlanPath,
  isTestPath,
  shouldHaveAudioRecording,
} from '../utils/FormRenderer.utils';
import { useFormRenderer } from '../hooks/useFormRenderer';
import { useFormHandlers } from '../handlers/FormRenderer.handlers';
import {
  ProcessingQueueAlert,
  SuggestionsAlert,
  LLMUpdatesAlert,
  SectionTranscriptionBox,
  PlanTranscriptionBox,
  InputField,
  FormActionButtons,
} from './FormRenderer.components';

// Important: Use React.forwardRef here
const FormRenderer = forwardRef<FormRendererRef, FormRendererProps>(
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
    },
    ref
  ) => {
    // New state for selected sections - starts with empty set (none selected)
    const [selectedSections, setSelectedSections] = useState<Set<string>>(
      new Set()
    );

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
      formKey,
      schema,
      state,
      dispatch,
      toast,
      appointmentId,
      sectionTranscriptions,
      planTranscriptions,
      processedSections,
      processedPlans,
      selectedSections,
      isProcessing,
      isAutoProcessing,
      currentlyProcessingPath,
      recordingMode,
      onTranscriptionProcess,
      onAudioRecorded,
      setLlmUpdatedFields,
      setIsSubmitting,
      setIsAutoProcessing,
      setCurrentlyProcessingPath,
      setSectionTranscriptions,
      setPlanTranscriptions,
      setProcessedSections,
      setProcessedPlans,
      setActiveSectionTranscription,
      setActivePlanTranscription,
      setSectionRecorderKeys,
      setPlanRecorderKeys,
      setProcessingQueue,
      pathTimeoutsRef,
      processingQueueRef,
      addToProcessingQueue
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

    // Add section selection handler
    const handleSectionSelection = useCallback(
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

    // Handle test audio recording (for Physio forms)
    const handleTestAudioRecorded = useCallback(
      (base64Audio: string, testPath: string) => {
        if (!onAudioRecorded) return;

        const context = {
          formKey,
          formData: state,
          testPath, // Use testPath for tests
          selectedSections: Array.from(selectedSections),
        };

        console.log(`Recording audio for test: ${testPath}`);
        onAudioRecorded(base64Audio, context);
      },
      [formKey, state, onAudioRecorded, selectedSections]
    );

    // Handle test transcription changes (for Physio forms)
    const handleTestTranscriptionChange = useCallback(
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

        setPlanTranscriptions((prev) => ({
          ...prev,
          [testPath]: text,
        }));

        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.delete(testPath);
          return newSet;
        });

        setActivePlanTranscription(testPath);
        addToProcessingQueue(testPath, text);
      },
      [
        recordingMode,
        setPlanTranscriptions,
        setProcessedPlans,
        setActivePlanTranscription,
        addToProcessingQueue,
      ]
    );

    // Handle test transcription processing (for Physio forms)
    const handleTestTranscriptionProcess = useCallback(
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
        const isAlreadyProcessed = processedPlans.has(testPath);

        if (!transcription.trim()) {
          toast({
            title: 'Empty transcription',
            description: 'Please record audio or enter text to process',
            variant: 'destructive',
          });
          return;
        }

        if (isAlreadyProcessed) {
          console.log(`Test ${testPath} already processed, skipping`);
          return;
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

        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.add(testPath);
          return newSet;
        });

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
    const updatePlanTranscription = useCallback(
      (planPath: string, text: string) => {
        console.log(
          `Updating plan transcription for ${planPath} with text: ${text}`
        );

        if (processedPlans.has(planPath)) {
          console.log(`Ignoring update for ${planPath} - already processed`);
          return;
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
      ]
    );

    // Clear plan transcription
    const clearPlanTranscription = useCallback(
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
    const updateSectionTranscription = useCallback(
      (sectionPath: string, text: string) => {
        console.log(
          `Updating section transcription for ${sectionPath} with text: ${text}`
        );

        if (processedSections.has(sectionPath)) {
          console.log(`Ignoring update for ${sectionPath} - already processed`);
          return;
        }

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
      ]
    );

    // Clear section transcription
    const clearSectionTranscription = useCallback(
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

    // Update form with LLM data
    const updateFormWithLLMData = useCallback(
      (llmData: any) => {
        console.log('=== Updating form with LLM data ===');
        console.log('LLM Data:', llmData);
        console.log('Currently processing path:', currentlyProcessingPath);
        console.log('Recording mode:', recordingMode);

        // Handle structured payload (global processing)
        if (llmData.payloadType === 'structured' && llmData.formData) {
          console.log(
            'Received structured form data - stopping all processing and resetting for section mode'
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

          // CRITICAL: Reset processed sections to allow new recording
          // Don't mark all sections as processed for global mode
          setProcessedSections(new Set());
          setProcessedPlans(new Set());

          // Clear all transcriptions and reset recorder keys to enable fresh recording
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

          llmData = { formData: llmData.formData };
        }

        // Process suggestions
        if (llmData.suggestions) {
          setSuggestions(llmData.suggestions);
          setTimeout(() => setSuggestions(null), 7000);
        }

        // Process form data
        if (llmData.formData) {
          if (selectedSections.size === 0) {
            dispatch({
              type: 'MERGE_LLM_DATA',
              data: llmData.formData,
              source: 'llm',
            });
            if (onLLMUpdate) onLLMUpdate(llmData.formData);

            if (currentlyProcessingPath) {
              console.log(
                `Clearing transcription for currently processing: ${currentlyProcessingPath}`
              );

              const isSection = Object.keys(sectionTranscriptions).includes(
                currentlyProcessingPath
              );

              if (isSection) {
                setSectionTranscriptions((prev) => ({
                  ...prev,
                  [currentlyProcessingPath]: '',
                }));

                setSectionRecorderKeys((prev) => ({
                  ...prev,
                  [currentlyProcessingPath]:
                    (prev[currentlyProcessingPath] || 0) + 1,
                }));

                setProcessedSections((prev) => {
                  const newSet = new Set(prev);
                  newSet.add(currentlyProcessingPath);
                  return newSet;
                });

                if (activeSectionTranscription === currentlyProcessingPath) {
                  setActiveSectionTranscription(null);
                }
              } else {
                setPlanTranscriptions((prev) => ({
                  ...prev,
                  [currentlyProcessingPath]: '',
                }));

                setPlanRecorderKeys((prev) => ({
                  ...prev,
                  [currentlyProcessingPath]:
                    (prev[currentlyProcessingPath] || 0) + 1,
                }));

                setProcessedPlans((prev) => {
                  const newSet = new Set(prev);
                  newSet.add(currentlyProcessingPath);
                  return newSet;
                });

                if (activePlanTranscription === currentlyProcessingPath) {
                  setActivePlanTranscription(null);
                }
              }
            }
          } else {
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

              if (currentlyProcessingPath) {
                const isSection = Object.keys(sectionTranscriptions).includes(
                  currentlyProcessingPath
                );

                if (
                  isSection &&
                  selectedSections.has(currentlyProcessingPath)
                ) {
                  setSectionTranscriptions((prev) => ({
                    ...prev,
                    [currentlyProcessingPath]: '',
                  }));
                  setSectionRecorderKeys((prev) => ({
                    ...prev,
                    [currentlyProcessingPath]:
                      (prev[currentlyProcessingPath] || 0) + 1,
                  }));
                  setProcessedSections((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(currentlyProcessingPath);
                    return newSet;
                  });
                  if (activeSectionTranscription === currentlyProcessingPath) {
                    setActiveSectionTranscription(null);
                  }
                } else if (!isSection) {
                  setPlanTranscriptions((prev) => ({
                    ...prev,
                    [currentlyProcessingPath]: '',
                  }));
                  setPlanRecorderKeys((prev) => ({
                    ...prev,
                    [currentlyProcessingPath]:
                      (prev[currentlyProcessingPath] || 0) + 1,
                  }));
                  setProcessedPlans((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(currentlyProcessingPath);
                    return newSet;
                  });
                  if (activePlanTranscription === currentlyProcessingPath) {
                    setActivePlanTranscription(null);
                  }
                }
              }
            } else {
              toast({
                title: 'No Updates for Selected Sections',
                description:
                  'The AI did not provide data for your selected sections',
              });
            }
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
      ]
    );

    // IMPORTANT: Expose methods to the parent via ref
    useImperativeHandle(
      ref,
      () => ({
        updateFormWithLLMData,
        updateSectionTranscription,
        clearSectionTranscription,
      }),
      [
        updateFormWithLLMData,
        updateSectionTranscription,
        clearSectionTranscription,
      ]
    );

    // Notify parent component when form data changes
    useEffect(() => {
      if (onChange) onChange(state);
    }, [state, onChange]);

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
          onSectionSelection={handleSectionSelection}
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

      return (
        <div className="mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 bg-green-50">
          <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs font-medium text-green-700">
                Test Audio:
              </span>
              <FieldAudioRecorder
                key={`${testPath}-${planRecorderKeys[testPath] || 0}`}
                onAudioRecorded={(base64Audio) =>
                  handleTestAudioRecorded(base64Audio, testPath)
                }
                fieldPath={testPath}
                isDisabled={
                  !isWebSocketConnected ||
                  isProcessing ||
                  isAutoProcessing ||
                  (recordingMode === 'global' && transcription.trim() !== '')
                }
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation"
              onClick={() => handleTestTranscriptionProcess(testPath)}
              disabled={
                isProcessing ||
                isAutoProcessing ||
                !transcription.trim() ||
                !isWebSocketConnected ||
                isAlreadyProcessed ||
                (recordingMode === 'global' && transcription.trim() !== '')
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
            onChange={(text) => handleTestTranscriptionChange(testPath, text)}
            isProcessing={
              isCurrentlyProcessing && (isProcessing || isAutoProcessing)
            }
            autoProcess={() => {}}
            autoProcessDelay={5000}
            className="min-h-12 text-sm"
            placeholder={
              recordingMode === 'global' && transcription.trim() !== ''
                ? 'Global recording mode - test audio temporarily disabled'
                : 'Speak or type to enter information for this specific test...'
            }
            disabled={recordingMode === 'global' && transcription.trim() !== ''}
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
          onChange={handleChange}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex items-center gap-1 touch-manipulation"
                onClick={() => handleAddArrayItem(path, fieldSchema[0])}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add {parentIsArray ? 'Item' : arrayPlaceholder}</span>
              </Button>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 form-button touch-manipulation"
                          onClick={() => handleRemoveArrayItem(path, index)}
                        >
                          <MinusCircle className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>

                      {/* Add transcription box for individual plans */}
                      {isItemPlan && renderPlanTranscriptionBox(itemPath)}

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
      <div className="w-full max-w-screen pb-20">
        {/* Show processing queue status */}
        <ProcessingQueueAlert
          processingQueue={processingQueue}
          currentlyProcessingPath={currentlyProcessingPath}
        />

        {/* Show suggestions */}
        <SuggestionsAlert suggestions={suggestions} />

        {/* Show LLM updates */}
        <LLMUpdatesAlert
          llmUpdatedFields={llmUpdatedFields}
          onAcceptAll={acceptAllLLMChanges}
        />

        <div className="space-y-2">{renderField(schema, '', 'root')}</div>

        {/* Form action buttons */}
        <FormActionButtons
          onResetForm={handleResetForm}
          onSubmitForm={handleSubmitForm}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }
);

// Make sure to set a display name for debugging
FormRenderer.displayName = 'FormRenderer';

export default FormRenderer;
