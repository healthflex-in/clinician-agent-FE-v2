
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
import { AlertCircle, WifiOff } from 'lucide-react';
import FormRenderer, { FormRendererRef } from '@/components/FormRenderer';
import formSchemas from '@/schemas/formSchemas';

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
  const { toast } = useToast();

  // Initialize form schema based on formKey
  const schema =
    formSchemas[formKey as keyof typeof formSchemas] || formSchemas.snc;

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
        if (parsedReport.formKey === formKey) {
          setFormData(parsedReport.formData || {});
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

    // Save to localStorage
    const reportData = {
      formKey,
      patientId,
      appointmentId,
      formData: newFormData,
    };
    localStorage.setItem('agentReport', JSON.stringify(reportData));
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
                  <div className="text-sm whitespace-pre-wrap">
                    {suggestions}
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
        </Card>
      </div>
    </div>
  );
};

export default FormPage;
