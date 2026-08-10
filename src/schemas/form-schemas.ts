const formSchemas = {
  // First Assessment Form
  // Shape mirrors the backend registry (src/forms/registry.py _FIRST_ASSESSMENT_DEFAULTS)
  // and AgentFirstAssessmentInput on the API. Repeatable sections are arrays so the
  // renderer shows Add/Remove controls.
  firstAssessment: {
    clinicalDetails: {
      clinicalHistory: '',
      chiefComplaint: '',
      duration: '',
    },
    subjectiveAssessments: [
      {
        testName: '',
        conclusion: '',
      },
    ],
    objectiveAssessment: {
      tests: [
        {
          testName: '',
          unitName: '',
          value: '',
          left: '',
          right: '',
          comments: '',
        },
      ],
    },
    subjectiveGoals: [
      {
        goalDetails: '',
        targetDate: '',
      },
    ],
    objectiveGoals: [
      {
        goalName: '',
        goalCategory: '',
        unitName: '',
        value: '',
        targetDate: '',
      },
    ],
    recommendation: [
      {
        sessionType: '',
        sessionFrequency: '',
      },
    ],
    patientAdvice: {
      adviceDetails: '',
    },
  },

  // SNC Form
  // snc: {
  //   advice: '',
  //   plans: [
  //     {
  //       exercise: '',
  //       comments: '',
  //       sets: [
  //         {
  //           repetitions: 0,
  //           load: '',
  //           unit: '',
  //         },
  //       ],
  //       duration: {
  //         value: 0,
  //         unit: '',
  //       },
  //     },
  //   ],
  // },

  // Physio Form
  // physio: {
  //   tests: [
  //     {
  //       testName: '',
  //       unitName: '',
  //       value: 0,
  //       left: 0,
  //       right: 0,
  //       comments: '',
  //     },
  //   ],
  // },

  // Assessment Form
  assessment: {
    plan: {
      advice: '',
      plans: [
        {
          exercise: '',
          comments: '',
          set: [
            {
              repetitions: 0,
              load: '',
              unit: '',
            },
          ],
          duration: {
            value: 0,
            unit: '',
          },
        },
      ],
    },
    subjectiveAssessment: {
      assessment: '',
    },
    objectiveAssessment: {
      tests: [
        {
          testName: '',
          unitName: '',
          value: 0,
          left: 0,
          right: 0,
          comments: '',
        },
      ],
    },
    rpe: {
      value: 0,
    },
  },
};

export default formSchemas;
