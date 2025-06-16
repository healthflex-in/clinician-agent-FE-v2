import React from 'react';
import { Mic } from 'lucide-react';

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MicrophonePermissionState } from '@/hooks';

interface MicrophonePermissionDialogProps {
  open: boolean;
  permissionError: string;
  microphonePermission: MicrophonePermissionState;

  onOpenChange: (open: boolean) => void;
  onRequestPermission: () => Promise<void>;
}

export const MicrophonePermissionDialog: React.FC<MicrophonePermissionDialogProps> = ({
  open,
  onOpenChange,
  onRequestPermission,
  microphonePermission,
}) => {
  const { toast } = useToast();

  const handleClose = (shouldClose: boolean) => {
    // Only allow closing if permission is granted or denied, not if it's still prompt
    if (!shouldClose && microphonePermission !== 'prompt') {
      onOpenChange(false);
    }
  };

  const handleBrowserSettings = () => {
    toast({
      title: 'Enable Microphone',
      description: 'Please check your browser settings to enable microphone access, then refresh the page.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Microphone Access Required
          </DialogTitle>
          <DialogDescription>
            {microphonePermission === 'denied'
              ? 'Microphone access was denied. Please enable it in your browser settings to use voice recording features.'
              : 'This application needs access to your microphone to provide voice recording and transcription features. Please allow microphone access when prompted by your browser.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {microphonePermission === 'denied' ? (
            <Button
              onClick={handleBrowserSettings}
              className="w-full sm:w-auto"
              variant="outline"
            >
              Check Browser Settings
            </Button>
          ) : (
            <Button
              onClick={onRequestPermission}
              className="w-full sm:w-auto"
            >
              Allow Microphone Access
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
