
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AudioRecorder from '@/components/audio/AudioRecorder';
import TranscriptionBox from '@/components/audio/TranscriptionBox';
import SuggestionBox from '@/components/ui/suggestion-box';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { graphqlRequest } from '@/utils/graphqlClient';
import AssessmentForm from '@/components/forms/AssessmentForm';
import { ThemeProvider } from '@/styles/theme-provider';

interface SetType {
  repetitions: string;
  load: string;
  unit: string;
}

interface DurationType {
  value: string;
  unit: string;
}

interface PlanType {
  exercise: string;
  comments: string;
  set: SetType;
  duration: DurationType;
}

interface PlanSectionType {
  advice: string;
  record: string;
  plans: PlanType[];
}

interface SubjectiveAssessmentType {
  assessment: string;
  record: string;
}

interface ObjectiveTestType {
  testName: string;
  unitName: string;
  value: string;
  left: string;
  right: string;
  comments: string;
}

interface ObjectiveAssessmentType {
  record: string;
  tests: ObjectiveTestType[];
}

interface RpeType {
  value: string;
  record: string;
}

interface AssessmentType {
  plan: PlanSectionType;
  subjectiveAssessment: SubjectiveAssessmentType;
  objectiveAssessment: ObjectiveAssessmentType;
  rpe: RpeType;
}

interface AgentReportType {
  _id?: string;
  assessment?: AssessmentType;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  isActive?: boolean;
  isFilledCompletely?: boolean;
}

type AssessmentPageParams = {
  patientId?: string;
  appointmentId?: string;
};

