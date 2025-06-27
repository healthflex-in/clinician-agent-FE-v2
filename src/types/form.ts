export type TestValue = {
  testName: string;
  unitName: string;
  comments: string;
  value: string | number;
  leftValue: string | number;
  rightValue: string | number;
};

export type ExercisePlan = {
  exercise: string;
  comments: string;
  set: {
    load: number;
    unit: string;
    repetitions: number;
  };
  duration: {
    value: number;
    unit: string;
  };
};

export type ClinicalDetail = {
  duration: string;
  chiefComplaint: string;
  clinicalHistory: string;
};

export type SubjectiveAssessment = {
  testName: string;
  conclusion: string;
};

export type SubjectiveGoal = {
  targetDate: string;
  goalDetails: string;
};

export type ObjectiveGoal = {
  goalName: string;
  unitName: string;
  targetDate: string;
  goalCategory: string;
  value: string | number;
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
  objectiveAssessment: {
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
