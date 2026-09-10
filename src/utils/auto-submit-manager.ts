import React from 'react';
import { submitFormData } from './form-submission';

export interface AutoSubmitManagerProps {
  autoSubmitOnLLMUpdate: boolean;
  autoSubmitDelay: number;
  isInitialized: boolean;
  state: any;
  appointmentId: string;
  formKey?: string;
  toast: any;
  setIsSubmitting: (loading: boolean) => void;
  onChange?: (data: any) => void;
}

export const useAutoSubmitManager = (props: AutoSubmitManagerProps) => {
  const latest = React.useRef(props);
  latest.current = props;
  const mounted = React.useRef(true);
  const generation = React.useRef(0);
  const inFlight = React.useRef<Promise<unknown> | null>(null);
  const [pendingAutoSubmit, setPendingAutoSubmit] = React.useState(false);
  const autoSubmitTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLLMUpdateRef = React.useRef(0);
  const isLLMUpdateInProgress = React.useRef(false);

  const cancelAutoSubmit = React.useCallback(() => {
    generation.current += 1;
    if (autoSubmitTimeoutRef.current !== null) {
      clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
    isLLMUpdateInProgress.current = false;
    if (mounted.current) setPendingAutoSubmit(false);
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAutoSubmit();
    };
  }, [cancelAutoSubmit]);

  React.useEffect(() => {
    cancelAutoSubmit();
  }, [props.appointmentId, props.formKey, props.autoSubmitOnLLMUpdate, props.isInitialized, cancelAutoSubmit]);

  const triggerAutoSubmit = React.useCallback(() => {
    cancelAutoSubmit();
    const config = latest.current;
    if (!config.autoSubmitOnLLMUpdate || !config.isInitialized || !config.appointmentId) return;

    const scheduledGeneration = generation.current;
    lastLLMUpdateRef.current = Date.now();
    isLLMUpdateInProgress.current = true;
    setPendingAutoSubmit(true);
    autoSubmitTimeoutRef.current = setTimeout(async () => {
      autoSubmitTimeoutRef.current = null;
      // Serialize automatic saves; read current form values after waiting.
      if (inFlight.current) await inFlight.current;
      if (!mounted.current || generation.current !== scheduledGeneration) return;
      const current = latest.current;
      const save = submitFormData({
        state: current.state,
        appointmentId: current.appointmentId,
        formKey: current.formKey,
        isAutoSubmit: true,
        toast: (...args: any[]) => {
          if (mounted.current && latest.current.appointmentId === current.appointmentId) current.toast(...args);
        },
        setIsSubmitting: (loading) => {
          if (mounted.current && latest.current.appointmentId === current.appointmentId) current.setIsSubmitting(loading);
        },
      }).catch(() => false);
      inFlight.current = save;
      try {
        await save;
      } finally {
        if (inFlight.current === save) inFlight.current = null;
        if (mounted.current && generation.current === scheduledGeneration) {
          isLLMUpdateInProgress.current = false;
          setPendingAutoSubmit(false);
        }
      }
    }, Math.max(0, config.autoSubmitDelay));
  }, [cancelAutoSubmit]);

  const handleUserChange = React.useCallback((
    path: string,
    value: any,
    originalHandleChange: (path: string, value: any) => void,
  ) => {
    cancelAutoSubmit();
    originalHandleChange(path, value);
  }, [cancelAutoSubmit]);

  return {
    pendingAutoSubmit,
    triggerAutoSubmit,
    cancelAutoSubmit,
    handleUserChange,
    autoSubmitDelay: props.autoSubmitDelay,
    isLLMUpdateInProgress,
    lastLLMUpdateRef,
    autoSubmitTimeoutRef,
  };
};
