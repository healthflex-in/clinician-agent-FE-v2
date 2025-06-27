import React from 'react';

import { FormAction } from '@/types/form-renderer.types';
import { defaultStateFromSchema } from '@/utils/schema-utils';
import { FORM_SECTIONS } from '@/constants/form-renderer.constants';
import { isPlanPath, isTestPath } from '@/utils/form-renderer.utils';
import { updateAgentReport } from '@/utils/api';

export const useFormHandlers = (
  toast: any,
  state: any,
  schema: any,
  formKey: string,
  dispatch: React.Dispatch<FormAction>,

  // State getters
  isProcessing: boolean,
  isAutoProcessing: boolean,
  processedPlans: Set<string>,
  selectedSections: Set<string>,
  processedSections: Set<string>,
  currentlyProcessingPath: string | null,
  planTranscriptions: Record<string, string>,
  sectionTranscriptions: Record<string, string>,
  recordingMode: 'idle' | 'global' | 'section',

  // State setters
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>,
  setProcessingQueue: React.Dispatch<React.SetStateAction<any[]>>,
  setIsAutoProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setProcessedPlans: React.Dispatch<React.SetStateAction<Set<string>>>,
  setLlmUpdatedFields: React.Dispatch<React.SetStateAction<Set<string>>>,
  setProcessedSections: React.Dispatch<React.SetStateAction<Set<string>>>,
  setActivePlanTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setCurrentlyProcessingPath: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setPlanRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >,
  setActiveSectionTranscription: React.Dispatch<
    React.SetStateAction<string | null>
  >,
  setPlanTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >,
  setSectionRecorderKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >,
  setSectionTranscriptions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >,

  // Refs and functions
  processingQueueRef: React.MutableRefObject<any[]>,
  addToProcessingQueue: (path: string, text: string) => void,
  pathTimeoutsRef: React.MutableRefObject<Map<string, NodeJS.Timeout>>,

  isSubmitting: boolean,
  patientId: string,
  centerId?: string,

  // Optional parameters (these can now go after required parameters)
  appointmentId?: string,
  onRecordingStart?: (path?: string) => void,
  onRecordingStop?: (path?: string) => void,
  recordingStates?: { [path: string]: boolean },
  onAudioRecorded?: (base64Audio: string, context: any) => void,
  onTranscriptionProcess?: (transcription: string, context: any) => void,

  autoSubmitOnLLMUpdate?: boolean,
  onAutoSubmitScheduled?: () => void,
  onAutoSubmitCancelled?: () => void
) => {
  // Field change handler
  const handleChange = React.useCallback(
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
  const handleAddArrayItem = React.useCallback(
    (path: string, template: any) => {
      dispatch({ type: 'ADD_ARRAY_ITEM', path, template });
    },
    [dispatch]
  );

  // Remove array item handler
  const handleRemoveArrayItem = React.useCallback(
    (path: string, index: number) => {
      dispatch({ type: 'REMOVE_ARRAY_ITEM', path, index });
    },
    [dispatch]
  );

  // Accept all LLM changes
  const acceptAllLLMChanges = React.useCallback(() => {
    setLlmUpdatedFields(new Set());
    toast({
      title: 'Changes Accepted',
      description: 'All AI suggestions have been accepted',
    });
  }, [toast, setLlmUpdatedFields]);

  // Reject specific LLM change
  const rejectLLMChange = React.useCallback(
    (path: string) => {
      setLlmUpdatedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    },
    [setLlmUpdatedFields]
  );

  // Handle section audio recording with proper state management
  const handleSectionAudioRecorded = React.useCallback(
    (base64Audio: string, sectionPath: string) => {
      if (!onAudioRecorded) return;

      // NOTIFY PARENT THAT RECORDING STOPPED
      if (onRecordingStop) {
        onRecordingStop(sectionPath);
      }

      // Clear existing transcription for this section when new audio is recorded
      setSectionTranscriptions((prev) => ({
        ...prev,
        [sectionPath]: '', // Clear existing transcription
      }));

      // Remove from processed state if it exists (allow re-recording)
      setProcessedSections((prev) => {
        const newSet = new Set(prev);
        newSet.delete(sectionPath);
        return newSet;
      });

      // Reset recorder key to refresh the component
      setSectionRecorderKeys((prev) => ({
        ...prev,
        [sectionPath]: (prev[sectionPath] || 0) + 1,
      }));

      const context = {
        formKey,
        formData: state,
        sectionPath,
        selectedSections: Array.from(selectedSections),
        isOverride: Object.keys(state).length > 0, // Flag if form already has data
      };

      onAudioRecorded(base64Audio, context);
    },
    [
      formKey,
      state,
      onAudioRecorded,
      selectedSections,
      onRecordingStop,
      setProcessedSections,
      setSectionRecorderKeys,
      setSectionTranscriptions,
    ]
  );

  // FIXED: Handle plan audio recording with proper state management
  const handlePlanAudioRecorded = React.useCallback(
    (base64Audio: string, planPath: string) => {
      if (!onAudioRecorded) return;

      // NOTIFY PARENT THAT RECORDING STOPPED
      if (onRecordingStop) {
        onRecordingStop(planPath);
      }

      // Clear existing transcription for this plan when new audio is recorded
      setPlanTranscriptions((prev) => ({
        ...prev,
        [planPath]: '', // Clear existing transcription
      }));

      // Remove from processed state if it exists (allow re-recording)
      setProcessedPlans((prev) => {
        const newSet = new Set(prev);
        newSet.delete(planPath);
        return newSet;
      });

      // Reset recorder key to refresh the component
      setPlanRecorderKeys((prev) => ({
        ...prev,
        [planPath]: (prev[planPath] || 0) + 1,
      }));

      const context = {
        formKey,
        planPath,
        formData: state,
        selectedSections: Array.from(selectedSections),
        isOverride: Object.keys(state).length > 0, // Flag if form already has data
      };

      onAudioRecorded(base64Audio, context);
    },
    [
      formKey,
      state,
      onAudioRecorded,
      selectedSections,
      onRecordingStop,
      setPlanTranscriptions,
      setProcessedPlans,
      setPlanRecorderKeys,
    ]
  );

  // FIXED: Handle transcription changes with proper override behavior
  const handleTranscriptionChange = React.useCallback(
    (sectionPath: string, text: string) => {
      // Don't allow transcription changes during global recording
      if (recordingMode === 'global') {
        return;
      }

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
      recordingMode,
      processedSections,
      setSectionTranscriptions,
      setProcessedSections,
      setActiveSectionTranscription,
      addToProcessingQueue,
    ]
  );

  // FIXED: Handle plan transcription changes with proper override behavior
  const handlePlanTranscriptionChange = React.useCallback(
    (planPath: string, text: string) => {
      // Don't allow transcription changes during global recording
      if (recordingMode === 'global') {
        return;
      }

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
      recordingMode,
      processedPlans,
      setPlanTranscriptions,
      setProcessedPlans,
      setActivePlanTranscription,
      addToProcessingQueue,
    ]
  );

  // FIXED: Handle section transcription processing with override context
  const handleSectionTranscriptionProcess = React.useCallback(
    (sectionPath: string) => {
      if (
        !onTranscriptionProcess ||
        isProcessing ||
        isAutoProcessing ||
        recordingMode === 'global'
      )
        return;

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

      // Allow reprocessing - remove from processed state if it exists
      if (processedSections.has(sectionPath)) {
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
        recordingType: 'section',
        isOverride: Object.keys(state).length > 0,
        selectedSections: Array.from(selectedSections),
      };

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

  // FIXED: Handle plan transcription processing with override context
  const handlePlanTranscriptionProcess = React.useCallback(
    (planPath: string) => {
      if (
        !onTranscriptionProcess ||
        isProcessing ||
        isAutoProcessing ||
        recordingMode === 'global'
      )
        return;

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

      // Allow reprocessing - remove from processed state if it exists
      if (processedPlans.has(planPath)) {
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
        isOverride: Object.keys(state).length > 0, // Flag if this is an override
        recordingType: 'section',
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

  // FIXED: Handle field reset with proper cleanup
  const handleResetField = React.useCallback(
    (path: string) => {
      if (
        confirm(
          'Are you sure you want to reset this field to its default value?'
        )
      ) {
        dispatch({ type: 'RESET_FIELD', path });

        // Clear section transcriptions and states
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

          // Reset recorder key
          setSectionRecorderKeys((prev) => ({
            ...prev,
            [path]: (prev[path] || 0) + 1,
          }));
        }

        // Clear plan transcriptions and states for plans/tests
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

          // Reset recorder key
          setPlanRecorderKeys((prev) => ({
            ...prev,
            [path]: (prev[path] || 0) + 1,
          }));
        }

        // Clear timeouts and processing queue
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
      setSectionRecorderKeys,
      setPlanRecorderKeys,
      setProcessingQueue,
      pathTimeoutsRef,
      processingQueueRef,
    ]
  );

  /**
   * Prepare payload based on form schema/type
   * @param formKey The form identifier
   * @param formData The raw form data
   * @returns Transformed payload for the specific schema
   */
  // Dynamic payload preparation - works for both SNC and Assessment forms without conflicts
  const preparePayloadForSchema = React.useCallback(
    (formKey: string, formData: any): any => {
      console.log(`Preparing payload for formKey: ${formKey}`, formData);

      switch (formKey) {
        case 'physio':
          return preparePhysioAssessmentPayload(formData);

        case 'snc': {
          // SNC form handling - completely separate from assessment
          const data = prepareSNCExercisePayload(formData);
          console.log('SNC payload prepared:', data);
          return data;
        }

        case 'assessment': {
          // Assessment form handling - completely separate from SNC
          const data = prepareAssessmentPayload(formData);
          console.log('Assessment payload prepared:', data);
          return data;
        }

        default:
          // Default: return the form data as-is for other form types
          console.warn(
            `No specific payload preparation for formKey: ${formKey}`
          );
          return { [formKey]: formData };
      }
    },
    []
  );

  // Assessment payload preparation (NEW - only affects assessment forms)
  function prepareAssessmentPayload(formData: any) {
    console.log('prepareAssessmentPayload input:', formData);

    // Build assessment object exactly matching the required API format
    const assessmentObject = {
      plan: {
        advice: formData.plan?.advice || '',
        plans: [],
      },
      subjectiveAssessment: {
        assessment: formData.subjectiveAssessment?.assessment || '',
      },
      objectiveAssessment: {
        tests: Array.isArray(formData.objectiveAssessment?.tests)
          ? formData.objectiveAssessment.tests.map((test) => ({
              testName: test.testName || '',
              unitName: test.unitName || '',
              value: parseInt(test.value) || 0,
              left: parseInt(test.left) || 0,
              right: parseInt(test.right) || 0,
              comments: test.comments || '',
            }))
          : [],
      },
      rpe: {
        value: parseInt(formData.rpe?.value) || 0,
      },
    };

    // Process plans data - convert 'sets' array back to 'set' array for API
    const plans = formData.plan?.plans || [];

    if (Array.isArray(plans) && plans.length > 0) {
      assessmentObject.plan.plans = plans.map((plan) => {
        // Convert 'sets' array back to 'set' array for API compatibility
        let setArray = [];

        if (plan.sets && Array.isArray(plan.sets) && plan.sets.length > 0) {
          setArray = plan.sets.map((set) => ({
            repetitions: parseInt(set.repetitions) || 0,
            load: String(set.load || ''),
            unit: String(set.unit || ''),
          }));
        } else {
          // Default single set if no sets provided
          setArray = [
            {
              repetitions: 0,
              load: '',
              unit: '',
            },
          ];
        }

        return {
          exercise: String(plan.exercise || ''),
          comments: String(plan.comments || ''),
          set: setArray, // Assessment uses "set" array (different from SNC)
          duration: {
            value: parseInt(plan.duration?.value) || 0,
            unit: String(plan.duration?.unit || ''),
          },
        };
      });
    }

    console.log('prepareAssessmentPayload output:', {
      assessment: assessmentObject,
    });
    return { assessment: assessmentObject };
  }

  // FIXED: Reset form to initial state with proper cleanup
  const handleResetForm = React.useCallback(() => {
    if (
      confirm(
        'Are you sure you want to reset this form? All your data will be lost.'
      )
    ) {
      // Clear all timeouts
      pathTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      pathTimeoutsRef.current.clear();

      // Clear processing queue and states
      processingQueueRef.current = [];
      setProcessingQueue([]);
      setIsAutoProcessing(false);
      setCurrentlyProcessingPath(null);

      // Reset form data
      dispatch({ type: 'RESET_FORM', data: defaultStateFromSchema(schema) });
      setLlmUpdatedFields(new Set());

      // Reset all transcriptions
      const sections =
        FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
      const resetTranscriptions: Record<string, string> = {};
      const resetRecorderKeys: Record<string, number> = {};

      sections.forEach((section) => {
        resetTranscriptions[section] = '';
        resetRecorderKeys[section] = Date.now(); // Force re-render with unique keys
      });

      setSectionTranscriptions(resetTranscriptions);
      setSectionRecorderKeys(resetRecorderKeys);

      // Reset processed states
      setProcessedSections(new Set());
      setProcessedPlans(new Set());

      // Reset plan transcriptions and keys
      setPlanTranscriptions({});
      setPlanRecorderKeys({});

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
    setSectionRecorderKeys,
    setProcessedSections,
    setPlanTranscriptions,
    setPlanRecorderKeys,
    setProcessedPlans,
    setProcessingQueue,
    pathTimeoutsRef,
    processingQueueRef,
  ]);

  // Handle form submission (unchanged)
  const handleSubmitForm = React.useCallback(
    async (isAutoSubmit: boolean = false) => {
      if (isSubmitting) {
        return;
      }

      try {
        // FIXED: Ensure loading state is set immediately
        setIsSubmitting(true);

        const updateInput = {
          // patientId,
          appointmentId: appointmentId || '',
          // formKey,
          input: preparePayloadForSchema(formKey, state),
          ...(centerId && { centerId }),
        };

        const result = await updateAgentReport(updateInput);

        toast({
          title: isAutoSubmit ? 'Form Auto-Saved' : 'Form Saved',
          description: isAutoSubmit
            ? 'Form has been automatically saved after AI updates'
            : 'Form has been saved successfully',
          variant: 'default',
        });
      } catch (error) {
        console.error('Form submission error:', error);

        toast({
          title: 'Submission Failed',
          description: isAutoSubmit
            ? 'Auto-save failed. Please try submitting manually.'
            : 'Failed to save form. Please try again.',
          variant: 'destructive',
        });
      } finally {
        // FIXED: Always reset loading state
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      setIsSubmitting,
      formKey,
      state,
      appointmentId,
      centerId,
      toast,
      preparePayloadForSchema,
    ]
  );

  /**
   * FIXED: prepareSNCExercisePayload function to handle "sets" array correctly
   */
  function prepareSNCExercisePayload(formData: any) {
    // Check if formData already has the correct snc structure
    if (
      formData.snc &&
      typeof formData.snc === 'object' &&
      !Array.isArray(formData.snc)
    ) {
      return { snc: formData.snc };
    }

    // Build SNC object from form fields
    const sncObject = {
      advice:
        formData.advice ||
        formData.snc?.advice ||
        getFieldValue(formData, 'advice') ||
        '',

      plans: [],
    };

    // Look for plans data
    const plans =
      formData.plans || formData.snc?.plans || getFieldValue(formData, 'plans');

    if (Array.isArray(plans) && plans.length > 0) {
      sncObject.plans = plans.map((plan) => {
        // FIXED: Preserve sets as array instead of converting to single set object
        let setsData = [];

        // Strategy 1: Check for "sets" array (your form uses this)
        if (plan.sets && Array.isArray(plan.sets) && plan.sets.length > 0) {
          setsData = plan.sets.map((set) => ({
            repetitions: parseInt(set.repetitions) || 0,
            load: set.load || '',
            unit: set.unit || '',
          }));
        }
        // Strategy 2: Check for "set" object (legacy API format) - convert to array
        else if (plan.set && typeof plan.set === 'object') {
          setsData = [
            {
              repetitions: parseInt(plan.set.repetitions) || 0,
              load: plan.set.load || '',
              unit: plan.set.unit || '',
            },
          ];
        }
        // Strategy 3: Individual fields at plan level - create single set in array
        else {
          setsData = [
            {
              repetitions:
                parseInt(plan.repetitions) || parseInt(plan.reps) || 0,
              load: plan.load || plan.weight || '',
              unit: plan.unit || '',
            },
          ];
        }

        return {
          exercise: plan.exercise || '',
          comments: plan.comments || '',
          set: setsData,
          duration: {
            value: parseInt(plan.duration?.value) || 0,
            unit: plan.duration?.unit || '',
          },
        };
      });
    } else {
      // Default empty plan structure with sets array
      sncObject.plans = [
        {
          exercise: '',
          comments: '',
          set: [
            {
              repetitions: 0,
              load: '',
              unit: '',
            },
          ],
          duration: {
            value: 0,
            unit: '',
          },
        },
      ];
    }

    return { snc: sncObject };
  }

  // Helper function to search for field values in nested form data
  function getFieldValue(obj: any, fieldName: string): any {
    if (!obj || typeof obj !== 'object') return undefined;

    // Direct property access
    if (obj[fieldName] !== undefined) {
      return obj[fieldName];
    }

    // Search recursively in nested objects and arrays
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (Array.isArray(value)) {
          // Search in array items
          for (const item of value) {
            const found = getFieldValue(item, fieldName);
            if (found !== undefined) return found;
          }
        } else if (typeof value === 'object' && value !== null) {
          // Search in nested objects
          const found = getFieldValue(value, fieldName);
          if (found !== undefined) return found;
        }
      }
    }

    return undefined;
  }

  /**
   * Prepare payload for Physio Assessment forms
   */
  function preparePhysioAssessmentPayload(formData: any) {
    return {
      physioAssessment: {
        assessments: formData.assessments || [],
        plans: formData.plans || [],
        tests: formData.tests || [],
        recommendations: formData.recommendations || '',
        nextAppointment: formData.nextAppointment || '',
        // Transform any other fields as needed
        objectives: formData.objectives || [],
        contraindications: formData.contraindications || [],
      },
    };
  }

  /**
   * Prepare payload for Doctor Consultation forms
   */
  function prepareDoctorConsultationPayload(formData: any) {
    return {
      consultation: {
        chiefComplaint: formData.chiefComplaint || '',
        history: formData.history || '',
        examination: formData.examination || '',
        diagnosis: formData.diagnosis || '',
        treatment: formData.treatment || [],
        prescriptions: formData.prescriptions || [],
        followUp: formData.followUp || '',
      },
    };
  }

  /**
   * Prepare payload for Patient Intake forms
   */
  function preparePatientIntakePayload(formData: any) {
    return {
      intake: {
        personalInfo: formData.personalInfo || {},
        medicalHistory: formData.medicalHistory || {},
        currentSymptoms: formData.currentSymptoms || [],
        allergies: formData.allergies || [],
        medications: formData.medications || [],
        lifestyle: formData.lifestyle || {},
      },
    };
  }
  return {
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
  };
};
