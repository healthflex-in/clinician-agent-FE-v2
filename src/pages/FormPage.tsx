
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
import PhysioFormRenderer from '@/components/forms/PhysioFormRenderer';
import { TestValue, AgentReport } from '@/types/form';
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
  const [formData, setFormData] = useState<TestValue[]>([{ 
    testName: '',
    unitName: '',
    value: '',
    rightValue: '',
    leftValue: '',
    comments: ''
  }]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientName, setPatientName] = useState<string>('Patient');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const { toast } = useToast();
  
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
              
              // Also set form data if it exists
              if (formKey === 'physio' && parsedReport.physio) {
                setFormData(Array.isArray(parsedReport.physio) ? parsedReport.physio : []);
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
          if (formKey === 'physio' && result.createAgentReport.physio) {
            setFormData(Array.isArray(result.createAgentReport.physio) ? 
              result.createAgentReport.physio : 
              [result.createAgentReport.physio]
            );
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
      // Handle structured data format with multiple assessments
      if (data.assessment1 || data.assessment2 || data.assessment3) {
        // Count how many assessments we have
        let assessmentsCount = 0;
        const hasAssessment1 = !!data.assessment1;
        const hasAssessment2 = !!data.assessment2;
        const hasAssessment3 = !!data.assessment3;
        
        if (hasAssessment1) assessmentsCount++;
        if (hasAssessment2) assessmentsCount++;
        if (hasAssessment3) assessmentsCount++;
        
        // Create new form data array
        const newFormData: TestValue[] = [...formData];
        
        // If we have selected sections, only update those
        const sectionsToUpdate = selectedSections.length > 0 
          ? selectedSections 
          : currentSectionId 
            ? [currentSectionId] 
            : [];
            
        // Figure out which assessments to update
        if (sectionsToUpdate.length > 0) {
          // Update only selected sections
          sectionsToUpdate.forEach(sectionId => {
            const index = parseInt(sectionId.split('-').pop() || '0', 10);
            let assessmentData = null;
            
            // Match section index to assessment data
            if (index === 0 && hasAssessment1) {
              assessmentData = data.assessment1;
            } else if (index === 1 && hasAssessment2) {
              assessmentData = data.assessment2;
            } else if (index === 2 && hasAssessment3) {
              assessmentData = data.assessment3;
            }
            
            // Update if we have data
            if (assessmentData && newFormData[index]) {
              newFormData[index] = {
                testName: assessmentData.Test_Name || '',
                unitName: assessmentData.Unit_Name || '',
                value: assessmentData.Value || '',
                rightValue: assessmentData.Right_Value || '',
                leftValue: assessmentData.Left_Value || '',
                comments: assessmentData.comments || ''
              };
            }
          });
        } else {
          // No sections selected, update all data
          // Ensure we have enough items in the array
          while (newFormData.length < assessmentsCount) {
            newFormData.push({
              testName: '',
              unitName: '',
              value: '',
              rightValue: '',
              leftValue: '',
              comments: ''
            });
          }
          
          // Update assessment 1
          if (hasAssessment1) {
            newFormData[0] = {
              testName: data.assessment1.Test_Name || '',
              unitName: data.assessment1.Unit_Name || '',
              value: data.assessment1.Value || '',
              rightValue: data.assessment1.Right_Value || '',
              leftValue: data.assessment1.Left_Value || '',
              comments: data.assessment1.comments || ''
            };
          }
          
          // Update assessment 2
          if (hasAssessment2 && newFormData.length >= 2) {
            newFormData[1] = {
              testName: data.assessment2.Test_Name || '',
              unitName: data.assessment2.Unit_Name || '',
              value: data.assessment2.Value || '',
              rightValue: data.assessment2.Right_Value || '',
              leftValue: data.assessment2.Left_Value || '',
              comments: data.assessment2.comments || ''
            };
          }
          
          // Update assessment 3
          if (hasAssessment3 && newFormData.length >= 3) {
            newFormData[2] = {
              testName: data.assessment3.Test_Name || '',
              unitName: data.assessment3.Unit_Name || '',
              value: data.assessment3.Value || '',
              rightValue: data.assessment3.Right_Value || '',
              leftValue: data.assessment3.Left_Value || '',
              comments: data.assessment3.comments || ''
            };
          }
        }
        
        // Update form data
        setFormData(newFormData);
        
        // Save to localStorage
        updateLocalStorage(newFormData);
        
        toast({
          title: "Form Updated",
          description: "Form data has been processed and updated",
        });
        
      } else if (Array.isArray(data)) {
        // Handle array format
        setFormData(data);
        updateLocalStorage(data);
        
      } else if (data.testName || data.Test_Name) {
        // Handle single assessment format
        const singleTest: TestValue = {
          testName: data.testName || data.Test_Name || '',
          unitName: data.unitName || data.Unit_Name || '',
          value: data.value || data.Value || '',
          rightValue: data.rightValue || data.Right_Value || '',
          leftValue: data.leftValue || data.Left_Value || '',
          comments: data.comments || data.comments || ''
        };
        
        // Update only the current section if one is set
        if (currentSectionId) {
          const index = parseInt(currentSectionId.split('-').pop() || '0', 10);
          const newFormData = [...formData];
          if (newFormData[index]) {
            newFormData[index] = singleTest;
            setFormData(newFormData);
            updateLocalStorage(newFormData);
          }
        } else if (selectedSections.length > 0) {
          // Update only selected sections
          const newFormData = [...formData];
          selectedSections.forEach(sectionId => {
            const index = parseInt(sectionId.split('-').pop() || '0', 10);
            if (newFormData[index]) {
              newFormData[index] = singleTest;
            }
          });
          setFormData(newFormData);
          updateLocalStorage(newFormData);
        } else {
          // No specific section, replace first item
          const newFormData = [singleTest, ...formData.slice(1)];
          setFormData(newFormData);
          updateLocalStorage(newFormData);
        }
      }
    } catch (error) {
      console.error('Error processing form data:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process form data",
        variant: "destructive",
      });
    }
  }, [formData, toast, selectedSections, currentSectionId]);

  // Save updated form data to localStorage
  const updateLocalStorage = (newFormData: TestValue[]) => {
    try {
      const savedReport = localStorage.getItem('agentReport');
      if (savedReport) {
        const reportData = JSON.parse(savedReport) as AgentReport;
        reportData.physio = newFormData;
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

    // Prepare data for each assessment
    const physioFormData: any = {};
    formData.forEach((form, index) => {
      const assessmentKey = `assessment${index + 1}`;
      physioFormData[assessmentKey] = {
        Test_Name: form.testName,
        Unit_Name: form.unitName,
        Value: form.value,
        Right_Value: form.rightValue,
        Left_Value: form.leftValue,
        comments: form.comments,
      };
    });

    // Send audio with current form data
    const sent = sendAudio(base64Audio, physioFormData);
    
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

    // Get the section index
    const index = parseInt(sectionId.split('-').pop() || '0', 10);
    setCurrentSectionId(sectionId);
    
    // Prepare data for this specific section
    const physioFormData: any = {};
    if (formData[index]) {
      const assessmentKey = `assessment${index + 1}`;
      physioFormData[assessmentKey] = {
        Test_Name: formData[index].testName,
        Unit_Name: formData[index].unitName,
        Value: formData[index].value,
        Right_Value: formData[index].rightValue,
        Left_Value: formData[index].leftValue,
        comments: formData[index].comments,
      };
    }

    // Send audio with section form data
    const sent = sendAudio(base64Audio, physioFormData);
    
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
    const physioFormData: any = {};
    
    if (selectedSections.length > 0) {
      // Only include selected sections
      selectedSections.forEach(sectionId => {
        const index = parseInt(sectionId.split('-').pop() || '0', 10);
        if (formData[index]) {
          const assessmentKey = `assessment${index + 1}`;
          physioFormData[assessmentKey] = {
            Test_Name: formData[index].testName,
            Unit_Name: formData[index].unitName,
            Value: formData[index].value,
            Right_Value: formData[index].rightValue,
            Left_Value: formData[index].leftValue,
            comments: formData[index].comments,
          };
        }
      });
    } else {
      // Include all form data
      formData.forEach((form, index) => {
        const assessmentKey = `assessment${index + 1}`;
        physioFormData[assessmentKey] = {
          Test_Name: form.testName,
          Unit_Name: form.unitName,
          Value: form.value,
          Right_Value: form.rightValue,
          Left_Value: form.leftValue,
          comments: form.comments,
        };
      });
    }

    // Send transcription with form data
    const sent = processTranscription(transcriptText, physioFormData);
    
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
    
    // Get the section index
    const index = parseInt(sectionId.split('-').pop() || '0', 10);
    setCurrentSectionId(sectionId);
    
    // Prepare data for this specific section
    const physioFormData: any = {};
    if (formData[index]) {
      const assessmentKey = `assessment${index + 1}`;
      physioFormData[assessmentKey] = {
        Test_Name: formData[index].testName,
        Unit_Name: formData[index].unitName,
        Value: formData[index].value,
        Right_Value: formData[index].rightValue,
        Left_Value: formData[index].leftValue,
        comments: formData[index].comments,
      };
    }

    // Send transcription with section form data
    const sent = processTranscription(text, physioFormData);
    
    if (!sent) {
      toast({
        title: 'Failed to process transcription',
        description: 'Connection issues detected',
        variant: 'destructive',
      });
    }
  };

  // Handle form data changes
  const handleFormChange = (newFormData: TestValue[]) => {
    setFormData(newFormData);
    updateLocalStorage(newFormData);
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
  const handleSectionSubmit = (sectionId: string) => {
    if (!reportId) {
      toast({
        title: "Missing Information",
        description: "Report ID is missing",
        variant: "destructive"
      });
      return;
    }

    const sectionIndex = parseInt(sectionId.split('-').pop() || '0', 10);
    if (sectionIndex < 0 || sectionIndex >= formData.length) {
      toast({
        title: "Invalid Section",
        description: "Cannot find the section to submit",
        variant: "destructive"
      });
      return;
    }
    
    // Only submit this specific section
    const sectionData = formData[sectionIndex];
    if (!sectionData.testName.trim()) {
      toast({
        title: "Missing Data",
        description: "Please fill in the test name before submitting",
        variant: "destructive" // Changed from "warning" to "destructive" to fix type error
      });
      return;
    }
    
    toast({
      title: "Section Submitted",
      description: `Assessment ${sectionIndex + 1} has been saved`,
    });
  };

  // Handle section reset
  const handleSectionReset = (sectionId: string) => {
    if (confirm("Are you sure you want to reset this section? All your data will be lost.")) {
      const sectionIndex = parseInt(sectionId.split('-').pop() || '0', 10);
      if (sectionIndex < 0 || sectionIndex >= formData.length) return;
      
      const newFormData = [...formData];
      newFormData[sectionIndex] = {
        testName: '',
        unitName: '',
        value: '',
        rightValue: '',
        leftValue: '',
        comments: ''
      };
      
      setFormData(newFormData);
      updateLocalStorage(newFormData);
      
      toast({
        title: "Section Reset",
        description: `Assessment ${sectionIndex + 1} has been reset`,
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
            physio {
              testName
              unitName
              value
              rightValue
              leftValue
              comments
            }
          }
        }
      `;
      
      // Filter out empty tests
      const filteredData = formData.filter(test => test.testName.trim() !== '');
      
      const input: any = {
        physio: filteredData,
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
            const reportData = JSON.parse(savedReport) as AgentReport;
            
            reportData.physio = filteredData;
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
      // Reset to a single empty test
      const initialData = [{
        testName: '',
        unitName: '',
        value: '',
        rightValue: '',
        leftValue: '',
        comments: ''
      }];
      
      setFormData(initialData);
      setTranscriptText('');
      setSelectedSections([]);
      setCurrentSectionId(null);
      updateLocalStorage(initialData);
      
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
                {formKey.toUpperCase()} - {patientName || 'Patient'}
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
                {formKey.toUpperCase()} Form
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <div className="pb-6">
                <PhysioFormRenderer
                  formData={formData}
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

export default FormPage;
