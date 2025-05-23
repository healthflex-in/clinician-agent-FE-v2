import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardTitle,
  CardHeader,
  CardFooter,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import AudioRecorder from '@/components/audio/AudioRecorder';
import TranscriptionBox from '@/components/audio/TranscriptionBox';
import SuggestionBox from '@/components/ui/suggestion-box';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Save, RefreshCw, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { graphqlRequest } from '@/utils/graphqlClient';
import formSchemas from '@/schemas/formSchemas';
import FormRenderer, { FormRendererRef } from '@/components/FormRenderer';
import { ThemeProvider } from '@/styles/theme-provider';

// Import global styles
import '@/styles/globalStyles.css';

type FormPageParams = {
  formKey: string;
  patientId: string;
  appointmentId: string;
};

const FormPage = () => {
  const {
    formKey = 'physio',
    patientId,
    appointmentId,
  } = useParams<FormPageParams>();

  const [transcriptText, setTranscriptText] = useState('');
  const [formData, setFormData] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientName, setPatientName] = useState<string>('Patient');
  const [transcriptionProcessed, setTranscriptionProcessed] = useState(false);

  // Microphone permission states
  const [microphonePermission, setMicrophonePermission] = useState<
    'checking' | 'granted' | 'denied' | 'prompt'
  >('checking');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionError, setPermissionError] = useState<string>('');

  // Add a state for tracking recording mode - could be 'idle', 'global', or 'section'
  const [recordingMode, setRecordingMode] = useState<
    'idle' | 'global' | 'section'
  >('idle');
  // Add state to track active section
  const [activeSectionPath, setActiveSectionPath] = useState<string | null>(
    null
  );

  const { toast } = useToast();
  const formRendererRef = useRef<FormRendererRef>(null);

  // Initialize schema based on formKey
  const schema =
    formSchemas[formKey as keyof typeof formSchemas] || formSchemas.physio;

  // Check microphone permission on component mount
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        // Check if navigator.mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMicrophonePermission('denied');
          setPermissionError(
            'Microphone access is not supported in this browser'
          );
          setShowPermissionDialog(true);
          return;
        }

        // Simply set to prompt state - let the user decide when to request permission
        setMicrophonePermission('prompt');
        setShowPermissionDialog(true);
      } catch (error) {
        console.error('Error checking microphone availability:', error);
        setMicrophonePermission('prompt');
        setShowPermissionDialog(true);
      }
    };

    checkMicrophonePermission();
  }, []);

  // Handle permission request
  const handleRequestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // If successful, close the stream and set permission as granted
      stream.getTracks().forEach((track) => track.stop());
      setMicrophonePermission('granted');
      setShowPermissionDialog(false);
      setPermissionError('');

      toast({
        title: 'Permission Granted',
        description: 'Microphone access granted successfully',
      });
    } catch (error) {
      console.error('Permission request failed:', error);
      setMicrophonePermission('denied');

      if (error instanceof Error) {
        if (
          error.name === 'NotAllowedError' ||
          error.name === 'PermissionDeniedError'
        ) {
          setPermissionError(
            'Microphone access was denied. Voice recording features will be disabled.'
          );
        } else if (
          error.name === 'NotFoundError' ||
          error.name === 'DevicesNotFoundError'
        ) {
          setPermissionError(
            'No microphone found. Please connect a microphone and try again.'
          );
        } else if (
          error.name === 'NotReadableError' ||
          error.name === 'TrackStartError'
        ) {
          setPermissionError(
            'Microphone is already in use by another application.'
          );
        } else {
          setPermissionError(
            'Unable to access microphone. Please check your browser settings.'
          );
        }
      } else {
        setPermissionError(
          'Unable to access microphone. Please check your browser settings.'
        );
      }

      toast({
        title: 'Permission Denied',
        description:
          'Microphone access is required for voice recording features',
        variant: 'destructive',
      });
    }
  };

  // Handle continuing without microphone
  const handleContinueWithoutMicrophone = () => {
    setMicrophonePermission('denied');
    setShowPermissionDialog(false);
    toast({
      title: 'Continuing without microphone',
      description: 'Voice recording features will be disabled',
      variant: 'destructive',
    });
  };

  // Create agent report on initial load - only after permission is checked
  useEffect(() => {
    // Only proceed if microphone permission has been resolved (either granted or denied)
    if (microphonePermission === 'checking') return;

    // Fetch patient details as soon as the component mounts
    const fetchPatientName = async () => {
      if (!patientId) return;

      try {
        // Try to get from localStorage first
        const storedPatient = localStorage.getItem('selectedPatient');
        if (storedPatient) {
          const patientData = JSON.parse(storedPatient);
          if (patientData && patientData.name) {
            setPatientName(patientData.name);
            return;
          }
        }

        // If not in localStorage, try to fetch from API
        // Use the patient query based on your API structure
        const query = `
          query GetPatientById($patientId: ObjectID!) {
            getPatientById(patientId: $patientId) {
              _id
              name
            }
          }
        `;

        const variables = { patientId };

        const result = await graphqlRequest(query, variables);
        if (result && result.getPatientById && result.getPatientById.name) {
          setPatientName(result.getPatientById.name);
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
      }
    };

    const createInitialReport = async () => {
      if (!patientId || !appointmentId) return;

      try {
        // Check if report already exists in localStorage
        const existingReport = localStorage.getItem('agentReport');
        if (existingReport) {
          try {
            const parsedReport = JSON.parse(existingReport);
            if (parsedReport._id) {
              setReportId(parsedReport._id);

              // Set form data if it exists for this form type
              if (parsedReport[formKey]) {
                setFormData(parsedReport[formKey]);
              }

              return; // Report already exists
            }
          } catch (e) {
            console.error('Error parsing existing report:', e);
          }
        }

        // Creating a new report if none exists
        const mutation = `
          mutation CreateAgentReport($input: CreateAgentReportInput!) {
            createAgentReport(input: $input) {
              _id
              createdAt
              updatedAt
              version
              isActive
            }
          }
        `;

        // Get center ID from localStorage or use default
        const centerId =
          localStorage.getItem('centerId') || '67fe35f25e42152fb5185a5e';

        const variables = {
          input: {
            patient: patientId,
            center: centerId,
            appointment: appointmentId,
          },
        };

        const result = await graphqlRequest(mutation, variables);

        if (
          result &&
          result.createAgentReport &&
          result.createAgentReport._id
        ) {
          // Save the report ID
          setReportId(result.createAgentReport._id);

          // Save the full report in localStorage
          localStorage.setItem(
            'agentReport',
            JSON.stringify(result.createAgentReport)
          );

          toast({
            title: 'Report Created',
            description: 'New report initialized successfully',
          });

          // Set initial form data if it exists
          if (result.createAgentReport[formKey]) {
            setFormData(result.createAgentReport[formKey]);
          }
        }
      } catch (error) {
        console.error('Error creating initial report:', error);
        toast({
          title: 'Failed to Create Report',
          description: 'Could not initialize the form data',
          variant: 'destructive',
        });
      }
    };

    fetchPatientName();
    createInitialReport();
  }, [patientId, appointmentId, toast, formKey, microphonePermission]);

  // Store formKey, patientId and appointmentId in localStorage for WebSocket access
  useEffect(() => {
    if (formKey) localStorage.setItem('formKey', formKey);
    if (patientId) localStorage.setItem('userId', patientId);
    if (appointmentId) localStorage.setItem('appointmentId', appointmentId);
  }, [formKey, patientId, appointmentId]);

  // Function to prepare for a new recording
  const prepareNewRecording = (
    mode: 'global' | 'section',
    sectionPath: string | null = null
  ) => {
    // Clear any existing state
    setTranscriptionProcessed(false);

    if (mode === 'global') {
      // Reset global state
      setTranscriptText('');
      setTranscription('');
      setActiveSectionPath(null);
    } else if (mode === 'section' && sectionPath) {
      // Reset section state
      if (formRendererRef.current) {
        formRendererRef.current.clearSectionTranscription(sectionPath);
      }
      setActiveSectionPath(sectionPath);
    }

    // Set the recording mode
    setRecordingMode(mode);
  };

  // WebSocket connection and handlers - only connect if microphone permission is granted
  const {
    connect,
    isConnected,
    isConnecting,
    isProcessing,
    error,
    sendAudio,
    processTranscription,
    transcription,
    suggestions,
    setTranscription,
    setSuggestions,
  } = useWebSocket({
    url: 'wss://agent.stance.health/ws',
    onOpen: () => {
      toast({
        title: 'Connected',
        description: 'Ready to transcribe audio',
      });
    },
    onClose: () => {
      toast({
        title: 'Disconnected',
        description: 'WebSocket connection closed',
        variant: 'destructive',
      });
    },
    onError: () => {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to transcription service',
        variant: 'destructive',
      });
    },
    onFormData: (data) => {
      // Check for structured payload - the signal that form is filled
      if (data && data.payloadType === 'structured') {
        console.log('Received structured form data - stopping all processing');

        // IMMEDIATELY stop all processing and recording
        setRecordingMode('idle');
        setTranscriptionProcessed(true);

        // Update the form with the received data
        if (formRendererRef.current && data.formData) {
          formRendererRef.current.updateFormWithLLMData({
            payloadType: 'structured',
            formData: data.formData,
          });

          // Also update parent state
          setFormData(data.formData);
        }

        toast({
          title: 'Form Updated',
          description: 'Form has been filled with transcription data',
        });

        return; // Exit early after processing structured data
      }

      // Handle regular form data updates (fallback)
      handleIncomingFormData(data);
    },
  });

  // Connect to WebSocket on component mount - only if microphone permission is granted
  useEffect(() => {
    // Only connect if microphone permission is granted
    if (microphonePermission !== 'granted') return;

    connect();

    // Automatically try to reconnect every 5 seconds if connection fails
    const reconnectInterval = setInterval(() => {
      if (!isConnected && !isConnecting) {
        console.log('Attempting to reconnect WebSocket...');
        connect();
      }
    }, 5000);

    return () => clearInterval(reconnectInterval);
  }, [connect, isConnected, isConnecting, microphonePermission]);

  // Update transcription when received from WebSocket
  useEffect(() => {
    // If there's no transcription or we're in idle mode (processing complete), do nothing
    if (!transcription || recordingMode === 'idle') return;

    // Route transcription based on current recording mode
    if (recordingMode === 'global') {
      // Only update global transcription in global mode
      setTranscriptText(transcription);
    } else if (
      recordingMode === 'section' &&
      activeSectionPath &&
      formRendererRef.current
    ) {
      // Only update section transcription in section mode
      formRendererRef.current.updateSectionTranscription(
        activeSectionPath,
        transcription
      );
    }
  }, [transcription, recordingMode, activeSectionPath]);

  // Handle incoming form data from the WebSocket
  const handleIncomingFormData = useCallback(
    (data: any) => {
      if (!data) return;

      try {
        // Use the form renderer ref to update the data from LLM
        // FormRenderer will filter data based on selected sections
        if (formRendererRef.current) {
          formRendererRef.current.updateFormWithLLMData(data);

          // Also update parent state if there's formData
          if (data.formData) {
            setFormData(data.formData);
          }

          toast({
            title: 'Form Updated',
            description: 'Form data has been processed and updated',
          });
        }
      } catch (error) {
        console.error('Error processing form data:', error);
        toast({
          title: 'Processing Error',
          description: 'Failed to process form data',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Audio recording handlers for GLOBAL recording
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

    // Prepare for a new global recording
    prepareNewRecording('global');

    // Send audio with current context
    const context = {
      formKey,
      formData: formData || {},
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

  // Process transcription text
  const handleProcessTranscription = () => {
    if (!transcriptText.trim()) {
      toast({
        title: 'Empty transcription',
        description: 'Please record audio or enter text to process',
        variant: 'destructive',
      });
      return;
    }

    // Skip if already processed or not in global mode
    if (transcriptionProcessed || recordingMode !== 'global') {
      console.log(
        'Transcription already processed or not in global mode, skipping'
      );
      return;
    }

    // Mark as processed BEFORE sending to prevent race conditions
    setTranscriptionProcessed(true);

    // Send transcription with current context
    const context = {
      formKey,
      formData: formData || {},
    };

    const sent = processTranscription(transcriptText, context);

    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
      // Reset processed flag if send failed
      setTranscriptionProcessed(false);
    }
  };

  // Auto-process function that respects processing state
  const handleAutoProcess = () => {
    // Only auto-process if:
    // 1. In global mode
    // 2. Not already processed
    // 3. Has text content
    // 4. Not already in idle mode (indicating processing is complete)
    if (
      recordingMode === 'global' &&
      !transcriptionProcessed &&
      transcriptText.trim()
    ) {
      console.log('Auto-processing global transcription');
      handleProcessTranscription();
    } else {
      console.log(
        'Skipping auto-process:',
        recordingMode !== 'global'
          ? 'not in global mode'
          : transcriptionProcessed
          ? 'already processed'
          : !transcriptText.trim()
          ? 'no text'
          : 'already idle'
      );
    }
  };

  // Handle form data changes
  const handleFormChange = (newFormData: any) => {
    setFormData(newFormData);

    // Update the form data in localStorage
    try {
      const savedReport = localStorage.getItem('agentReport');
      if (savedReport) {
        const reportData = JSON.parse(savedReport);
        reportData[formKey] = newFormData;
        localStorage.setItem('agentReport', JSON.stringify(reportData));
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  };

  // Submit form data
  const handleFormSubmit = async () => {
    if (!reportId || !appointmentId) {
      toast({
        title: 'Missing Information',
        description: 'Report ID or Appointment ID is missing',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
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

      // Deep clone form data to avoid modifying original
      const formDataCopy = JSON.parse(JSON.stringify(formData));

      // Remove record fields and fix types
      const processData = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
          return obj.map((item) => processData(item));
        }

        const result = {};
        for (const key in obj) {
          if (key === 'record') continue; // Skip record fields

          if (key === 'load' && typeof obj[key] === 'number') {
            result[key] = String(obj[key]);
          } else if (typeof obj[key] === 'object') {
            result[key] = processData(obj[key]);
          } else {
            result[key] = obj[key];
          }
        }
        return result;
      };

      const input = {};
      input[formKey] = processData(formDataCopy);

      const variables = {
        appointmentId,
        input,
      };

      const result = await graphqlRequest(mutation, variables);

      // Rest of the function remains the same...
    } catch (error) {
      // Error handling...
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle field-specific audio recording - UPDATED
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

    // Prepare for a new section recording
    if (context.sectionPath) {
      prepareNewRecording('section', context.sectionPath);
    }

    // Send audio with context
    const sent = sendAudio(base64Audio, context);

    if (!sent) {
      toast({
        title: 'Failed to send audio',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
      setRecordingMode('idle');
      setActiveSectionPath(null);
    }
  };

  // Handle field transcription processing - UPDATED
  const handleFieldTranscriptionProcess = (
    transcription: string,
    context: any
  ) => {
    if (!isConnected) {
      toast({
        title: 'Not connected',
        description: 'Attempting to reconnect...',
        variant: 'destructive',
      });
      connect();
      return;
    }

    // Only process if in section mode and the context matches the active section
    if (
      recordingMode !== 'section' ||
      context.sectionPath !== activeSectionPath
    ) {
      console.log('Not processing - wrong mode or section mismatch');
      return;
    }

    // The context already contains selectedSections from the FormRenderer
    const sent = processTranscription(transcription, context);

    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
    // DO NOT reset recording mode here - wait for form data to arrive
  };

  // Reset form to initial state
  const handleFormReset = () => {
    if (
      confirm(
        'Are you sure you want to reset this form? All your data will be lost.'
      )
    ) {
      setFormData(null);
      setTranscriptText('');
      setTranscriptionProcessed(false);
      setActiveSectionPath(null);
      setRecordingMode('idle');

      // Update localStorage
      try {
        const savedReport = localStorage.getItem('agentReport');
        if (savedReport) {
          const reportData = JSON.parse(savedReport);
          reportData[formKey] = null;
          localStorage.setItem('agentReport', JSON.stringify(reportData));
        }
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }

      toast({
        title: 'Form Reset',
        description: 'All form data has been reset',
      });
    }
  };

  // Check if the form schema exists
  useEffect(() => {
    // Validate that the requested form exists in our schemas
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Checking microphone permissions...</p>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-primary/5 to-background">
        {/* Microphone Permission Dialog */}
        <Dialog
          open={showPermissionDialog}
          onOpenChange={setShowPermissionDialog}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Microphone Access Required
              </DialogTitle>
              <DialogDescription>
                This application needs access to your microphone to provide
                voice recording and transcription features. Please allow
                microphone access when prompted by your browser.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                onClick={handleRequestPermission}
                className="w-full sm:w-auto"
              >
                Allow Microphone Access
              </Button>
              <Button
                variant="outline"
                onClick={handleContinueWithoutMicrophone}
                className="w-full sm:w-auto"
              >
                Continue Without Microphone
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="w-full space-y-6 pb-16">
          {/* Header with patient info */}
          <Card className="w-full bg-card">
            <CardHeader>
              <CardTitle className="text-center text-1xl font-bold">
                {formKey.charAt(0).toUpperCase() + formKey.slice(1)} -{' '}
                {patientName || 'Patient'}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Audio recorder and transcription section */}
          <Card className="w-full shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-1xl">
                Voice Recorder
                {microphonePermission === 'denied' && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    (Disabled)
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {microphonePermission === 'denied' && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 border-red-200"
                >
                  <MicOff className="h-4 w-4" />
                  <AlertDescription>
                    Microphone access is disabled. Voice recording features are
                    not available.
                    <Button
                      variant="link"
                      className="p-0 h-auto ml-2 text-destructive underline"
                      onClick={() => setShowPermissionDialog(true)}
                    >
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {!isConnected &&
                !isConnecting &&
                microphonePermission === 'granted' && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 border-red-200"
                  >
                    <WifiOff className="h-4 w-4" />
                    <AlertDescription>
                      Cannot connect to the transcription service. Please check
                      your network connection.
                    </AlertDescription>
                  </Alert>
                )}

              {suggestions && (
                <SuggestionBox
                  suggestions={suggestions}
                  onClose={() => setSuggestions(null)}
                />
              )}

              <div className="flex justify-center py-2">
                <AudioRecorder
                  onAudioEncoded={handleAudioEncoded}
                  isProcessing={isProcessing}
                  label="Record for form"
                  isDisabled={
                    recordingMode === 'section' ||
                    microphonePermission !== 'granted'
                  } // Disable when in section mode or no mic permission
                />
              </div>

              {/* Only show global transcription box when not in section mode */}
              {recordingMode !== 'section' && (
                <TranscriptionBox
                  value={transcriptText}
                  onChange={(text) => {
                    setTranscription(text);
                    setTranscriptText(text);
                    // Reset processed flag if text changes in idle mode
                    if (text !== transcriptText && recordingMode === 'idle') {
                      setTranscriptionProcessed(false);
                      setRecordingMode('global');
                    }
                  }}
                  isProcessing={isProcessing && recordingMode === 'global'}
                  className="mt-4"
                  autoProcess={handleAutoProcess}
                  autoProcessDelay={5000}
                />
              )}

              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleProcessTranscription}
                  disabled={
                    isProcessing ||
                    !transcriptText.trim() ||
                    !isConnected ||
                    recordingMode === 'section' || // Disable in section mode
                    transcriptionProcessed || // Disable if already processed
                    microphonePermission !== 'granted' // Disable if no mic permission
                  }
                  variant={
                    isProcessing ||
                    !transcriptText.trim() ||
                    !isConnected ||
                    transcriptionProcessed ||
                    microphonePermission !== 'granted'
                      ? 'outline'
                      : 'default'
                  }
                  className="px-6"
                >
                  Process Transcription
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Form section */}
          <Card className="w-full shadow-md">
            <CardHeader>
              <CardTitle className="text-center">
                {formKey.charAt(0).toUpperCase() + formKey.slice(1)} Form
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <div className="pb-6">
                <FormRenderer
                  ref={formRendererRef}
                  schema={schema}
                  formKey={formKey}
                  formData={formData}
                  onChange={handleFormChange}
                  onLLMUpdate={handleFormChange}
                  onAudioRecorded={handleFieldAudioEncoded}
                  onTranscriptionProcess={handleFieldTranscriptionProcess}
                  isWebSocketConnected={isConnected}
                  isProcessing={isProcessing}
                  recordingMode={recordingMode}
                  activeSectionPath={activeSectionPath}
                  appointmentId={appointmentId}
                  patientId={patientId}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default FormPage;
