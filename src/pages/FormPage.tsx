
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import AudioRecorder from '@/components/audio/AudioRecorder';
import TranscriptionBox from '@/components/audio/TranscriptionBox';
import SuggestionBox from '@/components/ui/suggestion-box';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, WifiOff, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { graphqlRequest } from '@/utils/graphqlClient';
import formSchemas from '@/schemas/formSchemas';
import FormRenderer, { FormRendererRef } from '@/components/FormRenderer';
import { ThemeProvider } from '@/styles/theme-provider';
import { themeColors } from '@/styles/theme';

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
  const { toast } = useToast();
  const formRendererRef = useRef<FormRendererRef>(null);
  
  // Initialize schema based on formKey
  const schema = formSchemas[formKey as keyof typeof formSchemas] || formSchemas.physio;
  
  // Create agent report on initial load
  useEffect(() => {
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
              snc {
                exerciseName
                repsUnit
                repsValue
                rpe
                duration
              }
              physio {
                testName
                unitName
                value
                rightValue
                leftValue
                comments
              }
              firstAssessment {
                clinicalDetails {
                  clinicalHistory
                  chiefComplaint
                  duration
                }
                objectiveAssessments {
                  testName
                  unitName
                  value
                  rightValue
                  leftValue
                  comments
                }
                subjectiveAssessments {
                  testName
                  conclusion
                }
                subjectiveGoals {
                  goalDetails
                  targetDate
                }
                objectiveGoals {
                  goalName
                  goalCategory
                  unitName
                  value
                  targetDate
                }
                recommendation {
                  sessionType
                  sessionFrequency
                }
                patientAdvice {
                  adviceDetails
                }
              }
              assessment {
                plan {
                  exerciseName
                  repsUnit
                  repsValue
                  rpe
                  duration
                }
                subjectiveInputs {
                  inputs
                }
                objectiveAssessments {
                  testName
                  unitName
                  value
                  rightValue
                  leftValue
                  comments
                }
              }
            }
          }
        `;

        // Get center ID from localStorage or use default
        const centerId = localStorage.getItem('centerId') || '67fe35f25e42152fb5185a5e';

        const variables = {
          input: {
            patient: patientId,
            center: centerId,
            appointment: appointmentId,
          },
        };

        const result = await graphqlRequest(mutation, variables);
        
        if (result && result.createAgentReport && result.createAgentReport._id) {
          // Save the report ID
          setReportId(result.createAgentReport._id);
          
          // Save the full report in localStorage
          localStorage.setItem('agentReport', JSON.stringify(result.createAgentReport));
          
          toast({
            title: "Report Created",
            description: "New report initialized successfully",
          });
          
          // Set initial form data if it exists
          if (result.createAgentReport[formKey]) {
            setFormData(result.createAgentReport[formKey]);
          }
        }
      } catch (error) {
        console.error('Error creating initial report:', error);
        toast({
          title: "Failed to Create Report",
          description: "Could not initialize the form data",
          variant: "destructive",
        });
      }
    };

    fetchPatientName();
    createInitialReport();
  }, [patientId, appointmentId, toast, formKey]);

  // Store formKey, patientId and appointmentId in localStorage for WebSocket access
  useEffect(() => {
    if (formKey) localStorage.setItem('formKey', formKey);
    if (patientId) localStorage.setItem('userId', patientId);
    if (appointmentId) localStorage.setItem('appointmentId', appointmentId);
  }, [formKey, patientId, appointmentId]);

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
    url: 'ws://localhost:8080/ws', // Updated WebSocket URL
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
      handleIncomingFormData(data);
    },
  });

  // Connect to WebSocket on component mount
  useEffect(() => {
    connect();

    // Automatically try to reconnect every 5 seconds if connection fails
    const reconnectInterval = setInterval(() => {
      if (!isConnected && !isConnecting) {
        console.log('Attempting to reconnect WebSocket...');
        connect();
      }
    }, 5000);

    return () => clearInterval(reconnectInterval);
  }, [connect, isConnected, isConnecting]);

  // Update transcription when received from WebSocket
  useEffect(() => {
    if (transcription) {
      setTranscriptText(transcription);
    }
  }, [transcription]);

  // Handle incoming form data from the WebSocket
  const handleIncomingFormData = useCallback((data: any) => {
    if (!data) return;
    
    try {
      // Use the form renderer ref to update the data from LLM
      if (formRendererRef.current) {
        formRendererRef.current.updateFormWithLLMData(data);
        
        toast({
          title: "Form Updated",
          description: "Form data has been processed and updated",
        });
      }
    } catch (error) {
      console.error('Error processing form data:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process form data",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Audio recording handlers
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

    // Send audio with current context (formKey is important here)
    const context = {
      formKey,
      formData: formData || {}
    };

    const sent = sendAudio(base64Audio, context);
    
    if (!sent) {
      toast({
        title: 'Failed to send audio',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
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

    // Send transcription with current context
    const context = {
      formKey,
      formData: formData || {}
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
        title: "Missing Information",
        description: "Report ID or Appointment ID is missing",
        variant: "destructive"
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
      
      const input: any = {};
      
      // Use the formKey to set the right field in the update
      input[formKey] = formData;
      
      // Add userId if patientId is available
      if (patientId) {
        input.userId = patientId;
      }
      
      const variables = {
        appointmentId,
        input
      };
      
      const result = await graphqlRequest(mutation, variables);
      
      if (result && result.updateAgentReport) {
        toast({
          title: "Form Submitted",
          description: "Your form has been successfully saved",
        });
        
        // Update localStorage with the latest data
        const savedReport = localStorage.getItem('agentReport');
        if (savedReport) {
          try {
            const reportData = JSON.parse(savedReport);
            
            reportData[formKey] = formData;
            reportData.updatedAt = result.updateAgentReport.updatedAt;
            reportData.version = result.updateAgentReport.version;
            reportData.isActive = result.updateAgentReport.isActive;
            reportData.isFilledCompletely = result.updateAgentReport.isFilledCompletely;
            
            localStorage.setItem('agentReport', JSON.stringify(reportData));
          } catch (error) {
            console.error('Error updating localStorage after form submission:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your form",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to initial state
  const handleFormReset = () => {
    if (confirm("Are you sure you want to reset this form? All your data will be lost.")) {
      setFormData(null);
      setTranscriptText('');
      
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
        title: "Form Reset",
        description: "All form data has been reset",
      });
    }
  };
  
  // Check if the form schema exists
  useEffect(() => {
    // Validate that the requested form exists in our schemas
    if (formKey && !(formKey in formSchemas)) {
      toast({
        title: "Invalid Form",
        description: `Form type '${formKey}' does not exist`,
        variant: "destructive",
      });
      console.error(`Invalid form key: ${formKey}`);
    }
  }, [formKey, toast]);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col items-center p-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="w-full max-w-4xl space-y-6 pb-16">
          {/* Header with patient info */}
          <Card className="w-full bg-card">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-bold">
                {formKey.charAt(0).toUpperCase() + formKey.slice(1)} - {patientName || 'Patient'}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Audio recorder and transcription section */}
          <Card className="w-full shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-center">Voice Recorder</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {!isConnected && !isConnecting && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <WifiOff className="h-4 w-4" />
                  <AlertDescription>
                    Cannot connect to the transcription service. Please check your
                    network connection.
                  </AlertDescription>
                </Alert>
              )}

              {suggestions && (
                <SuggestionBox 
                  suggestions={suggestions} 
                  onClose={() => setSuggestions(null)} 
                />
              )}

              <div className="flex justify-center py-4">
                <AudioRecorder
                  onAudioEncoded={handleAudioEncoded}
                  isProcessing={isProcessing}
                  label="Record for form"
                />
              </div>

              <TranscriptionBox
                value={transcriptText}
                onChange={setTranscription}
                isProcessing={isProcessing}
                className="mt-4"
                autoProcess={handleProcessTranscription}
                autoProcessDelay={5000}
              />

              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleProcessTranscription}
                  disabled={
                    isProcessing || !transcriptText.trim() || !isConnected
                  }
                  variant={
                    isProcessing || !transcriptText.trim() || !isConnected
                      ? "outline"
                      : "default"
                  }
                  className="px-6"
                >
                  Process Transcription
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex justify-center pt-0 pb-4">
              <div className="text-sm text-center text-muted-foreground">
                {isConnecting && 'Connecting to transcription service...'}
                {error && 'Connection error. Please try again.'}
                {!isConnecting &&
                  isConnected &&
                  !isProcessing &&
                  'Ready to record'}
                {!isConnecting &&
                  isConnected &&
                  isProcessing &&
                  'Processing audio...'}
              </div>
            </CardFooter>
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
                />
                
                {/* Form action buttons */}
                <div className="flex justify-end space-x-4 mt-8">
                  <Button 
                    variant="outline" 
                    onClick={handleFormReset}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset Form
                  </Button>
                  
                  <Button 
                    variant="default"
                    onClick={handleFormSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Submitting...' : 'Submit Form'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default FormPage;
