// hooks/useFormRenderer.ts
import { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { defaultStateFromSchema } from '@/utils/schemaUtils';
import { formReducer } from '../reducers/FormRenderer.reducer';
import { FormAction, ProcessingQueueItem } from '../types/FormRenderer.types';
import {
  FORM_SECTIONS,
  AUTO_PROCESS_DELAY,
  QUEUE_RETRY_DELAY,
  NEXT_QUEUE_DELAY,
} from '../constants/FormRenderer.constants';
import { isPlanPath, isTestPath } from '../utils/FormRenderer.utils';

export const useFormRenderer = (
  schema: any,
  formKey: string,
  formData: any,
  recordingMode: 'idle' | 'global' | 'section',
  isProcessing: boolean,
  onTranscriptionProcess?: (transcription: string, context: any) => void,
  activeSectionPath?: string | null,
  selectedSections?: Set<string>
) => {
  const { toast } = useToast();

  // Initialize form state from schema or provided formData
  const initialState = formData || defaultStateFromSchema(schema);

  // Form state management
  const [llmUpdatedFields, setLlmUpdatedFields] = useState<Set<string>>(
    new Set()
  );
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [sectionTranscriptions, setSectionTranscriptions] = useState<
    Record<string, string>
  >({});
  const [planTranscriptions, setPlanTranscriptions] = useState<
    Record<string, string>
  >({});
  const [activeSectionTranscription, setActiveSectionTranscription] = useState<
    string | null
  >(null);
  const [activePlanTranscription, setActivePlanTranscription] = useState<
    string | null
  >(null);
  const [processedSections, setProcessedSections] = useState<Set<string>>(
    new Set()
  );
  const [processedPlans, setProcessedPlans] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<ProcessingQueueItem[]>(
    []
  );
  const [currentlyProcessingPath, setCurrentlyProcessingPath] = useState<
    string | null
  >(null);
  const [sectionRecorderKeys, setSectionRecorderKeys] = useState<
    Record<string, number>
  >({});
  const [planRecorderKeys, setPlanRecorderKeys] = useState<
    Record<string, number>
  >({});

  // Refs for managing timeouts and queue
  const pathTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processingQueueRef = useRef<ProcessingQueueItem[]>([]);

  // Form reducer with dependencies injected
  const wrappedReducer = useCallback(
    (state: any, action: FormAction) =>
      formReducer(state, action, schema, setLlmUpdatedFields, toast),
    [schema, toast]
  );

  const [state, dispatch] = useReducer(wrappedReducer, initialState);

  // Initialize section transcriptions with empty strings for all sections
  useEffect(() => {
    const sections = FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
    const initialTranscriptions: Record<string, string> = {};
    const initialRecorderKeys: Record<string, number> = {};

    sections.forEach((section) => {
      initialTranscriptions[section] = '';
      initialRecorderKeys[section] = 0;
    });

    setSectionTranscriptions(initialTranscriptions);
    setSectionRecorderKeys(initialRecorderKeys);
    setProcessedSections(new Set());
    setPlanTranscriptions({});
    setPlanRecorderKeys({});
    setProcessedPlans(new Set());
    setIsAutoProcessing(false);
    setProcessingQueue([]);
    setCurrentlyProcessingPath(null);
    processingQueueRef.current = [];
  }, [formKey]);

  // Clean up timeouts when component unmounts or recording mode changes
  useEffect(() => {
    pathTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    pathTimeoutsRef.current.clear();

    if (recordingMode === 'global') {
      console.log('Switching to global mode - clearing processing queue');
      processingQueueRef.current = [];
      setProcessingQueue([]);
      setIsAutoProcessing(false);
      setCurrentlyProcessingPath(null);
    }

    return () => {
      pathTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      pathTimeoutsRef.current.clear();
    };
  }, [recordingMode]);

  // Process queue sequentially
  const processNextInQueue = useCallback(async () => {
    if (
      isAutoProcessing ||
      processingQueueRef.current.length === 0 ||
      recordingMode === 'global' ||
      isProcessing
    ) {
      if (recordingMode === 'global') {
        console.log('Skipping queue processing - global recording mode active');
      }
      return;
    }

    const nextItem = processingQueueRef.current.shift();
    if (!nextItem) return;

    setProcessingQueue([...processingQueueRef.current]);
    setIsAutoProcessing(true);
    setCurrentlyProcessingPath(nextItem.path);

    console.log(`Processing queued item: ${nextItem.path}`);

    try {
      const isSection = nextItem.type === 'section';
      const isAlreadyProcessed = isSection
        ? processedSections.has(nextItem.path)
        : processedPlans.has(nextItem.path);

      if (isAlreadyProcessed) {
        console.log(`Item ${nextItem.path} already processed, skipping`);
        setIsAutoProcessing(false);
        setCurrentlyProcessingPath(null);
        setTimeout(() => processNextInQueue(), QUEUE_RETRY_DELAY);
        return;
      }

      const currentTranscription = isSection
        ? sectionTranscriptions[nextItem.path]
        : planTranscriptions[nextItem.path];

      if (!currentTranscription?.trim()) {
        console.log(`No transcription for ${nextItem.path}, skipping`);
        setIsAutoProcessing(false);
        setCurrentlyProcessingPath(null);
        setTimeout(() => processNextInQueue(), QUEUE_RETRY_DELAY);
        return;
      }

      if (recordingMode === 'global') {
        console.log(
          `Canceling processing for ${nextItem.path} - global mode detected`
        );
        setIsAutoProcessing(false);
        setCurrentlyProcessingPath(null);
        return;
      }

      // Mark as processed
      if (isSection) {
        setProcessedSections((prev) => new Set([...prev, nextItem.path]));
      } else {
        setProcessedPlans((prev) => new Set([...prev, nextItem.path]));
      }

      // Prepare context
      const context = {
        formKey,
        formData: state,
        [isSection ? 'sectionPath' : 'planPath']: nextItem.path,
        selectedSections: Array.from(selectedSections || new Set()),
      };

      // Process the transcription
      if (onTranscriptionProcess) {
        onTranscriptionProcess(currentTranscription, context);
      }
    } catch (error) {
      console.error('Error processing queue item:', error);
      setIsAutoProcessing(false);
      setCurrentlyProcessingPath(null);
      setTimeout(() => processNextInQueue(), QUEUE_RETRY_DELAY);
    }
  }, [
    isAutoProcessing,
    processedSections,
    processedPlans,
    sectionTranscriptions,
    planTranscriptions,
    formKey,
    state,
    selectedSections,
    onTranscriptionProcess,
    recordingMode,
    isProcessing,
  ]);

  // Add to processing queue
  const addToProcessingQueue = useCallback(
    (path: string, transcriptionText: string) => {
      console.log(`Adding to queue: ${path}`);

      if (recordingMode === 'global' || isProcessing) {
        console.log(
          `Skipping queue addition for ${path} - global processing active`
        );
        return;
      }

      const existingTimeout = pathTimeoutsRef.current.get(path);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      if (!transcriptionText.trim()) {
        return;
      }

      const isSection = Object.keys(sectionTranscriptions).includes(path);
      const isPlanOrTest = Object.keys(planTranscriptions).includes(path);

      if (isSection && processedSections.has(path)) {
        console.log(`Section ${path} already processed, not queueing`);
        return;
      }

      if (isPlanOrTest && processedPlans.has(path)) {
        console.log(`Plan/Test ${path} already processed, not queueing`);
        return;
      }

      if (
        recordingMode === 'section' &&
        isSection &&
        activeSectionPath !== path
      ) {
        console.log(
          `Skipping queue addition for ${path} - not the active section in section mode`
        );
        return;
      }

      const timeout = setTimeout(() => {
        if (recordingMode === 'global' || isProcessing) {
          console.log(
            `Canceling queue addition for ${path} - global processing started`
          );
          pathTimeoutsRef.current.delete(path);
          return;
        }

        const queueItem: ProcessingQueueItem = {
          path,
          type: isSection ? 'section' : 'plan', // Both plans and tests use 'plan' type
          transcription: transcriptionText,
          timestamp: Date.now(),
        };

        processingQueueRef.current = processingQueueRef.current.filter(
          (item) => item.path !== path
        );
        processingQueueRef.current.push(queueItem);
        setProcessingQueue([...processingQueueRef.current]);

        console.log(`Queued for processing: ${path}`);

        if (!isAutoProcessing && recordingMode !== 'global' && !isProcessing) {
          processNextInQueue();
        }

        pathTimeoutsRef.current.delete(path);
      }, AUTO_PROCESS_DELAY);

      pathTimeoutsRef.current.set(path, timeout);
    },
    [
      sectionTranscriptions,
      planTranscriptions,
      processedSections,
      processedPlans,
      isAutoProcessing,
      processNextInQueue,
      recordingMode,
      isProcessing,
      activeSectionPath,
    ]
  );

  // Reset auto-processing state when LLM processing completes
  useEffect(() => {
    if (!isProcessing && isAutoProcessing) {
      console.log('LLM processing completed, resetting auto-processing state');
      setIsAutoProcessing(false);
      setCurrentlyProcessingPath(null);

      setTimeout(() => {
        processNextInQueue();
      }, NEXT_QUEUE_DELAY);
    }
  }, [isProcessing, isAutoProcessing, processNextInQueue]);

  return {
    // State
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

    // Setters
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

    // Actions
    dispatch,
    addToProcessingQueue,
    processNextInQueue,

    // Refs
    pathTimeoutsRef,
    processingQueueRef,

    // Utils
    toast,
  };
};