const AssessmentPage = () => {
  const { patientId, appointmentId } = useParams<AssessmentPageParams>();
  
  const [transcriptText, setTranscriptText] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientName, setPatientName] = useState<string>('Patient');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Initial assessment state
  const [assessment, setAssessment] = useState<AssessmentType>({
    plan: {
      advice: '',
      record: '',
      plans: [{
        exercise: '',
        comments: '',
        set: { repetitions: '', load: '', unit: '' },
        duration: { value: '', unit: '' }
      }]
    },
    subjectiveAssessment: {
      assessment: '',
      record: ''
    },
    objectiveAssessment: {
      record: '',
      tests: [{
        testName: '',
        unitName: '',
        value: '',
        left: '',
        right: '',
        comments: ''
      }]
    },
    rpe: {
      value: '',
      record: ''
    }
  });

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
            const parsedReport = JSON.parse(existingReport) as AgentReportType;
            if (parsedReport._id) {
              setReportId(parsedReport._id);
              
              // Also set assessment data if it exists
              if (parsedReport.assessment) {
                setAssessment(parsedReport.assessment);
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
              assessment {
                plan {
                  advice
                  record
                  plans {
                    exercise
                    comments
                    set {
                      repetitions
                      load
                      unit
                    }
                    duration {
                      value
                      unit
                    }
                  }
                }
                subjectiveAssessment {
                  assessment
                  record
                }
                objectiveAssessment {
                  record
                  tests {
                    testName
                    unitName
                    value
                    left
                    right
                    comments
                  }
                }
                rpe {
                  value
                  record
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
          if (result.createAgentReport.assessment) {
            setAssessment(result.createAgentReport.assessment);
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
  }, [patientId, appointmentId, toast]);

  // Store formKey, patientId and appointmentId in localStorage for WebSocket access
  useEffect(() => {
    localStorage.setItem('formKey', 'assessment');
    if (patientId) localStorage.setItem('userId', patientId);
    if (appointmentId) localStorage.setItem('appointmentId', appointmentId);
  }, [patientId, appointmentId]);

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
      // If we have selected sections, only update those
      const sectionsToUpdate = selectedSections.length > 0 
        ? selectedSections 
        : currentSectionId 
          ? [currentSectionId] 
          : [];
          
      // Update assessment based on sectionsToUpdate
      let updatedAssessment = {...assessment};
      
      if (sectionsToUpdate.length > 0) {
        // Only update selected sections
        sectionsToUpdate.forEach(sectionId => {
          const section = sectionId.split('.').pop() || '';
          
          if (data[section]) {
            // Use path to set nested values
            if (section === 'plan') {
              updatedAssessment.plan = {...updatedAssessment.plan, ...data.plan};
            } else if (section === 'subjectiveAssessment') {
              updatedAssessment.subjectiveAssessment = {...updatedAssessment.subjectiveAssessment, ...data.subjectiveAssessment};
            } else if (section === 'objectiveAssessment') {
              updatedAssessment.objectiveAssessment = {...updatedAssessment.objectiveAssessment, ...data.objectiveAssessment};
            } else if (section === 'rpe') {
              updatedAssessment.rpe = {...updatedAssessment.rpe, ...data.rpe};
            }
          }
        });
      } else {
        // No specific section selected, update all
        if (data.assessment) {
          // If we received a full assessment object
          updatedAssessment = {...updatedAssessment, ...data.assessment};
        } else {
          // If we received individual sections
          if (data.plan) updatedAssessment.plan = {...updatedAssessment.plan, ...data.plan};
          if (data.subjectiveAssessment) updatedAssessment.subjectiveAssessment = {...updatedAssessment.subjectiveAssessment, ...data.subjectiveAssessment};
          if (data.objectiveAssessment) updatedAssessment.objectiveAssessment = {...updatedAssessment.objectiveAssessment, ...data.objectiveAssessment};
          if (data.rpe) updatedAssessment.rpe = {...updatedAssessment.rpe, ...data.rpe};
        }
      }
      
      setAssessment(updatedAssessment);
      
      // Save to localStorage
      updateLocalStorage(updatedAssessment);
      
      toast({
        title: "Form Updated",
        description: "Form data has been processed and updated",
      });
      
    } catch (error) {
      console.error('Error processing form data:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process form data",
        variant: "destructive",
      });
    }
  }, [assessment, toast, selectedSections, currentSectionId]);

  // Save updated form data to localStorage
  const updateLocalStorage = (updatedAssessment: AssessmentType) => {
    try {
      const savedReport = localStorage.getItem('agentReport');
      if (savedReport) {
        const reportData = JSON.parse(savedReport) as AgentReportType;
        reportData.assessment = updatedAssessment;
        localStorage.setItem('agentReport', JSON.stringify(reportData));
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  };

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

    // Send audio with current form data
    const sent = sendAudio(base64Audio, assessment);
    
    if (!sent) {
      toast({
        title: 'Failed to send audio',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  // Handle section-specific audio recording
  const handleSectionAudioEncoded = (base64Audio: string, sectionId: string) => {
    if (!isConnected) {
      toast({
        title: 'Not connected',
        description: 'Attempting to reconnect...',
        variant: 'destructive',
      });
      connect();
      return;
    }

    setCurrentSectionId(sectionId);
    
    // Extract the section path
    const sectionPath = sectionId.split('.');
    const sectionName = sectionPath[sectionPath.length - 1];
    
    // Get the section data
    const sectionData: any = {};
    if (sectionName === 'plan') {
      sectionData.plan = assessment.plan;
    } else if (sectionName === 'subjectiveAssessment') {
      sectionData.subjectiveAssessment = assessment.subjectiveAssessment;
    } else if (sectionName === 'objectiveAssessment') {
      sectionData.objectiveAssessment = assessment.objectiveAssessment;
    } else if (sectionName === 'rpe') {
      sectionData.rpe = assessment.rpe;
    }

    // Send audio with section form data
    const sent = sendAudio(base64Audio, sectionData);
    
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

    // Prepare data based on selected sections or all data
    const formData: any = {};
    
    if (selectedSections.length > 0) {
      // Only include selected sections
      selectedSections.forEach(sectionId => {
        const sectionPath = sectionId.split('.');
        const sectionName = sectionPath[sectionPath.length - 1];
        
        if (sectionName === 'plan') {
          formData.plan = assessment.plan;
        } else if (sectionName === 'subjectiveAssessment') {
          formData.subjectiveAssessment = assessment.subjectiveAssessment;
        } else if (sectionName === 'objectiveAssessment') {
          formData.objectiveAssessment = assessment.objectiveAssessment;
        } else if (sectionName === 'rpe') {
          formData.rpe = assessment.rpe;
        }
      });
    } else {
      // Include all form data
      formData.assessment = assessment;
    }

    // Send transcription with form data
    const sent = processTranscription(transcriptText, formData);
    
    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  // Process section-specific transcription
  const handleSectionTranscriptProcess = (text: string, sectionId: string) => {
    if (!text.trim()) return;
    
    setCurrentSectionId(sectionId);
    
    // Extract the section path
    const sectionPath = sectionId.split('.');
    const sectionName = sectionPath[sectionPath.length - 1];
    
    // Get the section data
    const sectionData: any = {};
    if (sectionName === 'plan') {
      sectionData.plan = assessment.plan;
    } else if (sectionName === 'subjectiveAssessment') {
      sectionData.subjectiveAssessment = assessment.subjectiveAssessment;
    } else if (sectionName === 'objectiveAssessment') {
      sectionData.objectiveAssessment = assessment.objectiveAssessment;
    } else if (sectionName === 'rpe') {
      sectionData.rpe = assessment.rpe;
    }

    // Send transcription with section form data
    const sent = processTranscription(text, sectionData);
    
    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  // Handle form data changes
  const handleFormChange = (data: AssessmentType) => {
    setAssessment(data);
    updateLocalStorage(data);
  };

  // Handle section selection
  const handleSectionSelect = (sectionId: string, selected: boolean) => {
    if (selected) {
      setSelectedSections(prev => [...prev, sectionId]);
    } else {
      setSelectedSections(prev => prev.filter(id => id !== sectionId));
    }
  };

  // Handle section submission
  const handleSectionSubmit = async (sectionId: string) => {
    if (!reportId || !appointmentId) {
      toast({
        title: "Missing Information",
        description: "Report ID or Appointment ID is missing",
        variant: "destructive"
      });
      return;
    }
    
    // Extract the section path
    const sectionPath = sectionId.split('.');
    const sectionName = sectionPath[sectionPath.length - 1];
    
    // Section data to submit
    const input: any = {
      assessment: {}
    };
    
    // Add the specific section to the input
    if (sectionName === 'plan') {
      input.assessment.plan = assessment.plan;
    } else if (sectionName === 'subjectiveAssessment') {
      input.assessment.subjectiveAssessment = assessment.subjectiveAssessment;
    } else if (sectionName === 'objectiveAssessment') {
      input.assessment.objectiveAssessment = assessment.objectiveAssessment;
    } else if (sectionName === 'rpe') {
      input.assessment.rpe = assessment.rpe;
    }
    
    if (patientId) {
      input.userId = patientId;
    }
    
    const mutation = `
      mutation UpdateAgentReport($appointmentId: ObjectID!, $input: UpdateAgentReportInput!) {
        updateAgentReport(appointmentId: $appointmentId, input: $input) {
          _id
          updatedAt
        }
      }
    `;
    
    try {
      const result = await graphqlRequest(mutation, {
        appointmentId,
        input
      });
      
      if (result && result.updateAgentReport) {
        toast({
          title: "Section Submitted",
          description: `${sectionName} section has been saved`,
        });
      }
    } catch (error) {
      console.error('Error submitting section:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting this section",
        variant: "destructive"
      });
    }
  };

  // Handle section reset
  const handleSectionReset = (sectionId: string) => {
    if (confirm("Are you sure you want to reset this section? All your data will be lost.")) {
      // Extract the section path
      const sectionPath = sectionId.split('.');
      const sectionName = sectionPath[sectionPath.length - 1];
      
      // Create a new assessment with the reset section
      const updatedAssessment = {...assessment};
      
      if (sectionName === 'plan') {
        updatedAssessment.plan = {
          advice: '',
          record: '',
          plans: [{
            exercise: '',
            comments: '',
            set: { repetitions: '', load: '', unit: '' },
            duration: { value: '', unit: '' }
          }]
        };
      } else if (sectionName === 'subjectiveAssessment') {
        updatedAssessment.subjectiveAssessment = {
          assessment: '',
          record: ''
        };
      } else if (sectionName === 'objectiveAssessment') {
        updatedAssessment.objectiveAssessment = {
          record: '',
          tests: [{
            testName: '',
            unitName: '',
            value: '',
            left: '',
            right: '',
            comments: ''
          }]
        };
      } else if (sectionName === 'rpe') {
        updatedAssessment.rpe = {
          value: '',
          record: ''
        };
      }
      
      setAssessment(updatedAssessment);
      updateLocalStorage(updatedAssessment);
      
      toast({
        title: "Section Reset",
        description: `${sectionName} section has been reset`,
      });
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
            assessment {
              plan {
                advice
                record
                plans {
                  exercise
                  comments
                  set {
                    repetitions
                    load
                    unit
                  }
                  duration {
                    value
                    unit
                  }
                }
              }
              subjectiveAssessment {
                assessment
                record
              }
              objectiveAssessment {
                record
                tests {
                  testName
                  unitName
                  value
                  left
                  right
                  comments
                }
              }
              rpe {
                value
                record
              }
            }
          }
        }
      `;
      
      const input: any = {
        assessment: assessment
      };
      
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
            const reportData = JSON.parse(savedReport) as AgentReportType;
            
            reportData.assessment = assessment;
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
      // Reset to initial assessment
      const initialAssessment = {
        plan: {
          advice: '',
          record: '',
          plans: [{
            exercise: '',
            comments: '',
            set: { repetitions: '', load: '', unit: '' },
            duration: { value: '', unit: '' }
          }]
        },
        subjectiveAssessment: {
          assessment: '',
          record: ''
        },
        objectiveAssessment: {
          record: '',
          tests: [{
            testName: '',
            unitName: '',
            value: '',
            left: '',
            right: '',
            comments: ''
          }]
        },
        rpe: {
          value: '',
          record: ''
        }
      };
      
      setAssessment(initialAssessment);
      setTranscriptText('');
      setSelectedSections([]);
      setCurrentSectionId(null);
      updateLocalStorage(initialAssessment);
      
      toast({
        title: "Form Reset",
        description: "All form data has been reset",
      });
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col items-center p-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="w-full max-w-4xl space-y-6 pb-16">
          {/* Header with patient info */}
          <Card className="w-full bg-card">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-bold">
                Assessment - {patientName || 'Patient'}
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
                  label="Record for all sections"
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
          </Card>

          {/* Form section */}
          <Card className="w-full shadow-md">
            <CardHeader>
              <CardTitle className="text-center">
                Assessment Form
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <div className="pb-6">
                <AssessmentForm
                  formData={assessment}
                  onChange={handleFormChange}
                  onAudioEncoded={handleSectionAudioEncoded}
                  onTranscriptProcess={handleSectionTranscriptProcess}
                  isProcessing={isProcessing}
                  selectedSections={selectedSections}
                  onSectionSelect={handleSectionSelect}
                  onSubmit={handleFormSubmit}
                  onReset={handleFormReset}
                  onSectionSubmit={handleSectionSubmit}
                  onSectionReset={handleSectionReset}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default AssessmentPage;
