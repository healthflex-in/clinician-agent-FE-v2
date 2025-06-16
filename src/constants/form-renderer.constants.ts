export const FORM_SECTIONS = {
  firstAssessment: [
    'patientAdvice',
    'objectiveGoals',
    'recommendation',
    'subjectiveGoals',
    'clinicalDetails',
    'objectiveAssessments',
    'subjectiveAssessments',
  ],
  physio: ['tests'],
  snc: ['plans', 'advice'],
  assessment: ['plan', 'subjectiveAssessment', 'objectiveAssessment', 'rpe'],
};

// Auto-processing delay in milliseconds
export const AUTO_PROCESS_DELAY = 5000;

// Processing queue retry delay
export const QUEUE_RETRY_DELAY = 100;

// Next queue processing delay after completion
export const NEXT_QUEUE_DELAY = 500;
