
const formSchemas = {
  // First Assessment Form
  firstAssessment: {
    clinicalDetails: {
      clinicalHistory: "",
      chiefComplaint: "",
      duration: ""
    },
    subjectiveAssessments: {
      testName: "",
      conclusion: ""
    },
    subjectiveGoals: {
      goalDetails: "",
      targetDate: ""
    },
    objectiveGoals: {
      goalName: "",
      goalCategory: "",
      unitName: "",
      value: "",
      targetDate: ""
    },
    recommendation: {
      sessionType: "",
      sessionFrequency: ""
    },
    patientAdvice: {
      adviceDetails: ""
    },
    objectiveAssessments: {
      record: "",
      tests: [
        {
          testName: "",
          unitName: "",
          value: 0,
          left: 0,
          right: 0,
          comments: ""
        }
      ]
    }
  },
  
  // SNC Form
  snc: {
    advice: "",
    record: "",
    plans: [
      {
        exercise: "",
        comments: "",
        set: {
          repetitions: 0,
          load: 0,
          unit: ""
        },
        duration: {
          value: 0,
          unit: ""
        }
      }
    ]
  },
  
  // Physio Form
  physio: {
    record: "",
    tests: [
      {
        testName: "",
        unitName: "",
        value: 0,
        left: 0,
        right: 0,
        comments: ""
      }
    ]
  },
  
  // Assessment Form
  assessment: {
    plan: {
      advice: "",
      record: "",
      plans: [
        {
          exercise: "",
          comments: "",
          set: {
            repetitions: 0,
            load: 0,
            unit: ""
          },
          duration: {
            value: 0,
            unit: ""
          }
        }
      ]
    },
    subjectiveAssessment: {
      assessment: "",
      record: ""
    },
    objectiveAssessment: {
      record: "",
      tests: [
        {
          testName: "",
          unitName: "",
          value: 0,
          left: 0,
          right: 0,
          comments: ""
        }
      ]
    },
    rpe: {
      value: 0,
      record: ""
    }
  }
};

export default formSchemas;
