import React from 'react';
import { useParams } from 'react-router-dom';

import { useToast } from '@/hooks/use-toast';
import formSchemas from '@/schemas/form-schemas';
import { ThemeProvider } from '@/styles/theme-provider';
import { FormRendererRef } from '@/types/form-renderer.types';

// Phase 1: Permission Management
import { useMicrophonePermission } from '@/hooks';
import {
  MicrophonePermissionDialog,
  PermissionLoadingState,
} from '@/components/audio';

// Phase 2: Voice Recorder Management
import { useVoiceRecorder } from '@/hooks';
import { VoiceRecorderSection } from '@/components/audio';

// Phase 3: Form Management
import { useFormManagement } from '@/hooks';
import { FormSection } from '@/components/sections';

// Import global styles
import '@/styles/globalStyles.css';

type FormPageParams = {
  formKey: string;
  patientId: string;
  appointmentId: string;
};

const FormPage = () => {
  const { toast } = useToast();
  const {
    formKey = 'assessment', // CHANGED: from 'physio' to 'assessment'
    patientId,
    appointmentId,
  } = useParams<FormPageParams>();

  const formRendererRef = React.useRef<FormRendererRef>(null);

  // Initialize schema based on formKey
  const schema =
    formSchemas[formKey as keyof typeof formSchemas] || formSchemas.assessment; // CHANGED: fallback from physio to assessment

  // PHASE 1: Permission Management
  const {
    permissionError,
    microphonePermission,
    showPermissionDialog,
    setShowPermissionDialog,
    handleRequestPermission,
  } = useMicrophonePermission();

  // PHASE 3: Form Management (before voice recorder since it depends on formData)
  const {
    formData,
    isSubmitting,
    reportId,
    patientName,
    isInitialLoadComplete, // ADDED: Get loading state from hook
    handleFormChange,
    handleFormSubmit,
    handleFormReset,
    setFormData,
  } = useFormManagement({
    formKey,
    patientId: patientId || '',
    appointmentId: appointmentId || '',
  });

  // PHASE 2: Voice Recorder Management - FIXED: Added formRendererRef
  const {
    // WebSocket states
    isConnected,
    suggestions,
    isConnecting,
    isProcessing,
    transcription,

    // Recording states
    recordingMode,
    transcriptText,
    recordingStates,
    audioRecorderKey,
    activeSectionPath,
    globalRecordingState,
    currentlyProcessingPath,

    // Actions
    handleAutoProcess,
    handleAudioEncoded,
    handleRecordingStop,
    handleRecordingStart,
    handleFieldAudioEncoded,
    handleProcessTranscription,
    handleFieldTranscriptionProcess,
    handleGlobalTranscriptionChange,

    // Utilities
    setSuggestions,
    setTranscription,
  } = useVoiceRecorder({
    microphonePermission,
    formKey,
    formData,
    formRendererRef, // FIXED: Pass the ref
  });

  // Form transcription clearing handlers
  const handleSectionTranscriptionClear = (sectionPath: string) => {
    if (formRendererRef.current) {
      formRendererRef.current.clearSectionTranscription(sectionPath);
    }
  };

  const handlePlanTranscriptionClear = (planPath: string) => {
    if (formRendererRef.current) {
      formRendererRef.current.clearPlanTranscription(planPath);
    }
  };

  // Validate form schema
  React.useEffect(() => {
    if (formKey && !(formKey in formSchemas)) {
      toast({
        title: 'Invalid Form',
        description: `Form type '${formKey}' does not exist`,
        variant: 'destructive',
      });
      console.error(`Invalid form key: ${formKey}`);
    }
  }, [formKey, toast]);

  // Show loading state while checking permissions
  if (microphonePermission === 'checking') {
    return (
      <ThemeProvider>
        <PermissionLoadingState />
      </ThemeProvider>
    );
  }

  // FIXED: Use isInitialLoadComplete from useFormManagement instead of custom state
  if (!isInitialLoadComplete) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground">Loading form data...</p>
            <p className="text-xs text-muted-foreground">
              Fetching patient information and initializing report...
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-primary/5 to-background">
        {/* PHASE 1: Microphone Permission Dialog */}
        <MicrophonePermissionDialog
          open={showPermissionDialog}
          permissionError={permissionError}
          microphonePermission={microphonePermission}
          onRequestPermission={handleRequestPermission}
          onOpenChange={(open) => {
            // Only allow closing if permission is granted or denied, not if it's still prompt
            if (!open && microphonePermission !== 'prompt') {
              setShowPermissionDialog(false);
            }
          }}
        />
        <div className="w-full space-y-6 pb-16 px-2">
          {/* Header */}
          <div className="w-full max-w-4xl mx-auto px-4 py-2">
            <h2 className="text-3xl font-bold text-center">
              {formKey.charAt(0).toUpperCase() + formKey.slice(1)} Form
            </h2>
            <p className="text-center text-muted-foreground">
              Patient: {patientName || 'Unknown'}
            </p>
          </div>

          {/* PHASE 2: Voice Recorder Section */}
          <VoiceRecorderSection
            isConnected={isConnected}
            suggestions={suggestions}
            isConnecting={isConnecting}
            isProcessing={isProcessing}
            recordingMode={recordingMode}
            transcriptText={transcriptText}
            audioRecorderKey={audioRecorderKey}
            microphonePermission={microphonePermission}
            globalRecordingState={globalRecordingState}
            currentlyProcessingPath={currentlyProcessingPath}
            setSuggestions={setSuggestions}
            onAutoProcess={handleAutoProcess}
            onAudioEncoded={handleAudioEncoded}
            onRecordingStop={() => handleRecordingStop()}
            onRecordingStart={() => handleRecordingStart()}
            onProcessTranscription={handleProcessTranscription}
            onShowPermissionDialog={() => setShowPermissionDialog(true)}
            onGlobalTranscriptionChange={handleGlobalTranscriptionChange}
          />

          {/* PHASE 3: Form Section */}
          <FormSection
            schema={schema}
            formKey={formKey}
            formData={formData}
            patientName={patientName}
            isConnected={isConnected}
            isProcessing={isProcessing}
            patientId={patientId || ''}
            recordingMode={recordingMode}
            transcription={transcription}
            formRendererRef={formRendererRef}
            recordingStates={recordingStates}
            appointmentId={appointmentId || ''}
            activeSectionPath={activeSectionPath}
            currentlyProcessingPath={currentlyProcessingPath}
            onFormChange={handleFormChange}
            onRecordingStop={handleRecordingStop}
            onRecordingStart={handleRecordingStart}
            onAudioRecorded={handleFieldAudioEncoded}
            onPlanTranscriptionClear={handlePlanTranscriptionClear}
            onTranscriptionProcess={handleFieldTranscriptionProcess}
            onSectionTranscriptionClear={handleSectionTranscriptionClear}
            autoSubmitOnLLMUpdate={true}
            autoSubmitDelay={3000}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default FormPage;
