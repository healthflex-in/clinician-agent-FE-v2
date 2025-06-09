// utils/FormRenderer.utils.ts
import { FORM_SECTIONS } from '../constants/FormRenderer.constants';

// Check if a path represents a plan item that should have audio recording
export const isPlanPath = (path: string, formKey: string): boolean => {
  // For SNC forms: plans.0, plans.1, etc.
  if (formKey === 'snc') {
    return /^plans\.\d+$/.test(path);
  }

  // For Assessment forms: plan.plans.0, plan.plans.1, etc.
  if (formKey === 'assessment') {
    return /^plan\.plans\.\d+$/.test(path);
  }

  return false;
};

// Check if a path represents a test item that should have audio recording (for Physio forms)
export const isTestPath = (path: string, formKey: string): boolean => {
  // For Physio forms: tests.0, tests.1, etc.
  if (formKey === 'physio') {
    return /^tests\.\d+$/.test(path);
  }

  return false;
};

// Check if a section should have audio recording
export const shouldHaveAudioRecording = (
  path: string,
  formKey: string
): boolean => {
  // SNC and Physio forms don't need section audio recording
  // They use global + individual plan/test audio instead
  if (formKey === 'snc' || formKey === 'physio') {
    return false;
  }

  const sections = FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];

  // For root level sections in other form types
  if (path && !path.includes('.')) {
    return sections.includes(path);
  }

  return false;
};

// Function to remove "record" fields and process data for submission
export const removeRecordFields = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => removeRecordFields(item));
  }

  // Create a new object without record fields
  const result: any = {};
  for (const key in obj) {
    // Skip adding the record field entirely
    if (key === 'record') continue;

    // Convert numeric values to strings where needed
    if (key === 'load' && typeof obj[key] === 'number') {
      result[key] = String(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = removeRecordFields(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
};

// Process form data based on form type for submission
export const processFormDataForSubmission = (
  formKey: string,
  state: any
): any => {
  const formDataCopy = JSON.parse(JSON.stringify(state));
  const input: any = {};

  if (formKey === 'snc') {
    // For SNC forms, add the data to assessment.plan.plans
    input.assessment = {
      plan: {
        plans: removeRecordFields(formDataCopy.plans),
      },
    };

    // If there's advice in the SNC form, also add it to assessment.plan.advice
    if (formDataCopy.advice) {
      input.assessment.plan.advice = formDataCopy.advice;
    }
  } else if (formKey === 'physio') {
    // For Physio forms, add the data only to assessment.objectiveAssessment
    input.assessment = {
      objectiveAssessment: {
        tests: removeRecordFields(formDataCopy.tests),
      },
    };
  } else {
    // For other form types (firstAssessment, assessment), just use the data as is
    input[formKey] = removeRecordFields(formDataCopy);
  }

  return { input, formDataCopy };
};

// Update localStorage after successful submission
export const updateLocalStorageAfterSubmission = (
  formKey: string,
  state: any,
  formDataCopy: any,
  result: any
): void => {
  try {
    const savedReport = localStorage.getItem('agentReport');
    if (savedReport) {
      const reportData = JSON.parse(savedReport);

      // Update report metadata
      reportData.updatedAt = result.updateAgentReport.updatedAt;
      reportData.version = result.updateAgentReport.version;
      reportData.isActive = result.updateAgentReport.isActive;
      reportData.isFilledCompletely =
        result.updateAgentReport.isFilledCompletely;

      // Store the processed data in appropriate keys in localStorage
      if (formKey === 'snc' || formKey === 'physio') {
        // Keep the form data in its original key for local form state
        reportData[formKey] = state;

        // Also update the assessment object if needed
        if (!reportData.assessment) reportData.assessment = {};

        if (formKey === 'snc') {
          if (!reportData.assessment.plan) reportData.assessment.plan = {};
          reportData.assessment.plan.plans = formDataCopy.plans;
          if (formDataCopy.advice) {
            reportData.assessment.plan.advice = formDataCopy.advice;
          }
        } else if (formKey === 'physio') {
          if (!reportData.assessment.objectiveAssessment) {
            reportData.assessment.objectiveAssessment = {};
          }
          reportData.assessment.objectiveAssessment.tests = formDataCopy.tests;
        }
      } else {
        // For regular forms, just update the form data directly
        reportData[formKey] = state;
      }

      localStorage.setItem('agentReport', JSON.stringify(reportData));
    }
  } catch (error) {
    console.error('Error updating localStorage:', error);
  }
};
