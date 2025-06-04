import React, {
  useReducer,
  useCallback,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react';
import {
  defaultStateFromSchema,
  deepUpdateObject,
  getNestedValue,
  findDifferences,
} from '@/utils/schemaUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MinusCircle,
  PlusCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Mic,
  SendHorizonal,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import FieldAudioRecorder from './FieldAudioRecorder';
import TranscriptionBox from '@/components/audio/TranscriptionBox';
import { graphqlRequest, updateAgentReport } from '@/utils/graphqlClient';

interface FormRendererProps {
  schema: any;
  formKey: string;
  formData?: any;
  onChange?: (data: any) => void;
  onLLMUpdate?: (data: any) => void;
  onAudioRecorded?: (base64Audio: string, context: any) => void;
  onTranscriptionProcess?: (transcription: string, context: any) => void;
  isWebSocketConnected?: boolean;
  isProcessing?: boolean;
  recordingMode?: 'idle' | 'global' | 'section';
  activeSectionPath?: string | null;
  appointmentId?: string;
  patientId?: string;
}

// Action types for the reducer
type FormAction =
  | { type: 'UPDATE_FIELD'; path: string; value: any }
  | { type: 'ADD_ARRAY_ITEM'; path: string; template: any }
  | { type: 'REMOVE_ARRAY_ITEM'; path: string; index: number }
  | { type: 'RESET_FORM'; data: any }
  | { type: 'MERGE_LLM_DATA'; data: any; source: 'llm' }
  | { type: 'RESET_FIELD'; path: string };

// Type for the form renderer ref
export interface FormRendererRef {
  updateFormWithLLMData: (llmData: any) => void;
  updateSectionTranscription: (sectionPath: string, text: string) => void;
  clearSectionTranscription: (sectionPath: string) => void;
}

// Top-level section keys for each form type
const FORM_SECTIONS = {
  firstAssessment: [
    'clinicalDetails',
    'subjectiveAssessments',
    'subjectiveGoals',
    'objectiveGoals',
    'recommendation',
    'patientAdvice',
    'objectiveAssessments',
  ],
  assessment: ['plan', 'subjectiveAssessment', 'objectiveAssessment', 'rpe'],
  physio: ['tests'],
  snc: ['plans', 'advice'],
};

// Check if a path represents a plan item that should have audio recording
const isPlanPath = (path: string, formKey: string): boolean => {
  // For SNC forms: plans.0, plans.1, etc.
  if (formKey === 'snc') {
    return /^plans\.\d+$/.test(path);
  }

  // For Assessment forms: plan.plans.0, plan.plans.1, etc.
  if (formKey === 'assessment') {
    return /^plan\.plans\.\d+$/.test(path);
  }

  return false;
};

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
    // Track which fields were updated by LLM
    const [llmUpdatedFields, setLlmUpdatedFields] = useState<Set<string>>(
      new Set()
    );
    const [suggestions, setSuggestions] = useState<string | null>(null);
    const [sectionTranscriptions, setSectionTranscriptions] = useState<
      Record<string, string>
    >({});

    // NEW: Add plan-level transcriptions
    const [planTranscriptions, setPlanTranscriptions] = useState<
      Record<string, string>
    >({});

    const [activeSectionTranscription, setActiveSectionTranscription] =
      useState<string | null>(null);

    // NEW: Track active plan transcription
    const [activePlanTranscription, setActivePlanTranscription] = useState<
      string | null
    >(null);

    // New state for selected sections - starts with empty set (none selected)
    const [selectedSections, setSelectedSections] = useState<Set<string>>(
      new Set()
    );
    // Track processed sections to avoid repeated processing
    const [processedSections, setProcessedSections] = useState<Set<string>>(
      new Set()
    );

    // NEW: Track processed plans
    const [processedPlans, setProcessedPlans] = useState<Set<string>>(
      new Set()
    );

    // Add state for form submission
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track auto-processing timeouts for each section
    const autoProcessTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>(
      {}
    );

    // NEW: Track auto-processing timeouts for each plan
    const planAutoProcessTimeoutsRef = useRef<{
      [key: string]: NodeJS.Timeout;
    }>({});

    const { toast } = useToast();

    // Add state for forcing audio recorder reset in sections
    const [sectionRecorderKeys, setSectionRecorderKeys] = useState<
      Record<string, number>
    >({});

    // NEW: Add state for forcing audio recorder reset in plans
    const [planRecorderKeys, setPlanRecorderKeys] = useState<
      Record<string, number>
    >({});

    // Initialize section transcriptions with empty strings for all sections
    useEffect(() => {
      const sections =
        FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
      const initialTranscriptions: Record<string, string> = {};
      const initialRecorderKeys: Record<string, number> = {};

      sections.forEach((section) => {
        initialTranscriptions[section] = '';
        initialRecorderKeys[section] = 0;
      });

      setSectionTranscriptions(initialTranscriptions);
      setSectionRecorderKeys(initialRecorderKeys);
      // Reset processed sections when form key changes
      setProcessedSections(new Set());

      // NEW: Reset plan-related state
      setPlanTranscriptions({});
      setPlanRecorderKeys({});
      setProcessedPlans(new Set());
    }, [formKey]);

    // Clean up timeouts when component unmounts or recording mode changes
    useEffect(() => {
      // Clear all section timeouts when recording mode changes
      Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      autoProcessTimeoutsRef.current = {};

      // NEW: Clear all plan timeouts
      Object.values(planAutoProcessTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      planAutoProcessTimeoutsRef.current = {};

      return () => {
        // Clean up on unmount
        Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        Object.values(planAutoProcessTimeoutsRef.current).forEach(
          (timeoutId) => {
            clearTimeout(timeoutId);
          }
        );
      };
    }, [recordingMode]);

    // Initialize form state from schema or provided formData
    const initialState = formData || defaultStateFromSchema(schema);

    // IMPORTANT: Initialize the state BEFORE using it in callbacks
    const [state, dispatch] = useReducer(formReducer, initialState);

    // Reducer function to handle form state updates
    function formReducer(state: any, action: FormAction): any {
      switch (action.type) {
        case 'UPDATE_FIELD':
          return deepUpdateObject(state, action.path, action.value);
        case 'ADD_ARRAY_ITEM':
          const currentArray = getNestedValue(state, action.path) || [];
          return deepUpdateObject(state, action.path, [
            ...currentArray,
            defaultStateFromSchema(action.template),
          ]);
        case 'REMOVE_ARRAY_ITEM':
          const array = getNestedValue(state, action.path) || [];
          return deepUpdateObject(
            state,
            action.path,
            array.filter((_: any, i: number) => i !== action.index)
          );
        case 'RESET_FORM':
          return action.data;
        case 'MERGE_LLM_DATA': {
          const differences = findDifferences(state, action.data);

          if (action.source === 'llm' && differences.length > 0) {
            setLlmUpdatedFields((prev) => {
              const newSet = new Set(prev);
              differences.forEach((field) => newSet.add(field));
              return newSet;
            });

            toast({
              title: 'Form Updated by AI',
              description: `${differences.length} field(s) were updated`,
            });
          }

          const mergeDeep = (target: any, source: any): any => {
            if (typeof source !== 'object' || source === null) return target;

            for (const key of Object.keys(source)) {
              if (
                typeof source[key] === 'object' &&
                source[key] !== null &&
                !Array.isArray(source[key])
              ) {
                target[key] = mergeDeep(
                  { ...(target[key] || {}) },
                  source[key]
                );
              } else {
                target[key] = source[key];
              }
            }
            return target;
          };

          const newState = mergeDeep({ ...state }, action.data);
          return newState;
        }
        case 'RESET_FIELD': {
          const defaultValue = getNestedValue(
            defaultStateFromSchema(schema),
            action.path
          );
          return deepUpdateObject(state, action.path, defaultValue);
        }
        default:
          return state;
      }
    }

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

    // Check if a section should have audio recording
    const shouldHaveAudioRecording = (path: string): boolean => {
      const sections =
        FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];

      // For root level sections
      if (path && !path.includes('.')) {
        return sections.includes(path);
      }

      return false;
    };

    // NEW: Plan transcription update function
    const updatePlanTranscription = useCallback(
      (planPath: string, text: string) => {
        console.log(
          `Updating plan transcription for ${planPath} with text: ${text}`
        );

        // Skip if plan is already processed
        if (processedPlans.has(planPath)) {
          console.log(`Ignoring update for ${planPath} - already processed`);
          return;
        }

        // Update the transcription text
        setPlanTranscriptions((prev) => ({
          ...prev,
          [planPath]: text,
        }));
        setActivePlanTranscription(planPath);

        // Clear any existing timeout for this plan
        if (planAutoProcessTimeoutsRef.current[planPath]) {
          clearTimeout(planAutoProcessTimeoutsRef.current[planPath]);
        }

        // Set up auto-processing only if we have text and plan isn't processed
        if (text.trim() && !processedPlans.has(planPath)) {
          planAutoProcessTimeoutsRef.current[planPath] = setTimeout(() => {
            if (!processedPlans.has(planPath)) {
              console.log(`Auto-processing plan ${planPath} after inactivity`);
              handlePlanTranscriptionProcess(planPath);
            }
            delete planAutoProcessTimeoutsRef.current[planPath];
          }, 5000);
        }
      },
      [processedPlans]
    );

    // NEW: Clear plan transcription
    const clearPlanTranscription = useCallback((planPath: string) => {
      // Clear the transcription text
      setPlanTranscriptions((prev) => ({
        ...prev,
        [planPath]: '',
      }));

      // Reset processed status
      setProcessedPlans((prev) => {
        const newSet = new Set(prev);
        newSet.delete(planPath);
        return newSet;
      });

      setActivePlanTranscription(planPath);

      // Clear any existing timeout
      if (planAutoProcessTimeoutsRef.current[planPath]) {
        clearTimeout(planAutoProcessTimeoutsRef.current[planPath]);
        delete planAutoProcessTimeoutsRef.current[planPath];
      }
    }, []);

    // NEW: Plan transcription processing
    const handlePlanTranscriptionProcess = useCallback(
      (planPath: string) => {
        if (!onTranscriptionProcess) return;

        console.log(`Processing request for plan ${planPath}`);

        // Allow processing if plan has text and isn't already processed
        const transcription = planTranscriptions[planPath] || '';
        const isAlreadyProcessed = processedPlans.has(planPath);

        if (!transcription.trim()) {
          toast({
            title: 'Empty transcription',
            description: 'Please record audio or enter text to process',
            variant: 'destructive',
          });
          return;
        }

        if (isAlreadyProcessed) {
          console.log(`Plan ${planPath} already processed, skipping`);
          return;
        }

        // Send transcription with plan-specific context
        const context = {
          formKey,
          formData: state,
          planPath, // This is the specific plan path like "plans.0" or "plan.plans.1"
          selectedSections: Array.from(selectedSections),
        };

        console.log(`Processing transcription for plan: ${planPath}`);

        // Mark this plan as processed BEFORE sending
        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.add(planPath);
          return newSet;
        });

        // Clear any timeout for this plan
        if (planAutoProcessTimeoutsRef.current[planPath]) {
          clearTimeout(planAutoProcessTimeoutsRef.current[planPath]);
          delete planAutoProcessTimeoutsRef.current[planPath];
        }

        // Send the transcription
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
      ]
    );

    // NEW: Handle plan transcription manual changes
    const handlePlanTranscriptionChange = useCallback(
      (planPath: string, text: string) => {
        console.log(
          `Manual plan transcription change for ${planPath}: "${text}"`
        );

        // Always allow manual text changes
        setPlanTranscriptions((prev) => ({
          ...prev,
          [planPath]: text,
        }));

        // Reset processed status when text changes manually
        setProcessedPlans((prev) => {
          const newSet = new Set(prev);
          newSet.delete(planPath);
          console.log(
            `Removed ${planPath} from processed plans. New set:`,
            Array.from(newSet)
          );
          return newSet;
        });

        // Clear any existing timeout
        if (planAutoProcessTimeoutsRef.current[planPath]) {
          clearTimeout(planAutoProcessTimeoutsRef.current[planPath]);
          delete planAutoProcessTimeoutsRef.current[planPath];
        }

        // Set active plan for transcription
        setActivePlanTranscription(planPath);
        console.log(`Set active plan transcription to: ${planPath}`);
      },
      []
    );

    // CRITICAL FIX 1: Update the updateSectionTranscription function
    const updateSectionTranscription = useCallback(
      (sectionPath: string, text: string) => {
        console.log(
          `Updating section transcription for ${sectionPath} with text: ${text}`
        );

        // Skip if section is already processed
        if (processedSections.has(sectionPath)) {
          console.log(`Ignoring update for ${sectionPath} - already processed`);
          return;
        }

        // Allow updates in these cases:
        // 1. Section mode and this is the active section
        // 2. Idle mode (manual editing)
        // 3. No active section (first interaction)
        if (
          (recordingMode === 'section' && activeSectionPath === sectionPath) ||
          recordingMode === 'idle' ||
          !activeSectionPath
        ) {
          // Update the transcription text
          setSectionTranscriptions((prev) => ({
            ...prev,
            [sectionPath]: text,
          }));
          setActiveSectionTranscription(sectionPath);

          // Clear any existing timeout for this section
          if (autoProcessTimeoutsRef.current[sectionPath]) {
            clearTimeout(autoProcessTimeoutsRef.current[sectionPath]);
          }

          // Set up auto-processing only if we have text and section isn't processed
          if (text.trim() && !processedSections.has(sectionPath)) {
            autoProcessTimeoutsRef.current[sectionPath] = setTimeout(() => {
              if (!processedSections.has(sectionPath)) {
                console.log(
                  `Auto-processing section ${sectionPath} after inactivity`
                );
                handleSectionTranscriptionProcess(sectionPath);
              }
              delete autoProcessTimeoutsRef.current[sectionPath];
            }, 5000);
          }
        }
      },
      [processedSections, recordingMode, activeSectionPath]
    );

    // Clear section transcription
    const clearSectionTranscription = useCallback((sectionPath: string) => {
      // Clear the transcription text
      setSectionTranscriptions((prev) => ({
        ...prev,
        [sectionPath]: '',
      }));

      // Reset processed status
      setProcessedSections((prev) => {
        const newSet = new Set(prev);
        newSet.delete(sectionPath);
        return newSet;
      });

      setActiveSectionTranscription(sectionPath);

      // Clear any existing timeout
      if (autoProcessTimeoutsRef.current[sectionPath]) {
        clearTimeout(autoProcessTimeoutsRef.current[sectionPath]);
        delete autoProcessTimeoutsRef.current[sectionPath];
      }
    }, []);

    // CRITICAL FIX 2: Update the handleSectionTranscriptionProcess function
    const handleSectionTranscriptionProcess = useCallback(
      (sectionPath: string) => {
        if (!onTranscriptionProcess) return;

        console.log(`Processing request for section ${sectionPath}`);

        // Allow processing if section has text and isn't already processed
        const transcription = sectionTranscriptions[sectionPath] || '';
        const isAlreadyProcessed = processedSections.has(sectionPath);

        if (!transcription.trim()) {
          toast({
            title: 'Empty transcription',
            description: 'Please record audio or enter text to process',
            variant: 'destructive',
          });
          return;
        }

        if (isAlreadyProcessed) {
          console.log(`Section ${sectionPath} already processed, skipping`);
          return;
        }

        // Send transcription with section-specific context
        const context = {
          formKey,
          formData: state,
          sectionPath,
          selectedSections: Array.from(selectedSections),
        };

        console.log(`Processing transcription for section: ${sectionPath}`);

        // Mark this section as processed BEFORE sending
        setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.add(sectionPath);
          return newSet;
        });

        // Clear any timeout for this section
        if (autoProcessTimeoutsRef.current[sectionPath]) {
          clearTimeout(autoProcessTimeoutsRef.current[sectionPath]);
          delete autoProcessTimeoutsRef.current[sectionPath];
        }

        // Send the transcription
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
      ]
    );

    // Create wrapper for auto-processing
    const handleSectionAutoProcess = useCallback(
      (sectionPath: string) => {
        if (
          !processedSections.has(sectionPath) &&
          sectionTranscriptions[sectionPath]?.trim()
        ) {
          handleSectionTranscriptionProcess(sectionPath);
        }
      },
      [
        handleSectionTranscriptionProcess,
        processedSections,
        sectionTranscriptions,
      ]
    );

    // NEW: Create wrapper for plan auto-processing
    const handlePlanAutoProcess = useCallback(
      (planPath: string) => {
        if (
          !processedPlans.has(planPath) &&
          planTranscriptions[planPath]?.trim()
        ) {
          handlePlanTranscriptionProcess(planPath);
        }
      },
      [handlePlanTranscriptionProcess, processedPlans, planTranscriptions]
    );

    // CRITICAL FIX 3: Update the handleTranscriptionChange function
    const handleTranscriptionChange = useCallback(
      (sectionPath: string, text: string) => {
        console.log(
          `Manual transcription change for ${sectionPath}: "${text}"`
        );

        // Always allow manual text changes
        setSectionTranscriptions((prev) => ({
          ...prev,
          [sectionPath]: text,
        }));

        // Reset processed status when text changes manually (important for reprocessing)
        setProcessedSections((prev) => {
          const newSet = new Set(prev);
          newSet.delete(sectionPath);
          console.log(
            `Removed ${sectionPath} from processed sections. New set:`,
            Array.from(newSet)
          );
          return newSet;
        });

        // Clear any existing timeout
        if (autoProcessTimeoutsRef.current[sectionPath]) {
          clearTimeout(autoProcessTimeoutsRef.current[sectionPath]);
          delete autoProcessTimeoutsRef.current[sectionPath];
        }

        // Set active section for transcription
        setActiveSectionTranscription(sectionPath);
        console.log(`Set active section transcription to: ${sectionPath}`);
      },
      []
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

          // Also clear the transcription for this section if it exists
          if (sectionTranscriptions[path]) {
            setSectionTranscriptions((prev) => ({
              ...prev,
              [path]: '',
            }));

            // Remove from processed sections
            setProcessedSections((prev) => {
              const newSet = new Set(prev);
              newSet.delete(path);
              return newSet;
            });

            // Clear any timeout for this section
            if (autoProcessTimeoutsRef.current[path]) {
              clearTimeout(autoProcessTimeoutsRef.current[path]);
              delete autoProcessTimeoutsRef.current[path];
            }
          }

          // NEW: Also clear plan transcription if it's a plan path
          if (isPlanPath(path, formKey)) {
            setPlanTranscriptions((prev) => ({
              ...prev,
              [path]: '',
            }));

            // Remove from processed plans
            setProcessedPlans((prev) => {
              const newSet = new Set(prev);
              newSet.delete(path);
              return newSet;
            });

            // Clear any timeout for this plan
            if (planAutoProcessTimeoutsRef.current[path]) {
              clearTimeout(planAutoProcessTimeoutsRef.current[path]);
              delete planAutoProcessTimeoutsRef.current[path];
            }
          }

          toast({
            title: 'Field Reset',
            description: 'Field has been reset to default value',
          });
        }
      },
      [toast, sectionTranscriptions, formKey]
    );

    // CRITICAL FIX 4: Update the updateFormWithLLMData function
    const updateFormWithLLMData = useCallback(
      (llmData: any) => {
        console.log('=== Updating form with LLM data ===');
        console.log('LLM Data:', llmData);
        console.log(
          'Active section transcription:',
          activeSectionTranscription
        );
        console.log('Active plan transcription:', activePlanTranscription);
        console.log('Selected sections:', Array.from(selectedSections));
        console.log('Current transcriptions:', sectionTranscriptions);
        console.log('Current plan transcriptions:', planTranscriptions);

        // Handle structured payload
        if (llmData.payloadType === 'structured' && llmData.formData) {
          console.log(
            'Received structured form data - stopping all processing'
          );

          // Mark ALL sections as processed and clear all transcriptions
          const allSections =
            FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
          setProcessedSections(new Set(allSections));

          // Clear all section transcriptions
          const clearedTranscriptions: Record<string, string> = {};
          const resetRecorderKeys: Record<string, number> = {};
          allSections.forEach((section) => {
            clearedTranscriptions[section] = '';
            resetRecorderKeys[section] =
              (sectionRecorderKeys[section] || 0) + 1;
          });
          setSectionTranscriptions(clearedTranscriptions);
          setSectionRecorderKeys(resetRecorderKeys);

          // NEW: Clear all plan transcriptions
          setPlanTranscriptions({});
          setPlanRecorderKeys({});
          setProcessedPlans(new Set());

          // Clear all timeouts
          Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
            clearTimeout(timeoutId);
          });
          autoProcessTimeoutsRef.current = {};

          Object.values(planAutoProcessTimeoutsRef.current).forEach(
            (timeoutId) => {
              clearTimeout(timeoutId);
            }
          );
          planAutoProcessTimeoutsRef.current = {};

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
            // Update all sections
            dispatch({
              type: 'MERGE_LLM_DATA',
              data: llmData.formData,
              source: 'llm',
            });
            if (onLLMUpdate) onLLMUpdate(llmData.formData);

            // Clear transcription for active section when updating all sections
            if (activeSectionTranscription) {
              const sectionToProcess = activeSectionTranscription;
              console.log(
                `Clearing transcription for section: ${sectionToProcess}`
              );

              // Clear the transcription for the processed section
              setSectionTranscriptions((prev) => {
                console.log(`Previous transcriptions:`, prev);
                const newTranscriptions = {
                  ...prev,
                  [sectionToProcess]: '',
                };
                console.log(`New transcriptions:`, newTranscriptions);
                return newTranscriptions;
              });

              // Force reset of section audio recorder
              setSectionRecorderKeys((prev) => ({
                ...prev,
                [sectionToProcess]: (prev[sectionToProcess] || 0) + 1,
              }));

              // Mark section as processed
              setProcessedSections((prev) => {
                const newSet = new Set(prev);
                newSet.add(sectionToProcess);
                return newSet;
              });

              // Clear timeout for processed section
              if (autoProcessTimeoutsRef.current[sectionToProcess]) {
                clearTimeout(autoProcessTimeoutsRef.current[sectionToProcess]);
                delete autoProcessTimeoutsRef.current[sectionToProcess];
              }

              // Reset active section transcription
              setActiveSectionTranscription(null);
            }

            // NEW: Clear transcription for active plan when updating
            if (activePlanTranscription) {
              const planToProcess = activePlanTranscription;
              console.log(`Clearing transcription for plan: ${planToProcess}`);

              // Clear the transcription for the processed plan
              setPlanTranscriptions((prev) => {
                console.log(`Previous plan transcriptions:`, prev);
                const newTranscriptions = {
                  ...prev,
                  [planToProcess]: '',
                };
                console.log(`New plan transcriptions:`, newTranscriptions);
                return newTranscriptions;
              });

              // Force reset of plan audio recorder
              setPlanRecorderKeys((prev) => ({
                ...prev,
                [planToProcess]: (prev[planToProcess] || 0) + 1,
              }));

              // Mark plan as processed
              setProcessedPlans((prev) => {
                const newSet = new Set(prev);
                newSet.add(planToProcess);
                return newSet;
              });

              // Clear timeout for processed plan
              if (planAutoProcessTimeoutsRef.current[planToProcess]) {
                clearTimeout(planAutoProcessTimeoutsRef.current[planToProcess]);
                delete planAutoProcessTimeoutsRef.current[planToProcess];
              }

              // Reset active plan transcription
              setActivePlanTranscription(null);
            } else {
              // FALLBACK: If no active plan but we have form data, check if any plan has text
              console.log(
                'No active plan, checking for plans with transcription text'
              );
              const plansWithText = Object.entries(planTranscriptions).filter(
                ([_, text]) => text.trim()
              );
              console.log('Plans with text:', plansWithText);

              if (plansWithText.length > 0) {
                // Clear the first plan with text (or all plans with text)
                setPlanTranscriptions((prev) => {
                  const newTranscriptions = { ...prev };
                  plansWithText.forEach(([planPath, _]) => {
                    console.log(
                      `Clearing transcription for plan (fallback): ${planPath}`
                    );
                    newTranscriptions[planPath] = '';

                    // Also reset the recorder for this plan
                    setPlanRecorderKeys((prevKeys) => ({
                      ...prevKeys,
                      [planPath]: (prevKeys[planPath] || 0) + 1,
                    }));

                    // Mark as processed
                    setProcessedPlans((prevProcessed) => {
                      const newSet = new Set(prevProcessed);
                      newSet.add(planPath);
                      return newSet;
                    });
                  });
                  return newTranscriptions;
                });
              }
            }

            // Also handle section fallback as before
            if (!activeSectionTranscription) {
              console.log(
                'No active section, checking for sections with transcription text'
              );
              const sectionsWithText = Object.entries(
                sectionTranscriptions
              ).filter(([_, text]) => text.trim());
              console.log('Sections with text:', sectionsWithText);

              if (sectionsWithText.length > 0) {
                // Clear the first section with text (or all sections with text)
                setSectionTranscriptions((prev) => {
                  const newTranscriptions = { ...prev };
                  sectionsWithText.forEach(([sectionPath, _]) => {
                    console.log(
                      `Clearing transcription for section (fallback): ${sectionPath}`
                    );
                    newTranscriptions[sectionPath] = '';

                    // Also reset the recorder for this section
                    setSectionRecorderKeys((prevKeys) => ({
                      ...prevKeys,
                      [sectionPath]: (prevKeys[sectionPath] || 0) + 1,
                    }));

                    // Mark as processed
                    setProcessedSections((prevProcessed) => {
                      const newSet = new Set(prevProcessed);
                      newSet.add(sectionPath);
                      return newSet;
                    });
                  });
                  return newTranscriptions;
                });
              }
            }
          } else {
            // Only update selected sections
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

              // Clear transcription for the active section if it was updated
              if (
                activeSectionTranscription &&
                selectedSections.has(activeSectionTranscription)
              ) {
                const sectionToProcess = activeSectionTranscription;
                console.log(
                  `Clearing transcription for selected section: ${sectionToProcess}`
                );

                // Clear the transcription for the processed section
                setSectionTranscriptions((prev) => {
                  console.log(`Previous transcriptions:`, prev);
                  const newTranscriptions = {
                    ...prev,
                    [sectionToProcess]: '',
                  };
                  console.log(`New transcriptions:`, newTranscriptions);
                  return newTranscriptions;
                });

                // Force reset of section audio recorder
                setSectionRecorderKeys((prev) => ({
                  ...prev,
                  [sectionToProcess]: (prev[sectionToProcess] || 0) + 1,
                }));

                // Mark section as processed
                setProcessedSections((prev) => {
                  const newSet = new Set(prev);
                  newSet.add(sectionToProcess);
                  return newSet;
                });

                // Clear timeout for processed section
                if (autoProcessTimeoutsRef.current[sectionToProcess]) {
                  clearTimeout(
                    autoProcessTimeoutsRef.current[sectionToProcess]
                  );
                  delete autoProcessTimeoutsRef.current[sectionToProcess];
                }

                // Reset active section transcription
                setActiveSectionTranscription(null);
              }

              // NEW: Clear transcription for the active plan if it was updated
              if (activePlanTranscription) {
                const planToProcess = activePlanTranscription;
                console.log(
                  `Clearing transcription for selected plan: ${planToProcess}`
                );

                // Clear the transcription for the processed plan
                setPlanTranscriptions((prev) => {
                  console.log(`Previous plan transcriptions:`, prev);
                  const newTranscriptions = {
                    ...prev,
                    [planToProcess]: '',
                  };
                  console.log(`New plan transcriptions:`, newTranscriptions);
                  return newTranscriptions;
                });

                // Force reset of plan audio recorder
                setPlanRecorderKeys((prev) => ({
                  ...prev,
                  [planToProcess]: (prev[planToProcess] || 0) + 1,
                }));

                // Mark plan as processed
                setProcessedPlans((prev) => {
                  const newSet = new Set(prev);
                  newSet.add(planToProcess);
                  return newSet;
                });

                // Clear timeout for processed plan
                if (planAutoProcessTimeoutsRef.current[planToProcess]) {
                  clearTimeout(
                    planAutoProcessTimeoutsRef.current[planToProcess]
                  );
                  delete planAutoProcessTimeoutsRef.current[planToProcess];
                }

                // Reset active plan transcription
                setActivePlanTranscription(null);
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
        activeSectionTranscription,
        activePlanTranscription,
        formKey,
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

    // Field change handler
    const handleChange = useCallback((path: string, value: any) => {
      // When user changes a field, remove it from the LLM updated fields list
      setLlmUpdatedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });

      dispatch({ type: 'UPDATE_FIELD', path, value });
    }, []);

    // Add array item handler
    const handleAddArrayItem = useCallback((path: string, template: any) => {
      dispatch({ type: 'ADD_ARRAY_ITEM', path, template });
    }, []);

    // Remove array item handler
    const handleRemoveArrayItem = useCallback((path: string, index: number) => {
      dispatch({ type: 'REMOVE_ARRAY_ITEM', path, index });
    }, []);

    // Accept all LLM changes
    const acceptAllLLMChanges = useCallback(() => {
      setLlmUpdatedFields(new Set());
      toast({
        title: 'Changes Accepted',
        description: 'All AI suggestions have been accepted',
      });
    }, [toast]);

    // Reject specific LLM change
    const rejectLLMChange = useCallback((path: string) => {
      // Remove the path from LLM updated fields
      setLlmUpdatedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    }, []);

    // Handle section audio recording
    const handleSectionAudioRecorded = useCallback(
      (base64Audio: string, sectionPath: string) => {
        if (!onAudioRecorded) return;

        // Send audio with section-specific context
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

    // NEW: Handle plan audio recording
    const handlePlanAudioRecorded = useCallback(
      (base64Audio: string, planPath: string) => {
        if (!onAudioRecorded) return;

        // Send audio with plan-specific context
        const context = {
          formKey,
          formData: state,
          planPath, // This is the specific plan path like "plans.0" or "plan.plans.1"
          selectedSections: Array.from(selectedSections),
        };

        console.log(`Recording audio for plan: ${planPath}`);
        onAudioRecorded(base64Audio, context);
      },
      [formKey, state, onAudioRecorded, selectedSections]
    );

    // CRITICAL FIX 5: Update the renderSectionTranscriptionBox function
    const renderSectionTranscriptionBox = (sectionPath: string) => {
      const transcription = sectionTranscriptions[sectionPath] || '';
      const isActiveSection = activeSectionPath === sectionPath;
      const isSelected = selectedSections.has(sectionPath);
      const isAlreadyProcessed = processedSections.has(sectionPath);

      return (
        <div className="mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 bg-gray-50">
          <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Checkbox
                  id={`select-${sectionPath}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    handleSectionSelection(sectionPath, checked === true)
                  }
                  className="border-black text-black form-checkbox touch-manipulation"
                />
                <label
                  htmlFor={`select-${sectionPath}`}
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Process
                </label>
              </div>
              <FieldAudioRecorder
                key={`${sectionPath}-${sectionRecorderKeys[sectionPath] || 0}`} // Force reset when key changes
                onAudioRecorded={(base64Audio) =>
                  handleSectionAudioRecorded(base64Audio, sectionPath)
                }
                fieldPath={sectionPath}
                isDisabled={
                  !isWebSocketConnected ||
                  isProcessing ||
                  recordingMode === 'global'
                }
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation"
              onClick={() => handleSectionTranscriptionProcess(sectionPath)}
              disabled={
                isProcessing ||
                !transcription.trim() ||
                !isWebSocketConnected ||
                isAlreadyProcessed
              }
            >
              <SendHorizonal className="h-4 w-4" />
              <span>{isAlreadyProcessed ? 'Processed' : 'Process'}</span>
            </Button>
          </div>
          <TranscriptionBox
            value={transcription}
            onChange={(text) => handleTranscriptionChange(sectionPath, text)}
            isProcessing={isProcessing && isActiveSection}
            autoProcess={() => handleSectionAutoProcess(sectionPath)}
            autoProcessDelay={5000}
            className="min-h-12 text-sm"
            placeholder={`Speak or type to enter information for this section...`}
          />
        </div>
      );
    };

    // NEW: Render plan transcription box
    const renderPlanTranscriptionBox = (planPath: string) => {
      const transcription = planTranscriptions[planPath] || '';
      const isAlreadyProcessed = processedPlans.has(planPath);

      return (
        <div className="mb-2 sm:mb-3 border rounded-md p-1 sm:p-2 bg-blue-50">
          <div className="flex flex-wrap justify-between items-center mb-1 sm:mb-2 gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs font-medium text-blue-700">
                Plan Audio:
              </span>
              <FieldAudioRecorder
                key={`${planPath}-${planRecorderKeys[planPath] || 0}`} // Force reset when key changes
                onAudioRecorded={(base64Audio) =>
                  handlePlanAudioRecorded(base64Audio, planPath)
                }
                fieldPath={planPath}
                isDisabled={
                  !isWebSocketConnected ||
                  isProcessing ||
                  recordingMode === 'global'
                }
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex items-center gap-1 px-3 text-xs form-button touch-manipulation"
              onClick={() => handlePlanTranscriptionProcess(planPath)}
              disabled={
                isProcessing ||
                !transcription.trim() ||
                !isWebSocketConnected ||
                isAlreadyProcessed
              }
            >
              <SendHorizonal className="h-4 w-4" />
              <span>{isAlreadyProcessed ? 'Processed' : 'Process'}</span>
            </Button>
          </div>
          <TranscriptionBox
            value={transcription}
            onChange={(text) => handlePlanTranscriptionChange(planPath, text)}
            isProcessing={isProcessing}
            autoProcess={() => handlePlanAutoProcess(planPath)}
            autoProcessDelay={5000}
            className="min-h-12 text-sm"
            placeholder={`Speak or type to enter information for this specific plan...`}
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
      const baseClassName = isLLMUpdated
        ? 'border-yellow-400 bg-yellow-50'
        : '';

      switch (type) {
        case 'number':
          return (
            <div className="relative">
              <Input
                type="number"
                value={value === null || value === undefined ? '' : value}
                onChange={(e) => handleChange(path, Number(e.target.value))}
                className={`${baseClassName} text-sm form-input touch-manipulation`}
                placeholder={placeholder}
              />
              {isLLMUpdated && (
                <button
                  onClick={() => rejectLLMChange(path)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
                  title="Reject this AI suggestion"
                >
                  <MinusCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        case 'textarea':
          return (
            <div className="relative">
              <Textarea
                value={value || ''}
                onChange={(e) => handleChange(path, e.target.value)}
                className={`${baseClassName} text-sm form-textarea touch-manipulation`}
                placeholder={placeholder}
              />
              {isLLMUpdated && (
                <button
                  onClick={() => rejectLLMChange(path)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 touch-manipulation"
                  title="Reject this AI suggestion"
                >
                  <MinusCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        default: // string or any other type
          return (
            <div className="relative">
              <Input
                type="text"
                value={value || ''}
                onChange={(e) => handleChange(path, e.target.value)}
                className={`${baseClassName} text-sm form-input touch-manipulation`}
                placeholder={placeholder}
              />
              {isLLMUpdated && (
                <button
                  onClick={() => rejectLLMChange(path)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
                  title="Reject this AI suggestion"
                >
                  <MinusCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          );
      }
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
      const isTopLevelSection = shouldHaveAudioRecording(path);

      // NEW: Check if this is a plan that should have audio recording
      const isPlan = isPlanPath(path, formKey);

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

                      {/* NEW: Add transcription box for individual plans */}
                      {isItemPlan && renderPlanTranscriptionBox(itemPath)}

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

    // Reset form to initial state
    const handleResetForm = () => {
      // Ask for confirmation
      if (
        confirm(
          'Are you sure you want to reset this form? All your data will be lost.'
        )
      ) {
        // Reset to initial state based on schema
        dispatch({ type: 'RESET_FORM', data: defaultStateFromSchema(schema) });
        setLlmUpdatedFields(new Set());

        // Reset all transcriptions
        const sections =
          FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
        const resetTranscriptions: Record<string, string> = {};
        sections.forEach((section) => {
          resetTranscriptions[section] = '';
        });
        setSectionTranscriptions(resetTranscriptions);

        // Reset processed sections
        setProcessedSections(new Set());

        // NEW: Reset all plan transcriptions
        setPlanTranscriptions({});
        setPlanRecorderKeys({});
        setProcessedPlans(new Set());

        // Clear all timeouts
        Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        autoProcessTimeoutsRef.current = {};

        Object.values(planAutoProcessTimeoutsRef.current).forEach(
          (timeoutId) => {
            clearTimeout(timeoutId);
          }
        );
        planAutoProcessTimeoutsRef.current = {};

        toast({
          title: 'Form Reset',
          description: 'All form data has been reset to default values',
        });
      }
    };

    // Modified handleSubmitForm function for FormRenderer.tsx
    const handleSubmitForm = async () => {
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
        // Function to remove "record" fields and process data
        const removeRecordFields = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;

          // Handle arrays
          if (Array.isArray(obj)) {
            return obj.map((item) => removeRecordFields(item));
          }

          // Create a new object without record fields
          const result = {};
          for (const key in obj) {
            // Skip adding the record field entirely
            if (key === 'record') continue;

            // Convert numeric values to strings where needed
            if (key === 'load' && typeof obj[key] === 'number') {
              result[key] = String(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              result[key] = removeRecordFields(obj[key]);
            } else {
              result[key] = obj[key];
            }
          }
          return result;
        };

        // Deep clone state to avoid modifying the original
        const formDataCopy = JSON.parse(JSON.stringify(state));

        // Create input object
        const input = {};

        // Process the data based on the form type
        if (formKey === 'snc') {
          // For SNC forms, add the data to assessment.plan.plans
          input.assessment = {
            plan: {
              plans: removeRecordFields(formDataCopy.plans),
            },
          };

          // If there's advice in the SNC form, also add it to assessment.plan.advice
          if (formDataCopy.advice) {
            input.assessment.plan.advice = formDataCopy.advice;
          }
        } else if (formKey === 'physio') {
          // For Physio forms, add the data only to assessment.objectiveAssessment
          input.assessment = {
            objectiveAssessment: {
              tests: removeRecordFields(formDataCopy.tests),
            },
          };
        } else {
          // For other form types (firstAssessment, assessment), just use the data as is
          input[formKey] = removeRecordFields(formDataCopy);
        }

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

        // Call the GraphQL endpoint
        const result = await graphqlRequest(mutation, variables);

        if (result && result.updateAgentReport) {
          toast({
            title: 'Form Submitted',
            description: 'Your form has been successfully submitted',
          });

          // Update localStorage with the latest data
          try {
            const savedReport = localStorage.getItem('agentReport');
            if (savedReport) {
              const reportData = JSON.parse(savedReport);

              // Update report metadata
              reportData.updatedAt = result.updateAgentReport.updatedAt;
              reportData.version = result.updateAgentReport.version;
              reportData.isActive = result.updateAgentReport.isActive;
              reportData.isFilledCompletely =
                result.updateAgentReport.isFilledCompletely;

              // Store the processed data in appropriate keys in localStorage
              if (formKey === 'snc' || formKey === 'physio') {
                // Keep the form data in its original key for local form state
                reportData[formKey] = state;

                // Also update the assessment object if needed
                if (!reportData.assessment) reportData.assessment = {};

                if (formKey === 'snc') {
                  if (!reportData.assessment.plan)
                    reportData.assessment.plan = {};
                  reportData.assessment.plan.plans = formDataCopy.plans;
                  if (formDataCopy.advice) {
                    reportData.assessment.plan.advice = formDataCopy.advice;
                  }
                } else if (formKey === 'physio') {
                  if (!reportData.assessment.objectiveAssessment) {
                    reportData.assessment.objectiveAssessment = {};
                  }
                  reportData.assessment.objectiveAssessment.tests =
                    formDataCopy.tests;
                }
              } else {
                // For regular forms, just update the form data directly
                reportData[formKey] = state;
              }

              localStorage.setItem('agentReport', JSON.stringify(reportData));
            }
          } catch (error) {
            console.error('Error updating localStorage:', error);
          }
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
    };

    return (
      <div className="w-full max-w-screen pb-20">
        {suggestions && (
          <Alert
            variant="default"
            className="mb-2 bg-slate-900 text-white border-slate-800 p-1.5 text-xs"
          >
            <AlertCircle className="h-3 w-3" />
            <AlertTitle className="text-xs">Suggestions</AlertTitle>
            <AlertDescription>
              <div className="text-2xs whitespace-pre-wrap max-h-20 overflow-y-auto">
                {typeof suggestions === 'string' &&
                suggestions.includes('[') &&
                suggestions.includes(']')
                  ? (() => {
                      try {
                        // Try to parse as JSON if it looks like JSON
                        const suggestionsText = suggestions.substring(
                          suggestions.indexOf('['),
                          suggestions.lastIndexOf(']') + 1
                        );
                        const parsedSuggestions = JSON.parse(suggestionsText);
                        // Show only the first two suggestions
                        const limitedSuggestions = parsedSuggestions.slice(
                          0,
                          2
                        );

                        return (
                          <ul className="list-disc pl-4">
                            {limitedSuggestions.map(
                              (suggestion: string, index: number) => (
                                <li key={index}>{suggestion}</li>
                              )
                            )}
                          </ul>
                        );
                      } catch (e) {
                        // If parsing fails, show as regular text
                        return suggestions;
                      }
                    })()
                  : suggestions}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {llmUpdatedFields.size > 0 && (
          <Card className="mb-3 bg-yellow-50 border-yellow-300">
            <CardContent className="p-2 form-card-content">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-xs">
                    AI suggested {llmUpdatedFields.size} update
                    {llmUpdatedFields.size > 1 ? 's' : ''}
                  </h3>
                  <p className="text-2xs text-muted-foreground">
                    Review highlighted fields
                  </p>
                </div>
                <Button
                  onClick={acceptAllLLMChanges}
                  variant="default"
                  size="sm"
                  className="text-2xs h-7 px-2 form-button touch-manipulation"
                >
                  Accept All
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">{renderField(schema, '', 'root')}</div>

        {/* Form action buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-3 flex justify-between gap-3 z-10 form-bottom-bar shadow-md safe-area-bottom">
          <Button
            variant="outline"
            onClick={handleResetForm}
            disabled={isSubmitting}
            className="flex-1 h-10 flex items-center justify-center gap-1 text-xs form-button touch-manipulation"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>

          <Button
            variant="default"
            onClick={handleSubmitForm}
            disabled={isSubmitting}
            className="flex-1 h-10 flex items-center justify-center gap-1 text-xs form-button touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Submitting...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
);

// Make sure to set a display name for debugging
FormRenderer.displayName = 'FormRenderer';

export default FormRenderer;
