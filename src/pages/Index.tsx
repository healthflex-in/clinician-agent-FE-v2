
import React, { useEffect, useState } from 'react';
import Recorder from '@/components/Recorder';
import TranscriptBox from '@/components/TranscriptBox';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

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
    transcription,
    setTranscription
  } = useWebSocket({
    url: "ws://localhost:8080/ws",
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
  }, [connect]);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-parrot-100 to-white">
      <Card className="w-full max-w-md shadow-lg border-parrot-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-parrot-800">
            Voice Recorder
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
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
