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
    const [activeSectionTranscription, setActiveSectionTranscription] =
      useState<string | null>(null);
    // New state for selected sections - starts with empty set (none selected)
    const [selectedSections, setSelectedSections] = useState<Set<string>>(
      new Set()
    );
    // Track processed sections to avoid repeated processing
    const [processedSections, setProcessedSections] = useState<Set<string>>(
      new Set()
    );
    // Add state for form submission
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track auto-processing timeouts for each section
    const autoProcessTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>(
      {}
    );

    const { toast } = useToast();

    // Initialize section transcriptions with empty strings for all sections
    useEffect(() => {
      const sections =
        FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
      const initialTranscriptions: Record<string, string> = {};

      sections.forEach((section) => {
        initialTranscriptions[section] = '';
      });

      setSectionTranscriptions(initialTranscriptions);
      // Reset processed sections when form key changes
      setProcessedSections(new Set());
    }, [formKey]);

    // Clean up timeouts when component unmounts or recording mode changes
    useEffect(() => {
      // Clear all timeouts when recording mode changes
      Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      autoProcessTimeoutsRef.current = {};

      return () => {
        // Clean up on unmount
        Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
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

    // Method for LLM to update form data
    const updateFormWithLLMData = useCallback(
      (llmData: any) => {
        console.log('Updating form with LLM data:', llmData);

        // Check if there's a structured payload - indicates form is filled
        if (llmData.payloadType === 'structured' && llmData.formData) {
          console.log(
            'Received structured form data - stopping all processing'
          );

          // Mark ALL sections as processed
          const allSections =
            FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
          setProcessedSections(new Set(allSections));

          // Clear all timeouts
          Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
            clearTimeout(timeoutId);
          });
          autoProcessTimeoutsRef.current = {};

          // Use the incoming form data
          llmData = { formData: llmData.formData };
        }

        // Process suggestions
        if (llmData.suggestions) {
          setSuggestions(llmData.suggestions);

          // Auto-hide suggestions after 7 seconds
          setTimeout(() => {
            setSuggestions(null);
          }, 7000);
        }

        // Process the formData if it exists
        if (llmData.formData) {
          // If no sections are selected, update all sections
          if (selectedSections.size === 0) {
            // Just use the complete formData as is
            dispatch({
              type: 'MERGE_LLM_DATA',
              data: llmData.formData,
              source: 'llm',
            });

            // Notify parent component about LLM update
            if (onLLMUpdate) onLLMUpdate(llmData.formData);
          } else {
            // Only update selected sections
            const selectedSectionsData: any = {};

            // Start with a copy of the original data
            Object.keys(llmData.formData).forEach((key) => {
              // Only include keys that are in the selectedSections set
              if (selectedSections.has(key)) {
                selectedSectionsData[key] = llmData.formData[key];
              }
            });

            // Only dispatch if we have data for selected sections
            if (Object.keys(selectedSectionsData).length > 0) {
              dispatch({
                type: 'MERGE_LLM_DATA',
                data: selectedSectionsData,
                source: 'llm',
              });

              // Notify parent component about LLM update
              if (onLLMUpdate) onLLMUpdate(selectedSectionsData);
            } else {
              toast({
                title: 'No Updates for Selected Sections',
                description:
                  'The AI did not provide data for your selected sections',
              });
            }
          }

          // Mark the active section as processed
          if (activeSectionTranscription) {
            setProcessedSections((prev) => {
              const newSet = new Set(prev);
              newSet.add(activeSectionTranscription);
              return newSet;
            });
          }

          // Clear all auto-processing timeouts
          Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
            clearTimeout(timeoutId);
          });
          autoProcessTimeoutsRef.current = {};
        }
      },
      [
        onLLMUpdate,
        selectedSections,
        toast,
        activeSectionTranscription,
        formKey,
      ]
    );

    // Update section transcription
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

        // Only update if this is the active section in section mode
        if (recordingMode !== 'section' || activeSectionPath !== sectionPath) {
          console.log(
            `Ignoring update for ${sectionPath} - not the active section or wrong mode`
          );
          return;
        }

        // Update the transcription text
        setSectionTranscriptions((prev) => ({
          ...prev,
          [sectionPath]: text,
        }));
        setActiveSectionTranscription(sectionPath);

        // Set up auto-processing after 5 seconds of inactivity
        // Clear any existing timeout for this section
        if (autoProcessTimeoutsRef.current[sectionPath]) {
          clearTimeout(autoProcessTimeoutsRef.current[sectionPath]);
        }

        // Only set up auto-processing if we're in section mode and this section isn't processed
        if (
          recordingMode === 'section' &&
          !processedSections.has(sectionPath)
        ) {
          autoProcessTimeoutsRef.current[sectionPath] = setTimeout(() => {
            // Double-check we're still in the right mode and section before processing
            // and that the section hasn't been processed yet
            if (
              recordingMode === 'section' &&
              activeSectionPath === sectionPath &&
              !processedSections.has(sectionPath)
            ) {
              console.log(
                `Auto-processing section ${sectionPath} after inactivity`
              );
              handleSectionTranscriptionProcess(sectionPath);
            } else {
              console.log(
                `Skipping auto-process for ${sectionPath}:`,
                recordingMode !== 'section'
                  ? 'not in section mode'
                  : activeSectionPath !== sectionPath
                  ? 'not active section'
                  : 'already processed'
              );
            }
            // Clear the timeout reference
            delete autoProcessTimeoutsRef.current[sectionPath];
          }, 5000);
        }
      },
      [
        sectionTranscriptions,
        processedSections,
        recordingMode,
        activeSectionPath,
      ]
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

    // Process section transcription
    const handleSectionTranscriptionProcess = useCallback(
      (sectionPath: string) => {
        if (!onTranscriptionProcess) return;

        // Detailed log for debugging
        console.log(
          `Processing request for section ${sectionPath}:`,
          `Mode: ${recordingMode}`,
          `Active section: ${activeSectionPath}`,
          `Already processed: ${processedSections.has(sectionPath)}`
        );

        // Skip processing if:
        // 1. Not in section mode, or
        // 2. This is not the active section, or
        // 3. This section has already been processed
        if (
          recordingMode !== 'section' ||
          activeSectionPath !== sectionPath ||
          processedSections.has(sectionPath)
        ) {
          console.log(`Skipping process for section ${sectionPath}`);
          return;
        }

        const transcription = sectionTranscriptions[sectionPath] || '';
        if (!transcription || !transcription.trim()) {
          toast({
            title: 'Empty transcription',
            description: 'Please record audio or enter text to process',
            variant: 'destructive',
          });
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

        // Mark this section as processed BEFORE sending to prevent any race conditions
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

        // Now send the transcription
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
        recordingMode,
        activeSectionPath,
      ]
    );

    // Create wrapper for auto-processing
    const handleSectionAutoProcess = useCallback(
      (sectionPath: string) => {
        if (
          !processedSections.has(sectionPath) &&
          recordingMode === 'section' &&
          activeSectionPath === sectionPath
        ) {
          handleSectionTranscriptionProcess(sectionPath);
        }
      },
      [
        handleSectionTranscriptionProcess,
        processedSections,
        recordingMode,
        activeSectionPath,
      ]
    );

    // Update transcription for a section - MANUAL user typing
    const handleTranscriptionChange = useCallback(
      (sectionPath: string, text: string) => {
        // Only allow changes if:
        // 1. In idle mode (manual editing), or
        // 2. In section mode and this is the active section
        if (
          recordingMode === 'idle' ||
          (recordingMode === 'section' && activeSectionPath === sectionPath)
        ) {
          setSectionTranscriptions((prev) => ({
            ...prev,
            [sectionPath]: text,
          }));

          // If we have text and we're in idle mode, transition to section mode
          if (text.trim().length > 0 && recordingMode === 'idle') {
            // This is handled by the parent component, but we set the active section
            setActiveSectionTranscription(sectionPath);
          }

          // Reset processed status when text changes
          if (text !== sectionTranscriptions[sectionPath]) {
            setProcessedSections((prev) => {
              const newSet = new Set(prev);
              newSet.delete(sectionPath);
              return newSet;
            });
          }
        }
      },
      [sectionTranscriptions, recordingMode, activeSectionPath]
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

          toast({
            title: 'Field Reset',
            description: 'Field has been reset to default value',
          });
        }
      },
      [toast, sectionTranscriptions]
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

    // Render section transcription box
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
                onAudioRecorded={(base64Audio) =>
                  handleSectionAudioRecorded(base64Audio, sectionPath)
                }
                fieldPath={sectionPath}
                isDisabled={
                  !isWebSocketConnected ||
                  isProcessing ||
                  recordingMode === 'global' || // Disable section recording when in global mode
                  (recordingMode === 'section' &&
                    activeSectionPath !== sectionPath) // Only allow recording for active section
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
                isAlreadyProcessed ||
                (recordingMode !== 'idle' &&
                  (recordingMode !== 'section' ||
                    activeSectionPath !== sectionPath))
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
            autoProcess={() => {}} // Disable auto-processing in TranscriptionBox
            autoProcessDelay={0} // We manage timeouts ourselves
            className="min-h-12 text-sm"
            placeholder={`Speak or type to enter information for this section...`}
          />
        </div>
      );
    };

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
              {value?.map((item: any, index: number) => (
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
              ))}

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

        // Clear all timeouts
        Object.values(autoProcessTimeoutsRef.current).forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        autoProcessTimeoutsRef.current = {};

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
