import { updateAgentReport } from '@/utils/api';

export interface SubmitFormParams {
  state: any;
  appointmentId: string;
  isAutoSubmit?: boolean;
  formKey?: string;
  toast: any;
  setIsSubmitting: (loading: boolean) => void;
}

export const submitFormData = async ({
  state,
  appointmentId,
  isAutoSubmit = false,
  formKey = localStorage.getItem("formKey") || "assessment",
  toast,
  setIsSubmitting,
}: SubmitFormParams) => {
  try {
    setIsSubmitting(true);
    if (!state || typeof state !== 'object') throw new Error('No form to save');
    await updateAgentReport({
      appointmentId,
      formKey,
      input: state,
    });


    toast({
      title: isAutoSubmit
        ? 'Auto-submitted successfully!'
        : 'Form submitted successfully!',
      description: 'Your form data has been saved.',
    });

    return true;
  } catch (error) {
    console.error('=== Form submission failed ===', error);
    toast({
      title: 'Submission failed',
      description: 'There was an error submitting the form.',
      variant: 'destructive',
    });
    return false;
  } finally {
    setIsSubmitting(false);
  }
};
