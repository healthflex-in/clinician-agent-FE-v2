import React from 'react';

import { RecordingMode } from '@/hooks';
import { FormRenderer } from '@/components/forms';
import { FormRendererRef } from '@/types/form-renderer.types';
import { isPlanPath, isTestPath } from '@/utils/form-renderer.utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type FormSectionProps = {
  schema: any;
  formData: any;
  formKey: string;
  patientId: string;
  patientName: string;
  isConnected: boolean;
  transcription: string;
  isProcessing: boolean;
  appointmentId: string;
  recordingMode: RecordingMode;
  activeSectionPath: string | null;
  currentlyProcessingPath: string | null;
  onFormChange: (newFormData: any) => void;
  recordingStates: { [path: string]: boolean };

  formRendererRef: React.RefObject<FormRendererRef>;

  onRecordingStop: (path?: string) => void;
  onRecordingStart: (path?: string) => void;
  onPlanTranscriptionClear: (planPath: string) => void;
  onSectionTranscriptionClear: (sectionPath: string) => void;
  onAudioRecorded: (base64Audio: string, context: any) => void;
  onTranscriptionProcess: (transcription: string, context: any) => void;

  // NEW: Auto-submit props
  autoSubmitOnLLMUpdate?: boolean;
  autoSubmitDelay?: number;
};

export const FormSection: React.FC<FormSectionProps> = ({
  formKey,
  schema,
  formData,
  patientName,
  isConnected,
  isProcessing,
  recordingMode,
  activeSectionPath,
  appointmentId,
  patientId,
  recordingStates,
  transcription,
  currentlyProcessingPath,
  onFormChange,
  onAudioRecorded,
  onTranscriptionProcess,
  onRecordingStart,
  onRecordingStop,
  onSectionTranscriptionClear,
  onPlanTranscriptionClear,
  formRendererRef,

  // NEW: Auto-submit props with defaults
  autoSubmitOnLLMUpdate = true,
  autoSubmitDelay = 3000,
}) => {
  // Update transcription when received from WebSocket
  React.useEffect(() => {
    if (!transcription) return;

    console.log('=== Transcription received ===');
    console.log('Transcription:', transcription);
    console.log('Currently processing path:', currentlyProcessingPath);

    // If we have a specific path being processed, ONLY route to that field
    if (currentlyProcessingPath && formRendererRef.current) {
      console.log(
        'ROUTING: Transcription to specific field:',
        currentlyProcessingPath
      );

      if (
        isPlanPath(currentlyProcessingPath, formKey) ||
        isTestPath(currentlyProcessingPath, formKey)
      ) {
        // Clear existing plan transcription before setting new one
        formRendererRef.current.clearPlanTranscription(currentlyProcessingPath);
        // Set new transcription
        formRendererRef.current.updatePlanTranscription(
          currentlyProcessingPath,
          transcription
        );
      } else {
        // Clear existing section transcription before setting new one
        formRendererRef.current.clearSectionTranscription(
          currentlyProcessingPath
        );
        // Set new transcription
        formRendererRef.current.updateSectionTranscription(
          currentlyProcessingPath,
          transcription
        );
      }

      return; // Don't continue to other routing
    }

    // Rest of the routing logic
    if (
      recordingMode === 'section' &&
      activeSectionPath &&
      formRendererRef.current
    ) {
      console.log(
        'ROUTING: Transcription to active section:',
        activeSectionPath
      );
      formRendererRef.current.updateSectionTranscription(
        activeSectionPath,
        transcription
      );
      return;
    }
  }, [
    transcription,
    recordingMode,
    activeSectionPath,
    currentlyProcessingPath,
    formKey,
  ]);

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-center">
          {formKey.charAt(0).toUpperCase() + formKey.slice(1)} Form -{' '}
          {patientName}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-2">
        <div className="pb-2">
          <FormRenderer
            schema={schema}
            formKey={formKey}
            formData={formData}
            ref={formRendererRef}
            patientId={patientId}
            isProcessing={isProcessing}
            recordingMode={recordingMode}
            appointmentId={appointmentId}
            recordingStates={recordingStates}
            isWebSocketConnected={isConnected}
            activeSectionPath={activeSectionPath}
            onChange={onFormChange}
            onLLMUpdate={onFormChange}
            onAudioRecorded={onAudioRecorded}
            onRecordingStop={onRecordingStop}
            onRecordingStart={onRecordingStart}
            onTranscriptionProcess={onTranscriptionProcess}
            onPlanTranscriptionClear={onPlanTranscriptionClear}
            onSectionTranscriptionClear={onSectionTranscriptionClear}
            autoSubmitOnLLMUpdate={autoSubmitOnLLMUpdate}
            autoSubmitDelay={autoSubmitDelay}
          />
        </div>
      </CardContent>
    </Card>
  );
};
