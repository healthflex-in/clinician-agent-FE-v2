import React from 'react';

import { useToast } from '@/hooks/use-toast';

export type MicrophonePermissionState = 'checking' | 'granted' | 'denied' | 'prompt';

type UseMicrophonePermissionReturn = {
  permissionError: string;
  showPermissionDialog: boolean;
  microphonePermission: MicrophonePermissionState;

  handleRequestPermission: () => Promise<void>;
  setShowPermissionDialog: (show: boolean) => void;
}

export const useMicrophonePermission = (): UseMicrophonePermissionReturn => {
  const { toast } = useToast();

  const [permissionError, setPermissionError] = React.useState<string>('');
  const [showPermissionDialog, setShowPermissionDialog] = React.useState(false);
  const [microphonePermission, setMicrophonePermission] = React.useState<MicrophonePermissionState>('checking');

  // Check microphone permission on mount
  React.useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        // Check if navigator.mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMicrophonePermission('denied');
          setPermissionError('Microphone access is not supported in this browser');
          setShowPermissionDialog(true);
          return;
        }

        // Check current permission state using the Permissions API
        try {
          const permissionStatus = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });

          if (permissionStatus.state === 'granted') {
            // Permission already granted, try to get media stream to confirm
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach((track) => track.stop()); // Clean up immediately
              setMicrophonePermission('granted');
              setShowPermissionDialog(false);
              return;
            } catch (error) {
              console.warn('Permission granted but unable to access microphone:', error);
              // Fall through to prompt for permission
            }
          } else if (permissionStatus.state === 'denied') {
            setMicrophonePermission('denied');
            setPermissionError('Microphone access was previously denied. Please enable it in your browser settings.');
            setShowPermissionDialog(true);
            return;
          }
          // If state is 'prompt', we'll show the permission dialog
        } catch (permissionError) {
          console.warn('Permissions API not supported or failed:', permissionError);
          // Fall through to manual check
        }

        // Fallback: Try to access media without requesting permission first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setMicrophonePermission('granted');
          setShowPermissionDialog(false);
        } catch (error) {
          // Permission not granted or microphone not available
          setMicrophonePermission('prompt');
          setShowPermissionDialog(true);
        }
      } catch (error) {
        console.error('Error checking microphone availability:', error);
        setMicrophonePermission('prompt');
        setShowPermissionDialog(true);
      }
    };

    checkMicrophonePermission();
  }, []);

  const handleRequestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophonePermission('granted');
      setShowPermissionDialog(false);
      setPermissionError('');

      toast({
        title: 'Permission Granted',
        description: 'Microphone access granted successfully',
      });
    } catch (error) {
      console.error('Permission request failed:', error);
      setMicrophonePermission('denied');

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionError('Microphone access was denied. Voice recording features will be disabled.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setPermissionError('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setPermissionError('Microphone is already in use by another application.');
        } else {
          setPermissionError('Unable to access microphone. Please check your browser settings.');
        }
      } else {
        setPermissionError('Unable to access microphone. Please check your browser settings.');
      }

      toast({
        title: 'Permission Denied',
        description: 'Microphone access is required for voice recording features',
        variant: 'destructive',
      });
    }
  };

  return {
    permissionError,
    microphonePermission,
    showPermissionDialog,
    setShowPermissionDialog,
    handleRequestPermission,
  };
};
