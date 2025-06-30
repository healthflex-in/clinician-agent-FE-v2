import React from 'react';
import { submitFormData, SubmitFormParams } from './form-submission';

export interface AutoSubmitManagerProps {
  autoSubmitOnLLMUpdate: boolean;
  autoSubmitDelay: number;
  isInitialized: boolean;
  state: any;
  appointmentId: string;
  toast: any;
  setIsSubmitting: (loading: boolean) => void;
  onChange?: (data: any) => void;
}

export const useAutoSubmitManager = ({
  autoSubmitOnLLMUpdate,
  autoSubmitDelay,
  isInitialized,
  state,
  appointmentId,
  toast,
  setIsSubmitting,
  onChange,
}: AutoSubmitManagerProps) => {
  // AUTO-SUBMIT STATE VARIABLES
  const [pendingAutoSubmit, setPendingAutoSubmit] = React.useState(false);
  const autoSubmitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastLLMUpdateRef = React.useRef<number>(0);
  const isLLMUpdateInProgress = React.useRef(false);
  const isAutoSubmittingRef = React.useRef(false);

  // CLEANUP TIMEOUT ON UNMOUNT
  React.useEffect(() => {
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, []);

  // REMOVED ALL VALIDATION - Auto-submit trigger function
  const triggerAutoSubmit = React.useCallback(() => {
    if (!autoSubmitOnLLMUpdate || !isInitialized) {
      console.log(
        '=== Auto-submit skipped - not enabled or not initialized ==='
      );
      return;
    }

    console.log('=== triggerAutoSubmit called (NO VALIDATION) ===');
    console.log(
      '=== Current state for auto-submit ===',
      JSON.stringify(state, null, 2)
    );

    // NO VALIDATION - just proceed with auto-submit
    console.log('=== Proceeding with auto-submit (no validation checks) ===');

    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }

    lastLLMUpdateRef.current = Date.now();
    isLLMUpdateInProgress.current = true;
    setPendingAutoSubmit(true);

    // Proceed with the auto-submit process
    setTimeout(async () => {
      console.log('=== Auto-submit timeout executed ===');

      try {
        if (onChange) {
          console.log('=== Calling onChange with current state ===');
          onChange(state); // Ensure latest state is passed to parent
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log(
          '=== Calling submitFormData (auto-submit, no validation) ==='
        );
        const success = await submitFormData({
          state,
          appointmentId,
          isAutoSubmit: true,
          toast,
          setIsSubmitting,
        });

        if (success) {
          console.log('=== Auto-submit completed successfully ===');
        }
      } catch (error) {
        console.error('=== Auto-submit failed ===', error);
      } finally {
        setPendingAutoSubmit(false);
        isLLMUpdateInProgress.current = false;
        autoSubmitTimeoutRef.current = null;
      }
    }, 500); // Reduced delay to ensure state is propagated before submission

    console.log(
      `=== Auto-submit scheduled for 500ms delay (no validation) ===`
    );
  }, [
    autoSubmitOnLLMUpdate,
    isInitialized,
    onChange,
    state,
    appointmentId,
    toast,
    setIsSubmitting,
    autoSubmitDelay,
  ]);

  // CANCEL AUTO-SUBMIT ON USER INTERACTION
  const cancelAutoSubmit = React.useCallback(() => {
    console.log('=== Auto-submit cancelled by user ===');
    setPendingAutoSubmit(false);
    isLLMUpdateInProgress.current = false;
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
  }, []);

  const handleUserChange = React.useCallback(
    (
      path: string,
      value: any,
      originalHandleChange: (path: string, value: any) => void
    ) => {
      // Call original handleChange
      originalHandleChange(path, value);

      // Cancel pending auto-submit if user makes changes after LLM update
      const timeSinceLastLLMUpdate = Date.now() - lastLLMUpdateRef.current;
      if (
        pendingAutoSubmit &&
        timeSinceLastLLMUpdate < autoSubmitDelay + 1000
      ) {
        console.log('=== Canceling auto-submit due to user interaction ===');
        cancelAutoSubmit();
      }
    },
    [pendingAutoSubmit, autoSubmitDelay, cancelAutoSubmit]
  );

  return {
    pendingAutoSubmit,
    triggerAutoSubmit,
    cancelAutoSubmit,
    handleUserChange,
    autoSubmitDelay,
    isLLMUpdateInProgress,
    lastLLMUpdateRef,
    autoSubmitTimeoutRef,
  };
};
