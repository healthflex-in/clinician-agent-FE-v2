import React from 'react';
import { ArrowRight, WifiOff, MicOff } from 'lucide-react';

import SuggestionBox from '@/components/ui/suggestion-box';
import AudioRecorder from '@/components/audio/audio-recorder';

type VoiceRecorderSectionProps = {
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
  const isProcessButtonDisabled =
    isProcessing ||
    !transcriptText.trim() ||
    !isConnected ||
    recordingMode === 'section' ||
    currentlyProcessingPath !== null ||
    microphonePermission !== 'granted';

  const statusColor = isConnected
    ? 'bg-stance-neon'
    : isConnecting
    ? 'bg-stance-neon/50 animate-pulse'
    : 'bg-red-400';

  const statusLabel = isConnected ? 'Live' : isConnecting ? 'Connecting' : 'Offline';

  return (
    <div className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stance-steel/35">
            Voice Recorder
          </span>
          {microphonePermission === 'denied' && (
            <span className="text-[10px] text-red-400 font-medium">(mic off)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-stance-steel/35">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Inline alerts */}
      {microphonePermission === 'denied' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
          <MicOff className="h-3.5 w-3.5 shrink-0 text-red-500" />
          Microphone disabled.{' '}
          <button className="underline font-medium" onClick={onShowPermissionDialog}>
            Try again
          </button>
        </div>
      )}
      {!isConnected && !isConnecting && microphonePermission === 'granted' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-red-500" />
          Cannot connect to transcription service.
        </div>
      )}

      {suggestions && (
        <SuggestionBox suggestions={suggestions} onClose={() => setSuggestions(null)} />
      )}

      {/* Compact horizontal recording strip */}
      <div className="flex items-center gap-2 bg-white/70 border border-stance-steel/8 rounded-2xl px-3 py-2.5 shadow-sm">
        {/* Mic button — hide AudioRecorder's status text below the button */}
        <div className="shrink-0 [&>div>div:last-child]:hidden">
          <AudioRecorder
            key={audioRecorderKey}
            size="sm"
            label=""
            onAudioEncoded={onAudioEncoded}
            isProcessing={isProcessing}
            isDisabled={isRecorderDisabled}
            onRecordingStart={onRecordingStart}
            onRecordingStop={onRecordingStop}
          />
        </div>

        {/* Inline transcription textarea */}
        {recordingMode !== 'section' && (
          <textarea
            value={transcriptText}
            onChange={(e) => onGlobalTranscriptionChange(e.target.value)}
            placeholder={
              globalRecordingState
                ? 'Recording in progress...'
                : 'Speak or type to fill the form...'
            }
            disabled={globalRecordingState}
            rows={2}
            className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-stance-steel/80 placeholder:text-stance-steel/25 min-h-0 leading-snug disabled:opacity-50"
          />
        )}

        {/* Process arrow button */}
        <button
          onClick={onProcessTranscription}
          disabled={isProcessButtonDisabled}
          title="Process transcription"
          className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            isProcessButtonDisabled
              ? 'bg-stance-steel/6 text-stance-steel/20 cursor-not-allowed'
              : 'bg-stance-steel text-white hover:bg-stance-steel/90 active:scale-95 shadow-sm ring-1 ring-stance-neon/30'
          }`}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
