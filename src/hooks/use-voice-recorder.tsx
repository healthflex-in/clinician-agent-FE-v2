import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-web-socket';
import { isPlanPath, isTestPath } from '@/utils/form-renderer.utils';

export type RecordingMode = 'idle' | 'global' | 'section';

interface UseVoiceRecorderProps {
  formData: any;
  formKey: string;
  formRendererRef: React.RefObject<any>;
  microphonePermission: 'checking' | 'granted' | 'denied' | 'prompt';
}

export const useVoiceRecorder = ({
  formKey,
  formData,
  formRendererRef,
  microphonePermission,
}: UseVoiceRecorderProps) => {
  const { toast } = useToast();

  const [
    hasProcessedCurrentTranscription,
    setHasProcessedCurrentTranscription,
  ] = React.useState(false);

  // Core recording states
  const [transcriptText, setTranscriptText] = React.useState('');
  const [audioRecorderKey, setAudioRecorderKey] = React.useState(0);
  const [recordingMode, setRecordingMode] =
    React.useState<RecordingMode>('idle');
  const [activeSectionPath, setActiveSectionPath] = React.useState<
    string | null
  >(null);
  const [currentlyProcessingPath, setCurrentlyProcessingPath] = React.useState<
    string | null
  >(null);

  // ADD MISSING STATES
  const [globalRecordingState, setGlobalRecordingState] = React.useState(false);
  const [recordingStates, setRecordingStates] = React.useState<{
    [path: string]: boolean;
  }>({});

  // AUTO-SEND COUNTDOWN STATE (for audio recordings only)
  const [autoSendCountdown, setAutoSendCountdown] = React.useState<number | null>(null);
  const countdownTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isFromRecordingRef = React.useRef<boolean>(false);

  // Cancel any active countdown
  const cancelAutoSendCountdown = React.useCallback(() => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoSendCountdown(null);
  }, []);
  // Simple function to handle incoming form data
  const handleIncomingFormData = React.useCallback(
    (data: any) => {
      if (!data) return;

      // CHECK: Skip if response is empty or "Empty Response"
      if (data.payloadType === 'transcription') {
        const transcriptionText = data.transcription?.trim();
        if (
          !transcriptionText ||
          transcriptionText.toLowerCase() === 'empty response'
        ) {
          return;
        }
      }

      // CHECK: Skip if form data is empty or contains "Empty Response"
      if (data.formData) {
        const formDataStr = JSON.stringify(data.formData).toLowerCase();
        if (
          formDataStr.includes('empty response') ||
          Object.keys(data.formData).length === 0
        ) {
          return;
        }
      }

      try {
        // For structured payloads (complete form filling)
        if (data.payloadType === 'structured') {
          formRendererRef.current.updateFormWithLLMData(data);

          setTranscriptText('');
          setAudioRecorderKey((prev) => prev + 1);
          return;
        }

        // For any other form data, just clear processing state
        setCurrentlyProcessingPath(null);
        setActiveSectionPath(null);

        toast({
          title: 'Form Updated',
          description: 'Field has been filled with transcription data',
        });
      } catch (error) {
        console.error('Error processing form data:', error);
        toast({
          variant: 'destructive',
          title: 'Processing Error',
          description: 'Failed to process form data',
        });
      }
    },
    [toast]
  );

  // WebSocket connection
  const {
    connect,
    suggestions,
    isConnected,
    isConnecting,
    isProcessing,
    transcription,
    sendAudio,
    setSuggestions,
    setTranscription,
    processTranscription,
  } = useWebSocket({
    url: import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:9080/ws`,
    onFormData: handleIncomingFormData,
    onOpen: () =>
      toast({ title: 'Connected', description: 'Ready to transcribe audio' }),
    onClose: () =>
      toast({
        title: 'Disconnected',
        description: 'WebSocket connection closed',
        variant: 'destructive',
      }),
    onError: () =>
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to transcription service',
        variant: 'destructive',
      }),
  });

  // Connect to WebSocket when permission is granted
  React.useEffect(() => {
    if (microphonePermission !== 'granted') return;

    connect();
    const reconnectInterval = setInterval(() => {
      if (!isConnected && !isConnecting) {
        connect();
      }
    }, 5000);

    return () => clearInterval(reconnectInterval);
  }, [connect, isConnected, isConnecting, microphonePermission]);

  // SIMPLE TRANSCRIPTION ROUTING - This is the key fix
  React.useEffect(() => {
    if (!transcription) return;

    // CHECK: Skip if transcription is "Empty Response" or just whitespace
    const transcriptionText = transcription.trim();
    if (
      !transcriptionText ||
      transcriptionText.toLowerCase() === 'empty response'
    ) {
      return;
    }

    // For global mode, always show in global text box
    if (recordingMode === 'global') {
      setTranscriptText(transcription);
      setHasProcessedCurrentTranscription(false); // Reset processing flag for new transcription
      return;
    }

    // For section mode with specific path, try to update the field
    if (
      recordingMode === 'section' &&
      currentlyProcessingPath &&
      formRendererRef?.current
    ) {
      try {
        if (
          isPlanPath(currentlyProcessingPath, formKey) ||
          isTestPath(currentlyProcessingPath, formKey)
        ) {
          if (formRendererRef.current.updatePlanTranscription) {
            formRendererRef.current.updatePlanTranscription(
              currentlyProcessingPath,
              transcription
            );
            return;
          }
        } else {
          if (formRendererRef.current.updateSectionTranscription) {
            formRendererRef.current.updateSectionTranscription(
              currentlyProcessingPath,
              transcription
            );
            return;
          }
        }
      } catch (error) {
        console.error('Error updating field transcription:', error);
      }
    }

    // Fallback: show in global text box
    setTranscriptText(transcription);
    setHasProcessedCurrentTranscription(false); // Reset processing flag for new transcription
  }, [transcription, recordingMode, currentlyProcessingPath, formKey]);

  // AUTO-SEND COUNTDOWN: 5 seconds after transcription arrives from a recording
  React.useEffect(() => {
    if (
      transcriptText.trim() &&
      isFromRecordingRef.current &&
      !hasProcessedCurrentTranscription &&
      !isProcessing &&
      recordingMode === 'global' &&
      !globalRecordingState
    ) {
      // Cancel any existing countdown
      cancelAutoSendCountdown();

      // Start countdown from 5
      setAutoSendCountdown(5);

      countdownIntervalRef.current = setInterval(() => {
        setAutoSendCountdown((prev) => {
          if (prev === null || prev <= 1) return prev;
          return prev - 1;
        });
      }, 1000);

      // Auto-send after 5 seconds
      countdownTimerRef.current = setTimeout(() => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setAutoSendCountdown(null);
        isFromRecordingRef.current = false;
        handleProcessTranscription();
      }, 5000);
    }

    return () => {
      cancelAutoSendCountdown();
    };
  }, [transcriptText, hasProcessedCurrentTranscription, isProcessing, recordingMode, globalRecordingState]);

  // GLOBAL AUDIO RECORDING
  const handleAudioEncoded = (base64Audio: string) => {
    if (!isConnected) {
      toast({
        title: 'Not connected',
        description: 'Attempting to reconnect...',
        variant: 'destructive',
      });
      connect();
      return;
    }

    setRecordingMode('global');
    setActiveSectionPath(null);
    setCurrentlyProcessingPath(null);
    setGlobalRecordingState(false);
    setHasProcessedCurrentTranscription(false); // Reset for new recording
    isFromRecordingRef.current = true; // Mark that next transcription will be from recording

    // Send audio in transcribe_only mode — form-fill happens after 5s countdown
    const context = {
      formKey,
      recordingType: 'global',
      isGlobalRecording: true,
    };

    const sent = sendAudio(base64Audio, context);
    if (!sent) {
      toast({
        title: 'Failed to send audio',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
      setRecordingMode('idle');
    }
  };

  // Recording start/stop handlers
  const handleRecordingStart = () => {
    setGlobalRecordingState(true);
    setHasProcessedCurrentTranscription(false); // Reset when starting new recording
  };

  const handleRecordingStop = () => {
    setGlobalRecordingState(false);
  };

  // FIELD/SECTION AUDIO RECORDING
  const handleFieldAudioEncoded = (base64Audio: string, context: any) => {
    if (!isConnected) {
      toast({
        title: 'Not connected',
        description: 'Attempting to reconnect...',
        variant: 'destructive',
      });
      connect();
      return;
    }

    // Determine processing path
    const processingPath =
      context.sectionPath || context.planPath || context.testPath;
    if (!processingPath) {
      console.error('No processing path found in context:', context);
      return;
    }

    setRecordingStates((prev) => ({ ...prev, [processingPath]: false }));

    // Set processing state
    setRecordingMode('section');
    setCurrentlyProcessingPath(processingPath);
    if (context.sectionPath) {
      setActiveSectionPath(context.sectionPath);
    }

    // Clear global transcription
    if (transcriptText.trim()) {
      setTranscriptText('');
      setTranscription('');
    }

    const enhancedContext = {
      ...context,
      isGlobalRecording: false,
      recordingType: 'section',
      specificPath: processingPath,
    };

    const sent = sendAudio(base64Audio, enhancedContext);
    if (!sent) {
      toast({
        title: 'Failed to send audio',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
      setCurrentlyProcessingPath(null);
      setActiveSectionPath(null);
      setRecordingMode('idle');
    }
  };

  // PROCESS GLOBAL TRANSCRIPTION
  const handleProcessTranscription = () => {
    if (!transcriptText.trim()) {
      toast({
        title: 'No transcription to process',
        description: 'Please record audio or enter text first',
        variant: 'destructive',
      });
      return;
    }

    // CHECK: Skip if transcription is "Empty Response"
    if (transcriptText.trim().toLowerCase() === 'empty response') {
      toast({
        title: 'Empty Response',
        description: 'No meaningful content to process',
        variant: 'destructive',
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: 'Not connected',
        description: 'Please wait for connection',
        variant: 'destructive',
      });
      return;
    }

    setRecordingMode('global');
    setActiveSectionPath(null);
    setCurrentlyProcessingPath(null);
    setHasProcessedCurrentTranscription(true); // Mark as processed

    const context = {
      formKey,
      formData: formData || {},
      isGlobalRecording: true,
      recordingType: 'global',
    };

    const sent = processTranscription(transcriptText, context);
    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
      setRecordingMode('idle');
      setHasProcessedCurrentTranscription(false); // Reset on failure
    }
  };

  // PROCESS FIELD TRANSCRIPTION
  const handleFieldTranscriptionProcess = (
    fieldTranscription: string,
    context: any
  ) => {
    if (!fieldTranscription.trim()) {
      toast({
        title: 'No transcription to process',
        description: 'Please record audio or enter text first',
        variant: 'destructive',
      });
      return;
    }

    // CHECK: Skip if transcription is "Empty Response"
    if (fieldTranscription.trim().toLowerCase() === 'empty response') {
      toast({
        variant: 'destructive',
        title: 'Empty Response',
        description: 'No meaningful content to process',
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: 'Not connected',
        description: 'Attempting to reconnect...',
        variant: 'destructive',
      });
      connect();
      return;
    }

    // Determine processing path
    const processingPath =
      context.sectionPath || context.planPath || context.testPath;
    if (!processingPath) {
      console.error('No processing path found in context:', context);
      return;
    }

    // Set processing state
    setRecordingMode('section');
    setCurrentlyProcessingPath(processingPath);
    if (context.sectionPath) {
      setActiveSectionPath(context.sectionPath);
    }

    // Clear global transcription
    if (transcriptText.trim()) {
      setTranscriptText('');
      setTranscription('');
    }

    const enhancedContext = {
      ...context,
      isGlobalRecording: false,
      recordingType: 'section',
      specificPath: processingPath,
    };

    const sent = processTranscription(fieldTranscription, enhancedContext);
    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
      setCurrentlyProcessingPath(null);
      setActiveSectionPath(null);
      setRecordingMode('idle');
    }
  };

  // Handle global transcription text changes
  const handleGlobalTranscriptionChange = (text: string) => {
    // Don't update global transcription if we're processing a section
    if (
      currentlyProcessingPath ||
      (recordingMode === 'section' && activeSectionPath)
    ) {
      return;
    }

    // Cancel countdown when user manually edits
    cancelAutoSendCountdown();
    isFromRecordingRef.current = false; // User is editing — disable auto-send

    setTranscription(text);
    setTranscriptText(text);
    setHasProcessedCurrentTranscription(false); // Reset when user manually changes text

    // Switch to global mode when user starts typing
    if (text.trim().length > 0 && recordingMode === 'idle') {
      setRecordingMode('global');
    }
  };

  // Auto-process handler - FIXED: Only process once per transcription
  const handleAutoProcess = () => {
    if (
      transcriptText.trim() &&
      isConnected &&
      !hasProcessedCurrentTranscription
    ) {
      handleProcessTranscription();
    } else if (hasProcessedCurrentTranscription) {
      console.log(
        'Skipping auto-process - already processed this transcription'
      );
    }
  };

  return {
    // States
    suggestions,
    isConnected,
    isConnecting,
    isProcessing,
    recordingMode,
    transcription,
    transcriptText,
    recordingStates,
    audioRecorderKey,
    activeSectionPath,
    globalRecordingState,
    currentlyProcessingPath,
    autoSendCountdown,

    // Actions
    handleAutoProcess,
    handleAudioEncoded,
    handleRecordingStop,
    handleRecordingStart,
    handleFieldAudioEncoded,
    handleProcessTranscription,
    handleFieldTranscriptionProcess,
    handleGlobalTranscriptionChange,
    cancelAutoSendCountdown,

    // Utilities
    setSuggestions,
    setTranscription,
  };
};
