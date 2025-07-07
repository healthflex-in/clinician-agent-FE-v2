import React from 'react';
import { submitFormData } from '../utils/form-submission';
import {
  useAutoSubmitManager,
  AutoSubmitManagerProps,
} from '../utils/auto-submit-manager';

export const useFormSubmitHandlers = (props: AutoSubmitManagerProps) => {
  const { state, appointmentId, toast, setIsSubmitting, onChange } = props;

  const autoSubmitManager = useAutoSubmitManager(props);

  // FORM INITIALIZATION STATE - FIX FOR PRE-FILLED DATA
  const [isStateUpdated, setIsStateUpdated] = React.useState(false);

  // Manual submit handler - REMOVED ALL VALIDATION
  const handleSubmitForm = React.useCallback(
    async (isAutoSubmit: boolean = false) => {
      console.log('=== handleSubmitForm called (NO VALIDATION) ===');
      console.log(
        '=== Form data at submission ===',
        JSON.stringify(state, null, 2)
      );

      // NO VALIDATION - just submit whatever data we have
      console.log(
        '=== Proceeding with form submission (no validation checks) ==='
      );

      try {
        console.log('=== Submitting form data without validation ===');

        const success = await submitFormData({
          state,
          appointmentId,
          isAutoSubmit,
          toast,
          setIsSubmitting,
        });

        if (success) {
          console.log('=== Form submission completed successfully ===');
        }
      } catch (error) {
        console.error('Error during form submission:', error);
      }
    },
    [state, appointmentId, toast, setIsSubmitting]
  );

  // Enhanced handleChange that can cancel auto-submit
  const handleUserChange = React.useCallback(
    (
      path: string,
      value: any,
      originalHandleChange: (path: string, value: any) => void
    ) => {
      return autoSubmitManager.handleUserChange(
        path,
        value,
        originalHandleChange
      );
    },
    [autoSubmitManager.handleUserChange]
  );

  // State update effect that triggers auto-submit
  React.useEffect(() => {
    if (isStateUpdated && !autoSubmitManager.isLLMUpdateInProgress.current) {
      console.log(
        '=== Triggering auto-submit after state update (no validation) ==='
      );
      autoSubmitManager.triggerAutoSubmit(); // Trigger auto-submit after state is updated
      setIsStateUpdated(false); // Reset state update flag
    }
  }, [isStateUpdated, autoSubmitManager.triggerAutoSubmit]);

  // Function to call when LLM updates form data
  const handleLLMUpdate = React.useCallback(
    (data: any) => {
      console.log('=== handleLLMUpdate called (no validation) ===');
      if (onChange) {
        onChange(data);
      }
      setIsStateUpdated(true);
    },
    [onChange]
  );

  return {
    // Submit handlers
    handleSubmitForm,
    handleUserChange,
    handleLLMUpdate,

    // Auto-submit state and controls
    pendingAutoSubmit: autoSubmitManager.pendingAutoSubmit,
    cancelAutoSubmit: autoSubmitManager.cancelAutoSubmit,
    autoSubmitDelay: autoSubmitManager.autoSubmitDelay,

    // Trigger function for manual auto-submit
    triggerAutoSubmit: autoSubmitManager.triggerAutoSubmit,

    // Internal state for debugging
    setIsStateUpdated,
  };
};
