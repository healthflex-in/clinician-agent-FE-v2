import { updateAgentReport } from '@/utils/api';

export interface SubmitFormParams {
  state: any;
  appointmentId: string;
  isAutoSubmit?: boolean;
  toast: any;
  setIsSubmitting: (loading: boolean) => void;
}

// Helper: Filter out empty/zero values recursively
const filterEmptyValues = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    const filteredArray = obj
      .map((item) => filterEmptyValues(item))
      .filter((item) => {
        if (item === null || item === undefined) return false;
        if (typeof item === 'string' && item.trim() === '') return false;
        if (typeof item === 'number' && item === 0) return false;
        if (typeof item === 'object' && Object.keys(item).length === 0)
          return false;
        return true;
      });

    return filteredArray.length > 0 ? filteredArray : null;
  }

  if (typeof obj === 'object') {
    const filteredObj: any = {};
    let hasValidValues = false;

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        // Skip 'record' fields completely
        if (key === 'record') continue;

        // Filter the value recursively
        const filteredValue = filterEmptyValues(value);

        // Only include if the filtered value is not empty
        if (filteredValue !== null && filteredValue !== undefined) {
          if (typeof filteredValue === 'string' && filteredValue.trim() === '')
            continue;
          if (typeof filteredValue === 'number' && filteredValue === 0)
            continue;
          if (Array.isArray(filteredValue) && filteredValue.length === 0)
            continue;
          if (
            typeof filteredValue === 'object' &&
            Object.keys(filteredValue).length === 0
          )
            continue;

          filteredObj[key] = filteredValue;
          hasValidValues = true;
        }
      }
    }

    return hasValidValues ? filteredObj : null;
  }

  // For primitive values
  if (typeof obj === 'string' && obj.trim() === '') return null;
  if (typeof obj === 'number' && obj === 0) return null;
  if (obj === false) return null; // Also filter out false boolean values if needed

  return obj;
};

// NO VALIDATION - Just filter and submit
export const submitFormData = async ({
  state,
  appointmentId,
  isAutoSubmit = false,
  toast,
  setIsSubmitting,
}: SubmitFormParams) => {
  console.log('=== submitFormData called (NO VALIDATION) ===', {
    isAutoSubmit,
  });
  console.log('=== Original form data ===', JSON.stringify(state, null, 2));

  try {
    setIsSubmitting(true);

    // Filter out empty/zero values
    const filteredState = filterEmptyValues(state);
    console.log(
      '=== Filtered form data (empty values removed) ===',
      JSON.stringify(filteredState, null, 2)
    );

    // If after filtering there's no data left, don't submit
    if (!filteredState || Object.keys(filteredState).length === 0) {
      console.log('=== No data to submit after filtering ===');
      toast({
        title: isAutoSubmit ? 'No data to auto-submit' : 'No data to submit',
        description: 'Form contains no meaningful data to save.',
        variant: 'default', // Changed from destructive since this is not an error
      });
      return false;
    }

    console.log('=== Submitting filtered data to server ===');

    // Call the API with filtered state
    const response = await updateAgentReport({
      appointmentId,
      input: filteredState,
    });

    console.log('=== Form submission successful ===', response);

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
