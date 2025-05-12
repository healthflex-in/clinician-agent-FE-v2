
import React, { useEffect, useState } from 'react';
import Recorder from '@/components/Recorder';
import TranscriptBox from '@/components/TranscriptBox';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, WifiOff } from 'lucide-react';

const Index = () => {
  const [transcriptText, setTranscriptText] = useState('');
  const { toast } = useToast();
  
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
    setSuggestions
  } = useWebSocket({
    // Use the original URL approach that worked in the first version
    url: `${window.location.origin.replace(/^http/, 'ws')}/ws`,
    onOpen: () => {
      toast({
        title: "Connected",
        description: "Ready to transcribe audio",
      });
    },
    onClose: () => {
      toast({
        title: "Disconnected",
        description: "WebSocket connection closed",
        variant: "destructive",
      });
    },
    onError: () => {
      toast({
        title: "Connection Error",
        description: "Failed to connect to transcription service",
        variant: "destructive",
      });
    }
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
        title: "Not connected",
        description: "Attempting to reconnect...",
        variant: "destructive",
      });
      connect();
      return;
    }

    const sent = sendAudio(base64Audio);
    if (!sent) {
      toast({
        title: "Failed to send audio",
        description: "Connection issues detected",
        variant: "destructive",
      });
    }
  };

  const handleProcessTranscription = () => {
    if (!transcriptText.trim()) {
      toast({
        title: "Empty transcription",
        description: "Please record audio or enter text to process",
        variant: "destructive",
      });
      return;
    }

    const sent = processTranscription(transcriptText);
    if (!sent) {
      toast({
        title: "Failed to process transcription",
        description: "Connection issues detected",
        variant: "destructive",
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-parrot-100 to-white">
      <Card className="w-full max-w-md shadow-lg border-parrot-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-parrot-800">
            Voice Recorder
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {!isConnected && !isConnecting && (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <WifiOff className="h-4 w-4" />
              <AlertTitle>WebSocket Disconnected</AlertTitle>
              <AlertDescription>
                Cannot connect to the transcription service. Please check your network connection.
              </AlertDescription>
            </Alert>
          )}
        
          {suggestions && (
            <Alert variant="default" className="bg-slate-900 text-white border-slate-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Suggestions</AlertTitle>
              <AlertDescription>
                <div className="text-sm whitespace-pre-wrap">{suggestions}</div>
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
          />
          
          <div className="flex justify-center pt-2">
            <button 
              onClick={handleProcessTranscription}
              disabled={isProcessing || !transcriptText.trim() || !isConnected}
              className={`px-4 py-2 rounded-md text-white font-medium 
                ${isProcessing || !transcriptText.trim() || !isConnected
                  ? 'bg-parrot-400 cursor-not-allowed' 
                  : 'bg-parrot-600 hover:bg-parrot-700'}`}
            >
              Process Transcription
            </button>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center pt-0 pb-4">
          <div className="text-sm text-center text-muted-foreground">
            {isConnecting && "Connecting to transcription service..."}
            {error && "Connection error. Please try again."}
            {!isConnecting && isConnected && !isProcessing && "Ready to record"}
            {!isConnecting && isConnected && isProcessing && "Processing audio..."}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Index;
