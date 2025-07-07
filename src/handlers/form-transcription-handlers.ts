import React from 'react';
import { isPlanPath, isTestPath } from '@/utils/form-renderer.utils';

export interface TranscriptionHandlersProps {
  formKey: string;
  state: any;
  toast: any;
  selectedSections: Set<string>;
  recordingMode: 'idle' | 'global' | 'section';
  isProcessing: boolean;
  isAutoProcessing: boolean;
  currentlyProcessingPath: string | null;
  onTranscriptionProcess?: (transcription: string, context: any) => void;

  // Plan/Test states
  processedPlans: Set<string>;
  planTranscriptions: Record<string, string>;
  planRecorderKeys: Record<string, number>;

  // Section states
  processedSections: Set<string>;
  sectionTranscriptions: Record<string, string>;
  sectionRecorderKeys: Record<string, number>;

  // State setters
  setProcessedPlans: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPlanTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setPlanRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  setProcessedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSectionTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setSectionRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  setActivePlanTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setActiveSectionTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setIsAutoProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentlyProcessingPath: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setProcessingQueue: React.Dispatch<React.SetStateAction<any[]>>;

  // Refs
  pathTimeoutsRef: React.MutableRefObject<Map<string, NodeJS.Timeout>>;
  processingQueueRef: React.MutableRefObject<any[]>;
  addToProcessingQueue: (path: string, text: string) => void;
}

export const useTranscriptionHandlers = (props: TranscriptionHandlersProps) => {
  const {
    formKey,
    state,
    toast,
    selectedSections,
    recordingMode,
    isProcessing,
    isAutoProcessing,
    currentlyProcessingPath,
    onTranscriptionProcess,
    processedPlans,
    planTranscriptions,
    planRecorderKeys,
    processedSections,
    sectionTranscriptions,
    sectionRecorderKeys,
    setProcessedPlans,
    setPlanTranscriptions,
    setPlanRecorderKeys,
    setProcessedSections,
    setSectionTranscriptions,
    setSectionRecorderKeys,
    setActivePlanTranscription,
    setActiveSectionTranscription,
    setIsAutoProcessing,
    setCurrentlyProcessingPath,
    setProcessingQueue,
    pathTimeoutsRef,
    processingQueueRef,
    addToProcessingQueue,
  } = props;

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
      setProcessedPlans,
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

      setSectionTranscriptions((prev) => ({
        ...prev,
        [sectionPath]: text,
      }));
      setActiveSectionTranscription(sectionPath);
      addToProcessingQueue(sectionPath, text);
    },
    [
      processedSections,
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

  return {
    handleTestTranscriptionChange,
    handleTestTranscriptionProcess,
    updatePlanTranscription,
    clearPlanTranscription,
    updateSectionTranscription,
    clearSectionTranscription,
  };
};
