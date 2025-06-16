import React from 'react';
import { WifiOff, MicOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import SuggestionBox from '@/components/ui/suggestion-box';
import AudioRecorder from '@/components/audio/audio-recorder';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TranscriptionBox from '@/components/audio/transcription-box';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type VoiceRecorderSectionProps = {
  // Voice recorder states from hook
  suggestions: any;
  isConnected: boolean;
  isConnecting: boolean;
  isProcessing: boolean;
  transcriptText: string;
  audioRecorderKey: number;
  globalRecordingState: boolean;
  currentlyProcessingPath: string | null;
  recordingMode: 'idle' | 'global' | 'section';
  microphonePermission: 'checking' | 'granted' | 'denied' | 'prompt';
  
  // Voice recorder actions from hook
  onAutoProcess: () => void;
  onRecordingStop: () => void;
  onRecordingStart: () => void;
  onProcessTranscription: () => void;
  onShowPermissionDialog: () => void;
  setSuggestions: (suggestions: any) => void;
  onAudioEncoded: (base64Audio: string) => void;
  onGlobalTranscriptionChange: (text: string) => void;
}

export const VoiceRecorderSection: React.FC<VoiceRecorderSectionProps> = ({
  suggestions,
  isConnected,
  isConnecting,
  isProcessing,
  recordingMode,
  transcriptText,
  audioRecorderKey,
  microphonePermission,
  globalRecordingState,
  currentlyProcessingPath,
  onAutoProcess,
  setSuggestions,
  onAudioEncoded,
  onRecordingStop,
  onRecordingStart,
  onShowPermissionDialog,
  onProcessTranscription,
  onGlobalTranscriptionChange,
}) => {
  const isRecorderDisabled = microphonePermission !== 'granted' || !isConnected || isProcessing;
  const isProcessButtonDisabled = isProcessing || 
    !transcriptText.trim() || 
    !isConnected || 
    recordingMode === 'section' || 
    currentlyProcessingPath !== null || 
    microphonePermission !== 'granted';

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-1xl">
          Voice Recorder
          {microphonePermission === 'denied' && (
            <span className="ml-2 text-sm text-muted-foreground">(Disabled)</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-2 space-y-6">
        
        {/* Permission Error Alert */}
        {microphonePermission === 'denied' && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <MicOff className="h-4 w-4" />
            <AlertDescription>
              Microphone access is disabled. Voice recording features are not available.
              <Button
                variant="link"
                className="p-0 h-auto ml-2 text-destructive underline"
                onClick={onShowPermissionDialog}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Error Alert */}
        {!isConnected && !isConnecting && microphonePermission === 'granted' && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Cannot connect to the transcription service. Please check your network connection.
            </AlertDescription>
          </Alert>
        )}

        {/* Suggestions Box */}
        {suggestions && (
          <SuggestionBox
            suggestions={suggestions}
            onClose={() => setSuggestions(null)}
          />
        )}

        {/* Global Audio Recorder - Using your exact AudioRecorder component */}
        <div className="flex justify-center py-2">
          <AudioRecorder
            key={audioRecorderKey}
            onAudioEncoded={onAudioEncoded}
            isProcessing={isProcessing}
            label="Record for entire form"
            isDisabled={isRecorderDisabled}
            onRecordingStart={onRecordingStart}
            onRecordingStop={onRecordingStop}
          />
        </div>

        {/* Global Transcription Box - Only show when not in section mode */}
        {recordingMode !== 'section' && (
          <TranscriptionBox
            key={`global-transcription-${audioRecorderKey}`}
            value={transcriptText}
            onChange={onGlobalTranscriptionChange}
            isProcessing={isProcessing && recordingMode === 'global'}
            autoProcess={onAutoProcess}
            autoProcessDelay={5000}
            placeholder={
              globalRecordingState
                ? 'Recording in progress... Please wait.'
                : 'Speak or type to enter information globally...'
            }
            disabled={globalRecordingState}
            className={`mt-4 ${globalRecordingState ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        )}

        {/* Process Button */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={onProcessTranscription}
            disabled={isProcessButtonDisabled}
            variant={isProcessButtonDisabled ? 'outline' : 'default'}
            className="px-6"
          >
            {isProcessing && recordingMode === 'global' && !currentlyProcessingPath
              ? 'Processing Global...'
              : 'Process Global Transcription'}
          </Button>
        </div>

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
            <div>Recording Mode: {recordingMode}</div>
            <div>Processing Path: {currentlyProcessingPath || 'None'}</div>
            <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
            <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
            <div>Transcription Length: {transcriptText.length}</div>
          </div>
        )}
        
      </CardContent>
    </Card>
  );
};
