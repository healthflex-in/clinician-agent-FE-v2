// handlers/FormRenderer.handlers.ts
import { useCallback } from 'react';
import { defaultStateFromSchema } from '@/utils/schemaUtils';
import { graphqlRequest } from '@/utils/graphqlClient';
import { FormAction } from '../types/FormRenderer.types';
import { FORM_SECTIONS } from '../constants/FormRenderer.constants';
import {
  isPlanPath,
  isTestPath,
  processFormDataForSubmission,
  updateLocalStorageAfterSubmission,
} from '../utils/FormRenderer.utils';

export const useFormHandlers = (
  formKey: string,
  schema: any,
  state: any,
  dispatch: React.Dispatch<FormAction>,
  toast: any,
  appointmentId?: string,
  // State setters and getters
  sectionTranscriptions: Record<string, string>,
  planTranscriptions: Record<string, string>,
  processedSections: Set<string>,
  processedPlans: Set<string>,
  selectedSections: Set<string>,
  isProcessing: boolean,
  isAutoProcessing: boolean,
  currentlyProcessingPath: string | null,
  recordingMode: 'idle' | 'global' | 'section',
  onTranscriptionProcess?: (transcription: string, context: any) => void,
  onAudioRecorded?: (base64Audio: string, context: any) => void,
  // State setters
  setLlmUpdatedFields: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>,
  setIsAutoProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setCurrentlyProcessingPath: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setSectionTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >,
  setPlanTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >,
  setProcessedSections: React.Dispatch<React.SetStateAction<Set<string>>>,
  setProcessedPlans: React.Dispatch<React.SetStateAction<Set<string>>>,
  setActiveSectionTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setActivePlanTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setSectionRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >,
  setPlanRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >,
  setProcessingQueue: React.Dispatch<React.SetStateAction<any[]>>,
  // Refs and functions
  pathTimeoutsRef: React.MutableRefObject<Map<string, NodeJS.Timeout>>,
  processingQueueRef: React.MutableRefObject<any[]>,
  addToProcessingQueue: (path: string, text: string) => void
) => {
  // Field change handler
  const handleChange = useCallback(
    (path: string, value: any) => {
      setLlmUpdatedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
      dispatch({ type: 'UPDATE_FIELD', path, value });
    },
    [dispatch, setLlmUpdatedFields]
  );

  // Add array item handler
  const handleAddArrayItem = useCallback(
    (path: string, template: any) => {
      dispatch({ type: 'ADD_ARRAY_ITEM', path, template });
    },
    [dispatch]
  );

  // Remove array item handler
  const handleRemoveArrayItem = useCallback(
    (path: string, index: number) => {
      dispatch({ type: 'REMOVE_ARRAY_ITEM', path, index });
    },
    [dispatch]
  );

  // Accept all LLM changes
  const acceptAllLLMChanges = useCallback(() => {
    setLlmUpdatedFields(new Set());
    toast({
      title: 'Changes Accepted',
      description: 'All AI suggestions have been accepted',
    });
  }, [toast, setLlmUpdatedFields]);

  // Reject specific LLM change
  const rejectLLMChange = useCallback(
    (path: string) => {
      setLlmUpdatedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    },
    [setLlmUpdatedFields]
  );

  // Handle section selection
  const handleSectionSelection = useCallback(
    (sectionPath: string, checked: boolean) => {
      // This would need to be passed from parent component or managed differently
      // For now, this is a placeholder
      console.log(`Section selection: ${sectionPath}, checked: ${checked}`);
    },
    []
  );

  // Handle section audio recording
  const handleSectionAudioRecorded = useCallback(
    (base64Audio: string, sectionPath: string) => {
      if (!onAudioRecorded) return;

      const context = {
        formKey,
        formData: state,
        sectionPath,
        selectedSections: Array.from(selectedSections),
      };

      console.log(`Recording audio for section: ${sectionPath}`);
      onAudioRecorded(base64Audio, context);
    },
    [formKey, state, onAudioRecorded, selectedSections]
  );

  // Handle plan audio recording
  const handlePlanAudioRecorded = useCallback(
    (base64Audio: string, planPath: string) => {
      if (!onAudioRecorded) return;

      const context = {
        formKey,
        formData: state,
        // Use planPath for both plans and tests for compatibility
        planPath,
        selectedSections: Array.from(selectedSections),
      };

      console.log(`Recording audio for plan: ${planPath}`);
      onAudioRecorded(base64Audio, context);
    },
    [formKey, state, onAudioRecorded, selectedSections]
  );

  // Handle transcription changes
  const handleTranscriptionChange = useCallback(
    (sectionPath: string, text: string) => {
      console.log(`Manual transcription change for ${sectionPath}: "${text}"`);

      setSectionTranscriptions((prev) => ({
        ...prev,
        [sectionPath]: text,
      }));

      setProcessedSections((prev) => {
        const newSet = new Set(prev);
        newSet.delete(sectionPath);
        return newSet;
      });

      setActiveSectionTranscription(sectionPath);
      addToProcessingQueue(sectionPath, text);
    },
    [
      setSectionTranscriptions,
      setProcessedSections,
      setActiveSectionTranscription,
      addToProcessingQueue,
    ]
  );

  // Handle plan transcription changes
  const handlePlanTranscriptionChange = useCallback(
    (planPath: string, text: string) => {
      console.log(
        `Manual plan transcription change for ${planPath}: "${text}"`
      );

      if (recordingMode === 'global') {
        console.log(`Ignoring plan transcription change - global mode active`);
        return;
      }

      setPlanTranscriptions((prev) => ({
        ...prev,
        [planPath]: text,
      }));

      setProcessedPlans((prev) => {
        const newSet = new Set(prev);
        newSet.delete(planPath);
        return newSet;
      });

      setActivePlanTranscription(planPath);
      addToProcessingQueue(planPath, text);
    },
    [
      recordingMode,
      setPlanTranscriptions,
      setProcessedPlans,
      setActivePlanTranscription,
      addToProcessingQueue,
    ]
  );

  // Handle section transcription processing
  const handleSectionTranscriptionProcess = useCallback(
    (sectionPath: string) => {
      if (
        !onTranscriptionProcess ||
        isProcessing ||
        isAutoProcessing ||
        recordingMode === 'global'
      )
        return;
  
      console.log(`Manual processing request for section ${sectionPath}`);
  
      // Remove from queue if it exists
      processingQueueRef.current = processingQueueRef.current.filter(
        (item) => item.path !== sectionPath
      );
      setProcessingQueue([...processingQueueRef.current]);
  
      // Clear timeout
      const existingTimeout = pathTimeoutsRef.current.get(sectionPath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        pathTimeoutsRef.current.delete(sectionPath);
      }
  
      const transcription = sectionTranscriptions[sectionPath] || '';
  
      if (!transcription.trim()) {
        toast({
          title: 'Empty transcription',
          description: 'Please record audio or enter text to process',
          variant: 'destructive',
        });
        return;
      }
  
      // ALLOW REPROCESSING: Don't check if already processed
      // Users should be able to reprocess sections for corrections
      // const isAlreadyProcessed = processedSections.has(sectionPath);
      // if (isAlreadyProcessed) {
      //   console.log(`Section ${sectionPath} already processed, skipping`);
      //   return;
      // }
  
      // If it was already processed, remove it from processed state
      if (processedSections.has(sectionPath)) {
        console.log(`Section ${sectionPath} was already processed, allowing reprocessing`);
        setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.delete(sectionPath);
          return newSet;
        });
      }
  
      setIsAutoProcessing(true);
      setCurrentlyProcessingPath(sectionPath);
  
      const context = {
        formKey,
        formData: state,
        sectionPath,
        selectedSections: Array.from(selectedSections),
      };
  
      console.log(`Processing transcription for section: ${sectionPath}`);
  
      // Mark as processed after successful processing (this will be done in the success callback)
      onTranscriptionProcess(transcription, context);
    },
    [
      formKey,
      state,
      sectionTranscriptions,
      onTranscriptionProcess,
      toast,
      selectedSections,
      processedSections,
      isProcessing,
      isAutoProcessing,
      recordingMode,
      setIsAutoProcessing,
      setCurrentlyProcessingPath,
      setProcessedSections,
      setProcessingQueue,
      pathTimeoutsRef,
      processingQueueRef,
    ]
  );

  // Handle plan transcription processing
  const handlePlanTranscriptionProcess = useCallback(
    (planPath: string) => {
      if (
        !onTranscriptionProcess ||
        isProcessing ||
        isAutoProcessing ||
        recordingMode === 'global'
      )
        return;
  
      console.log(`Manual processing request for plan ${planPath}`);
  
      // Remove from queue if it exists
      processingQueueRef.current = processingQueueRef.current.filter(
        (item) => item.path !== planPath
      );
      setProcessingQueue([...processingQueueRef.current]);
  
      // Clear timeout
      const existingTimeout = pathTimeoutsRef.current.get(planPath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        pathTimeoutsRef.current.delete(planPath);
      }
  
      const transcription = planTranscriptions[planPath] || '';
  
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
      if (processedPlans.has(planPath)) {
        console.log(`Plan ${planPath} was already processed, allowing reprocessing`);
        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.delete(planPath);
          return newSet;
        });
      }
  
      setIsAutoProcessing(true);
      setCurrentlyProcessingPath(planPath);
  
      const context = {
        formKey,
        formData: state,
        planPath,
        selectedSections: Array.from(selectedSections),
      };
  
      console.log(`Processing transcription for plan: ${planPath}`);
  
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

  // Handle field reset
  const handleResetField = useCallback(
    (path: string) => {
      if (
        confirm(
          'Are you sure you want to reset this field to its default value?'
        )
      ) {
        dispatch({ type: 'RESET_FIELD', path });

        if (sectionTranscriptions[path]) {
          setSectionTranscriptions((prev) => ({
            ...prev,
            [path]: '',
          }));

          setProcessedSections((prev) => {
            const newSet = new Set(prev);
            newSet.delete(path);
            return newSet;
          });
        }

        if (isPlanPath(path, formKey) || isTestPath(path, formKey)) {
          setPlanTranscriptions((prev) => ({
            ...prev,
            [path]: '',
          }));

          setProcessedPlans((prev) => {
            const newSet = new Set(prev);
            newSet.delete(path);
            return newSet;
          });
        }

        const existingTimeout = pathTimeoutsRef.current.get(path);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          pathTimeoutsRef.current.delete(path);
        }

        processingQueueRef.current = processingQueueRef.current.filter(
          (item) => item.path !== path
        );
        setProcessingQueue([...processingQueueRef.current]);

        toast({
          title: 'Field Reset',
          description: 'Field has been reset to default value',
        });
      }
    },
    [
      dispatch,
      toast,
      sectionTranscriptions,
      formKey,
      setSectionTranscriptions,
      setPlanTranscriptions,
      setProcessedSections,
      setProcessedPlans,
      setProcessingQueue,
      pathTimeoutsRef,
      processingQueueRef,
    ]
  );

  // Reset form to initial state
  const handleResetForm = useCallback(() => {
    if (
      confirm(
        'Are you sure you want to reset this form? All your data will be lost.'
      )
    ) {
      pathTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      pathTimeoutsRef.current.clear();

      processingQueueRef.current = [];
      setProcessingQueue([]);
      setIsAutoProcessing(false);
      setCurrentlyProcessingPath(null);

      dispatch({ type: 'RESET_FORM', data: defaultStateFromSchema(schema) });
      setLlmUpdatedFields(new Set());

      const sections =
        FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
      const resetTranscriptions: Record<string, string> = {};
      sections.forEach((section) => {
        resetTranscriptions[section] = '';
      });
      setSectionTranscriptions(resetTranscriptions);

      setProcessedSections(new Set());
      setPlanTranscriptions({});
      setPlanRecorderKeys({});
      setProcessedPlans(new Set());

      toast({
        title: 'Form Reset',
        description: 'All form data has been reset to default values',
      });
    }
  }, [
    dispatch,
    schema,
    formKey,
    toast,
    setLlmUpdatedFields,
    setIsAutoProcessing,
    setCurrentlyProcessingPath,
    setSectionTranscriptions,
    setProcessedSections,
    setPlanTranscriptions,
    setPlanRecorderKeys,
    setProcessedPlans,
    setProcessingQueue,
    pathTimeoutsRef,
    processingQueueRef,
  ]);

  // Handle form submission
  const handleSubmitForm = useCallback(async () => {
    if (!appointmentId) {
      toast({
        title: 'Missing Information',
        description: 'Appointment ID is required to submit the form',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { input, formDataCopy } = processFormDataForSubmission(
        formKey,
        state
      );

      const mutation = `
        mutation UpdateAgentReport($appointmentId: ObjectID!, $input: UpdateAgentReportInput!) {
          updateAgentReport(appointmentId: $appointmentId, input: $input) {
            _id
            createdAt
            updatedAt
            version
            isActive
            isFilledCompletely
          }
        }
      `;

      const variables = {
        appointmentId,
        input,
      };

      console.log('Submitting data:', JSON.stringify(variables, null, 2));

      const result = await graphqlRequest(mutation, variables);

      if (result && result.updateAgentReport) {
        toast({
          title: 'Form Submitted',
          description: 'Your form has been successfully submitted',
        });

        updateLocalStorageAfterSubmission(formKey, state, formDataCopy, result);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your form',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [appointmentId, formKey, state, toast, setIsSubmitting]);

  return {
    handleChange,
    handleAddArrayItem,
    handleRemoveArrayItem,
    acceptAllLLMChanges,
    rejectLLMChange,
    handleSectionSelection,
    handleSectionAudioRecorded,
    handlePlanAudioRecorded,
    handleTranscriptionChange,
    handlePlanTranscriptionChange,
    handleSectionTranscriptionProcess,
    handlePlanTranscriptionProcess,
    handleResetField,
    handleResetForm,
    handleSubmitForm,
  };
};
