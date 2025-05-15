
// Types for form data and schemas

export type TestValue = {
  testName: string;
  unitName: string;
  value: string | number;
  rightValue: string | number;
  leftValue: string | number;
  comments: string;
};

export type ExercisePlan = {
  exercise: string;
  comments: string;
  set: {
    repetitions: number;
    load: number;
    unit: string;
  };
  duration: {
    value: number;
    unit: string;
  };
};

export type ClinicalDetail = {
  clinicalHistory: string;
  chiefComplaint: string;
  duration: string;
};

export type SubjectiveAssessment = {
  testName: string;
  conclusion: string;
};

export type SubjectiveGoal = {
  goalDetails: string;
  targetDate: string;
};

export type ObjectiveGoal = {
  goalName: string;
  goalCategory: string;
  unitName: string;
  value: string | number;
  targetDate: string;
};

export type Recommendation = {
  sessionType: string;
  sessionFrequency: string;
};

export type PatientAdvice = {
  adviceDetails: string;
};

export type SubjectiveInput = {
  inputs: string;
};

// Form data structures
export interface PhysioForm {
  record: string;
  tests: TestValue[];
}

export interface SncForm {
  advice: string;
  record: string;
  plans: ExercisePlan[];
}

export interface FirstAssessmentForm {
  clinicalDetails: ClinicalDetail;
  objectiveAssessments: {
    record: string;
    tests: TestValue[];
  };
  subjectiveAssessments: SubjectiveAssessment;
  subjectiveGoals: SubjectiveGoal;
  objectiveGoals: ObjectiveGoal;
  recommendation: Recommendation;
  patientAdvice: PatientAdvice;
}

export interface AssessmentForm {
  plan: {
    advice: string;
    record: string;
    plans: ExercisePlan[];
  };
  subjectiveAssessment: {
    assessment: string;
    record: string;
  };
  objectiveAssessment: {
    record: string;
    tests: TestValue[];
  };
  rpe: {
    value: number;
    record: string;
  };
}

// Combined form type for the agent report
export interface AgentReport {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  isActive?: boolean;
  isFilledCompletely?: boolean;
  snc?: SncForm | any;
  physio?: PhysioForm | TestValue[] | any;
  firstAssessment?: FirstAssessmentForm | any;
  assessment?: AssessmentForm | any;
  patient?: string;
  center?: string;
  appointment?: string;
}

// Server expected format for each form field
export interface ServerFormData {
  [key: string]: any;
}

// WebSocket message types
export interface WebSocketMessage {
  payloadType: 'audio' | 'text' | 'structured' | 'authentication';
  audio?: string;
  userId?: string;
  appointmentId?: string;
  formKey?: string;
  formIndex?: number;
  operation_mode?: string;
  text?: string;
  formData?: any;
  form_data?: any;
  apiKey?: string;
  [key: string]: any;
}

export interface ServerResponse {
  transcription?: string;
  form_data?: any;
  formData?: any;
  payloadType?: string;
  suggestions?: string;
  realTimeRecommendations?: string;
  error?: string;
  [key: string]: any;
}
