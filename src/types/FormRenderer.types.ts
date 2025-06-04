// types/FormRenderer.types.ts

export interface FormRendererProps {
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
export type FormAction =
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

// Processing queue item type
export interface ProcessingQueueItem {
  path: string;
  type: 'section' | 'plan';
  transcription: string;
  timestamp: number;
}

// Form state interface
export interface FormState {
  llmUpdatedFields: Set<string>;
  suggestions: string | null;
  sectionTranscriptions: Record<string, string>;
  planTranscriptions: Record<string, string>;
  activeSectionTranscription: string | null;
  activePlanTranscription: string | null;
  selectedSections: Set<string>;
  processedSections: Set<string>;
  processedPlans: Set<string>;
  isSubmitting: boolean;
  isAutoProcessing: boolean;
  processingQueue: ProcessingQueueItem[];
  currentlyProcessingPath: string | null;
  sectionRecorderKeys: Record<string, number>;
  planRecorderKeys: Record<string, number>;
}
