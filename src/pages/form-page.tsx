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
        <div className="min-h-screen bg-stance-steel flex items-center justify-center">
          <PermissionLoadingState />
        </div>
      </ThemeProvider>
    );
  }

  if (!isInitialLoadComplete) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-stance-steel flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-stance-neon border-t-transparent mx-auto" />
            <p className="text-white/60 text-sm">Loading form data...</p>
            <p className="text-xs text-white/30">
              Fetching patient information and initializing report...
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div
        className="h-[100dvh] bg-stance-steel flex flex-col overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        {/* PHASE 1: Microphone Permission Dialog */}
        <MicrophonePermissionDialog
          open={showPermissionDialog}
          permissionError={permissionError}
          microphonePermission={microphonePermission}
          onRequestPermission={handleRequestPermission}
          onOpenChange={(open) => {
            if (!open && microphonePermission !== 'prompt') {
              setShowPermissionDialog(false);
            }
          }}
        />

        {/* Header — matches customer-agent-fe exactly */}
        <header className="bg-stance-steel/80 backdrop-blur-md z-10">
          <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo-white.png" alt="Stance Health" className="h-7 w-auto" />
              <div className="w-px h-5 bg-white/15" />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-semibold">Clinician Agent</span>
                <span className="font-display text-base font-bold text-white mt-0.5">
                  {formKey.charAt(0).toUpperCase() + formKey.slice(1)} Form
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-semibold block">Patient</span>
                <span className="text-sm font-semibold text-white/80">{patientName || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-stance-neon' : 'bg-yellow-400 animate-pulse'}`} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Background accents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none overflow-hidden opacity-10">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-stance-neon rounded-full blur-[128px]" />
            <div className="absolute top-1/2 -right-24 w-64 h-64 bg-stance-stone rounded-full blur-[96px]" />
          </div>

          {/* Card — flex column so form scrolls, recorder+actions stick at bottom */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#F0F3F8] shadow-[0_-8px_32px_rgba(0,0,0,0.2)] rounded-t-[32px] md:rounded-t-[48px] mt-2">

            {/* Scrollable form area */}
            <div className="flex-1 min-h-0 overflow-y-auto
                            [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stance-steel/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
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

            {/* Bottom dock — recorder + actions, always visible */}
            <div className="border-t border-stance-steel/8 bg-[#F0F3F8]">
              <div className="max-w-3xl mx-auto">
                {/* Voice Recorder compact strip */}
                <div className="px-6 pt-3 pb-2">
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
                </div>

                {/* Action buttons — right-aligned, with safe-area bottom padding */}
                <div className="px-6 pt-2 pb-5 flex items-center justify-end gap-3" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
                  <button
                    onClick={handleFormReset}
                    className="flex items-center gap-1.5 text-sm text-stance-steel/40 hover:text-stance-steel/70 transition-colors px-3 py-2"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    Reset
                  </button>
                  <button
                    onClick={handleFormSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 h-10 px-6 bg-stance-steel text-white text-sm font-bold rounded-xl hover:bg-stance-steel/90 active:scale-[0.98] transition-all shadow-md ring-2 ring-stance-neon ring-offset-2 ring-offset-[#F0F3F8] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Assessment'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </ThemeProvider>
  );
};


export default FormPage;
