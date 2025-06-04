// Top-level section keys for each form type
export const FORM_SECTIONS = {
  firstAssessment: [
    'clinicalDetails',
    'subjectiveAssessments',
    'subjectiveGoals',
    'objectiveGoals',
    'recommendation',
    'patientAdvice',
    'objectiveAssessments',
  ],
  assessment: ['plan', 'subjectiveAssessment', 'objectiveAssessment', 'rpe'],
  physio: ['tests'],
  snc: ['plans', 'advice'],
};

// Auto-processing delay in milliseconds
export const AUTO_PROCESS_DELAY = 5000;

// Processing queue retry delay
export const QUEUE_RETRY_DELAY = 100;

// Next queue processing delay after completion
export const NEXT_QUEUE_DELAY = 500;
