// FormPage.tsx - Complete fixed version with proper state management

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

  // Add state for forcing audio recorder reset
  const [audioRecorderKey, setAudioRecorderKey] = useState(0);

  const [transcriptText, setTranscriptText] = useState('');

  // Debug transcriptText changes
  useEffect(() => {
    console.log('=== transcriptText state changed ===');
    console.log('New transcriptText value:', transcriptText);
    console.log('Length:', transcriptText.length);
  }, [transcriptText]);
  const [formData, setFormData] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientName, setPatientName] = useState<string>('Patient');

  // Microphone permission states
  const [microphonePermission, setMicrophonePermission] = useState<
    'checking' | 'granted' | 'denied' | 'prompt'
  >('checking');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionError, setPermissionError] = useState<string>('');

  // Recording mode states - simplified
  const [recordingMode, setRecordingMode] = useState<
    'idle' | 'global' | 'section'
  >('idle');
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

        // Check current permission state using the Permissions API
        try {
          const permissionStatus = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });

          if (permissionStatus.state === 'granted') {
            // Permission already granted, try to get media stream to confirm
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
              });
              stream.getTracks().forEach((track) => track.stop()); // Clean up immediately
              setMicrophonePermission('granted');
              setShowPermissionDialog(false);
              return;
            } catch (error) {
              console.warn(
                'Permission granted but unable to access microphone:',
                error
              );
              // Fall through to prompt for permission
            }
          } else if (permissionStatus.state === 'denied') {
            setMicrophonePermission('denied');
            setPermissionError(
              'Microphone access was previously denied. Please enable it in your browser settings.'
            );
            setShowPermissionDialog(true);
            return;
          }
          // If state is 'prompt', we'll show the permission dialog
        } catch (permissionError) {
          console.warn(
            'Permissions API not supported or failed:',
            permissionError
          );
          // Fall through to manual check
        }

        // Fallback: Try to access media without requesting permission first
        // This will only work if permission was previously granted
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          setMicrophonePermission('granted');
          setShowPermissionDialog(false);
        } catch (error) {
          // Permission not granted or microphone not available
          // Show permission dialog to let user grant permission
          setMicrophonePermission('prompt');
          setShowPermissionDialog(true);
        }
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

  // Create agent report on initial load
  useEffect(() => {
    if (microphonePermission === 'checking') return;

    const fetchPatientName = async () => {
      if (!patientId) return;

      try {
        const storedPatient = localStorage.getItem('selectedPatient');
        if (storedPatient) {
          const patientData = JSON.parse(storedPatient);
          if (patientData && patientData.name) {
            setPatientName(patientData.name);
            return;
          }
        }

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
        const existingReport = localStorage.getItem('agentReport');
        if (existingReport) {
          try {
            const parsedReport = JSON.parse(existingReport);
            if (parsedReport._id) {
              setReportId(parsedReport._id);
              if (parsedReport[formKey]) {
                setFormData(parsedReport[formKey]);
              }
              return;
            }
          } catch (e) {
            console.error('Error parsing existing report:', e);
          }
        }

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
          setReportId(result.createAgentReport._id);
          localStorage.setItem(
            'agentReport',
            JSON.stringify(result.createAgentReport)
          );

          toast({
            title: 'Report Created',
            description: 'New report initialized successfully',
          });

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

  // Handle incoming form data from WebSocket - SIMPLIFIED
  const handleIncomingFormData = useCallback(
    (data: any) => {
      console.log('=== handleIncomingFormData called ===');
      console.log('Data:', data);
      console.log('Current recording mode:', recordingMode);

      if (!data) return;

      try {
        if (formRendererRef.current) {
          formRendererRef.current.updateFormWithLLMData(data);

          if (data.formData) {
            setFormData(data.formData);

            // CLEAR GLOBAL TRANSCRIPTION AFTER ANY FORM DATA UPDATE
            if (recordingMode === 'global') {
              console.log(
                'Clearing global transcription after form data update'
              );
              setTranscriptText('');
              setTranscription('');
              setRecordingMode('idle');

              // Force re-render of audio recorder by resetting key
              setAudioRecorderKey((prev) => prev + 1);
            }

            // RESET TO IDLE MODE AFTER SECTION PROCESSING TO ALLOW OTHER SECTIONS
            if (recordingMode === 'section') {
              console.log(
                'Resetting section mode to idle after form data update'
              );
              setRecordingMode('idle');
              setActiveSectionPath(null);
            }
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
    [toast, recordingMode]
  );

  // WebSocket connection and handlers
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
      console.log('=== FormPage onFormData called ===');
      console.log('Data received:', data);
      console.log('Current recording mode:', recordingMode);
      console.log('Current transcriptText before clearing:', transcriptText);

      // Handle structured payload (complete form filling)
      if (data && data.payloadType === 'structured') {
        console.log('Received structured form data - form is complete');

        // ALWAYS clear global transcription for structured payloads
        console.log('Clearing global transcription for structured payload');
        console.log('transcriptText before clearing:', transcriptText);

        setTranscriptText('');
        setTranscription('');

        // Force re-render by updating key
        setAudioRecorderKey((prev) => {
          const newKey = prev + 1;
          console.log('Resetting audio recorder key to:', newKey);
          return newKey;
        });

        // Reset recording mode
        setRecordingMode('idle');
        setActiveSectionPath(null);

        console.log('Global transcription cleared - should be empty now');

        if (formRendererRef.current && data.formData) {
          formRendererRef.current.updateFormWithLLMData({
            payloadType: 'structured',
            formData: data.formData,
          });
          setFormData(data.formData);
        }

        toast({
          title: 'Form Updated',
          description: 'Form has been filled with transcription data',
        });

        // IMPORTANT: Don't call handleIncomingFormData for structured payloads
        // to avoid any conflicting state updates
        return;
      }

      // Handle regular form data updates
      handleIncomingFormData(data);
    },
  });

  // Connect to WebSocket
  useEffect(() => {
    if (microphonePermission !== 'granted') return;

    connect();

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
    if (!transcription) return;

    if (recordingMode === 'global') {
      setTranscriptText(transcription);
    } else if (
      recordingMode === 'section' &&
      activeSectionPath &&
      formRendererRef.current
    ) {
      formRendererRef.current.updateSectionTranscription(
        activeSectionPath,
        transcription
      );
    }
  }, [transcription, recordingMode, activeSectionPath]);

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

    console.log('Global audio recording completed');

    // Set to global mode and clear previous state
    setRecordingMode('global');
    setActiveSectionPath(null);

    // DON'T clear transcriptText here - let the user see what was transcribed
    // The clearing will happen after processing

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

  // PROCESS GLOBAL TRANSCRIPTION
  const handleProcessTranscription = () => {
    if (!transcriptText.trim()) {
      toast({
        title: 'Empty transcription',
        description: 'Please record audio or enter text to process',
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
    }
  };

  // AUTO-PROCESS HANDLER - SIMPLIFIED
  const handleAutoProcess = () => {
    if (transcriptText.trim() && isConnected) {
      console.log('Auto-processing global transcription');
      handleProcessTranscription();
    }
  };

  // Handle form data changes
  const handleFormChange = (newFormData: any) => {
    setFormData(newFormData);

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

      const formDataCopy = JSON.parse(JSON.stringify(formData));

      const processData = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
          return obj.map((item) => processData(item));
        }

        const result = {};
        for (const key in obj) {
          if (key === 'record') continue;

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

      // Handle success...
      toast({
        title: 'Form Submitted',
        description: 'Your form has been successfully submitted',
      });
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

  // SECTION AUDIO RECORDING
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

    // Set to section mode
    if (context.sectionPath) {
      setRecordingMode('section');
      setActiveSectionPath(context.sectionPath);
    }

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

  // SECTION TRANSCRIPTION PROCESSING
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

    const sent = processTranscription(transcription, context);

    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  // Reset form
  const handleFormReset = () => {
    if (
      confirm(
        'Are you sure you want to reset this form? All your data will be lost.'
      )
    ) {
      setFormData(null);
      setTranscriptText('');
      setActiveSectionPath(null);
      setRecordingMode('idle');

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

  // Validate form schema
  useEffect(() => {
    if (formKey && !(formKey in formSchemas)) {
      toast({
        title: 'Invalid Form',
        description: `Form type '${formKey}' does not exist`,
        variant: 'destructive',
      });
      console.error(`Invalid form key: ${formKey}`);
    }
  }, [formKey, toast]);

  // Show loading state
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
        {/* Microphone Permission Dialog - only show when permission is needed */}
        <Dialog
          open={showPermissionDialog}
          onOpenChange={(open) => {
            // Only allow closing if permission is granted or denied, not if it's still prompt
            if (!open && microphonePermission !== 'prompt') {
              setShowPermissionDialog(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Microphone Access Required
              </DialogTitle>
              <DialogDescription>
                {microphonePermission === 'denied'
                  ? 'Microphone access was denied. Please enable it in your browser settings to use voice recording features.'
                  : 'This application needs access to your microphone to provide voice recording and transcription features. Please allow microphone access when prompted by your browser.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {microphonePermission === 'denied' ? (
                <Button
                  onClick={() => {
                    toast({
                      title: 'Enable Microphone',
                      description:
                        'Please check your browser settings to enable microphone access, then refresh the page.',
                    });
                  }}
                  className="w-full sm:w-auto"
                  variant="outline"
                >
                  Check Browser Settings
                </Button>
              ) : (
                <Button
                  onClick={handleRequestPermission}
                  className="w-full sm:w-auto"
                >
                  Allow Microphone Access
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="w-full space-y-6 pb-16">
          {/* Header */}
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
                  key={audioRecorderKey} // Force reset when key changes
                  onAudioEncoded={handleAudioEncoded}
                  isProcessing={isProcessing}
                  label="Record for form"
                  isDisabled={
                    microphonePermission !== 'granted' ||
                    !isConnected ||
                    isProcessing
                  }
                />
              </div>

              {/* Global transcription box - only show when not in section mode */}
              {recordingMode !== 'section' && (
                <TranscriptionBox
                  key={`global-transcription-${audioRecorderKey}`} // Force re-render when audio recorder resets
                  value={transcriptText}
                  onChange={(text) => {
                    console.log('=== Global TranscriptionBox onChange ===');
                    console.log('Previous transcriptText:', transcriptText);
                    console.log('New text from TranscriptionBox:', text);
                    console.log('Current recording mode:', recordingMode);

                    setTranscription(text);
                    setTranscriptText(text);

                    // Switch to global mode when user starts typing
                    if (text.trim().length > 0 && recordingMode === 'idle') {
                      console.log('Switching to global mode due to text input');
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
                    recordingMode === 'section' ||
                    microphonePermission !== 'granted'
                  }
                  variant={
                    isProcessing ||
                    !transcriptText.trim() ||
                    !isConnected ||
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
