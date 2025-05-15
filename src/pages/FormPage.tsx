
import React, { useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import Recorder from '@/components/Recorder';
import TranscriptBox from '@/components/TranscriptBox';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, WifiOff, Save, RefreshCw } from 'lucide-react';
import FormRenderer, { FormRendererRef } from '@/components/FormRenderer';
import formSchemas from '@/schemas/formSchemas';
import { Button } from '@/components/ui/button';
import { graphqlRequest } from '@/utils/graphqlClient';

type FormPageParams = {
  formKey: string;
  patientId: string;
  appointmentId: string;
};

const FormPage = () => {
  const {
    formKey = 'snc',
    patientId,
    appointmentId,
  } = useParams<FormPageParams>();
  const formRendererRef = useRef<FormRendererRef>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [formData, setFormData] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Initialize form schema based on formKey
  const schema =
    formSchemas[formKey as keyof typeof formSchemas] || formSchemas.snc;

  // Create agent report on initial load
  useEffect(() => {
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
              return; // Report already exists
            }
          } catch (e) {
            console.error('Error parsing existing report:', e);
          }
        }
        
        // Creating the new report
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

        // Get center ID (you might need to adjust this based on your app's logic)
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

    createInitialReport();
  }, [patientId, appointmentId, toast]);

  // Store formKey, patientId and appointmentId in localStorage for WebSocket access
  useEffect(() => {
    if (formKey) localStorage.setItem('formKey', formKey);
    if (patientId) localStorage.setItem('userId', patientId);
    if (appointmentId) localStorage.setItem('appointmentId', appointmentId);
  }, [formKey, patientId, appointmentId]);
  
  // Load saved form data from localStorage
  useEffect(() => {
    const savedReport = localStorage.getItem('agentReport');
    if (savedReport) {
      try {
        const parsedReport = JSON.parse(savedReport);
        if (parsedReport._id) {
          setReportId(parsedReport._id);
        }
        
        // Load form data based on formKey
        if (formKey === 'snc' && parsedReport.snc) {
          setFormData(parsedReport.snc);
        } else if (formKey === 'physio' && parsedReport.physio) {
          setFormData(parsedReport.physio);
        } else if (formKey === 'firstAssessment' && parsedReport.firstAssessment) {
          setFormData(parsedReport.firstAssessment);
        } else if (formKey === 'assessment' && parsedReport.assessment) {
          setFormData(parsedReport.assessment);
        }
      } catch (error) {
        console.error('Error parsing saved report:', error);
      }
    }
  }, [formKey]);

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
    url: 'ws://localhost:8080/ws',
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
      // When we receive form data from the WebSocket, update our local state
      // and update the FormRenderer via ref
      setFormData(data);

      if (formRendererRef.current) {
        formRendererRef.current.updateFormWithLLMData(data);
      }

      // Save to localStorage
      const reportData = {
        formKey,
        patientId,
        appointmentId,
        formData: data,
      };
      localStorage.setItem('agentReport', JSON.stringify(reportData));
    },
  });

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

  useEffect(() => {
    if (transcription) {
      setTranscriptText(transcription);
      
      // Auto-process transcription if we have text
      if (transcription.trim() && isConnected) {
        processTranscription(transcription, formData);
      }
    }
  }, [transcription]);

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

    // Include current form data with audio payload
    const sent = sendAudio(base64Audio, formData);
    if (!sent) {
      toast({
        title: 'Failed to send audio',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  const handleProcessTranscription = () => {
    if (!transcriptText.trim()) {
      toast({
        title: 'Empty transcription',
        description: 'Please record audio or enter text to process',
        variant: 'destructive',
      });
      return;
    }

    // Include current form data with text payload
    const sent = processTranscription(transcriptText, formData);
    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  const handleFormChange = (newFormData: any) => {
    setFormData(newFormData);

    // Save to localStorage, preserving other report data
    try {
      const savedReport = localStorage.getItem('agentReport');
      let reportData = savedReport ? JSON.parse(savedReport) : {};
      
      // Update the appropriate section based on formKey
      if (formKey === 'snc') {
        reportData.snc = newFormData;
      } else if (formKey === 'physio') {
        reportData.physio = newFormData;
      } else if (formKey === 'firstAssessment') {
        reportData.firstAssessment = newFormData;
      } else if (formKey === 'assessment') {
        reportData.assessment = newFormData;
      }
      
      localStorage.setItem('agentReport', JSON.stringify(reportData));
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  };
  
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
      // Prepare the mutation based on formKey
      let mutation = `
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
      
      // Prepare input variables based on formKey
      let input: any = {};
      
      if (formKey === 'snc') {
        input.snc = formData;
      } else if (formKey === 'physio') {
        input.physio = formData;
      } else if (formKey === 'firstAssessment') {
        input.firstAssessment = formData;
      } else if (formKey === 'assessment') {
        input.assessment = formData;
      }
      
      // Add userId if patientId is available
      if (patientId) {
        input.userId = patientId;
      }
      
      const variables = {
        appointmentId,
        input
      };
      
      // Send the GraphQL mutation
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
            
            // Update the specific form data
            if (formKey === 'snc') {
              reportData.snc = formData;
            } else if (formKey === 'physio') {
              reportData.physio = formData;
            } else if (formKey === 'firstAssessment') {
              reportData.firstAssessment = formData;
            } else if (formKey === 'assessment') {
              reportData.assessment = formData;
            }
            
            // Update other fields from the response
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

  const handleFormReset = () => {
    if (confirm("Are you sure you want to reset this form? All your data will be lost.")) {
      // Reset transcription and form data
      setTranscriptText('');
      setFormData(null);
      
      // Update FormRenderer via ref
      if (formRendererRef.current) {
        formRendererRef.current.updateFormWithLLMData({});
      }
      
      toast({
        title: "Form Reset",
        description: "All form data has been reset",
      });
    }
  };

  // Automatically hide suggestions after 7 seconds
  useEffect(() => {
    if (suggestions) {
      const timer = setTimeout(() => {
        setSuggestions(null);
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, [suggestions, setSuggestions]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-gradient-to-b from-primary/10 to-background overflow-auto">
      <div className="w-full max-w-4xl space-y-6 pb-16">
        {/* Header with form info */}
        <Card className="w-full bg-card">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              {formKey.toUpperCase()} -{' '}
              {patientId ? `Patient ID: ${patientId}` : 'New Patient'}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Audio recorder and transcription section */}
        <Card className="w-full shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-center">Voice Recorder</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {!isConnected && !isConnecting && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <WifiOff className="h-4 w-4" />
                <AlertTitle>WebSocket Disconnected</AlertTitle>
                <AlertDescription>
                  Cannot connect to the transcription service. Please check your
                  network connection.
                </AlertDescription>
              </Alert>
            )}

            {suggestions && (
              <Alert
                variant="default"
                className="bg-slate-900 text-white border-slate-800"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Suggestions</AlertTitle>
                <AlertDescription>
                  <div className="text-sm whitespace-pre-wrap max-h-16 overflow-y-auto">
                    {typeof suggestions === 'string' && suggestions.includes('[') && suggestions.includes(']') ? 
                      (() => {
                        try {
                          // Try to parse as JSON if it looks like JSON
                          const suggestionsText = suggestions.substring(
                            suggestions.indexOf('['),
                            suggestions.lastIndexOf(']') + 1
                          );
                          const parsedSuggestions = JSON.parse(suggestionsText);
                          // Show only the first two suggestions
                          const limitedSuggestions = parsedSuggestions.slice(0, 2);
                          
                          return (
                            <ul className="list-disc pl-5">
                              {limitedSuggestions.map((suggestion: string, index: number) => (
                                <li key={index}>{suggestion}</li>
                              ))}
                            </ul>
                          );
                        } catch (e) {
                          // If parsing fails, show as regular text
                          return suggestions;
                        }
                      })() 
                      : suggestions
                    }
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center py-4">
              <Recorder
                onAudioEncoded={handleAudioEncoded}
                isProcessing={isProcessing}
              />
            </div>

            <TranscriptBox
              value={transcriptText}
              onChange={setTranscription}
              isProcessing={isProcessing}
              className="mt-4"
              autoProcess={handleProcessTranscription}
            />

            <div className="flex justify-center pt-2">
              <button
                onClick={handleProcessTranscription}
                disabled={
                  isProcessing || !transcriptText.trim() || !isConnected
                }
                className={`px-4 py-2 rounded-md text-white font-medium 
                  ${
                    isProcessing || !transcriptText.trim() || !isConnected
                      ? 'bg-primary/40 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
              >
                Process Transcription
              </button>
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
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
              {formKey.toUpperCase()} Form
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
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-end space-x-4 p-6 pt-0">
            <Button 
              variant="outline" 
              onClick={handleFormReset}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
            <Button 
              onClick={handleFormSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default FormPage;
