const formSchemas = {
  // First Assessment Form
  // firstAssessment: {
  //   clinicalDetails: {
  //     clinicalHistory: '',
  //     chiefComplaint: '',
  //     duration: '',
  //   },
  //   subjectiveAssessments: {
  //     testName: '',
  //     conclusion: '',
  //   },
  //   subjectiveGoals: {
  //     goalDetails: '',
  //     targetDate: '',
  //   },
  //   objectiveGoals: {
  //     goalName: '',
  //     goalCategory: '',
  //     unitName: '',
  //     value: '',
  //     targetDate: '',
  //   },
  //   recommendation: {
  //     sessionType: '',
  //     sessionFrequency: '',
  //   },
  //   patientAdvice: {
  //     adviceDetails: '',
  //   },
  //   objectiveAssessment: {
  //     tests: [
  //       {
  //         testName: '',
  //         unitName: '',
  //         value: 0,
  //         left: 0,
  //         right: 0,
  //         comments: '',
  //       },
  //     ],
  //   },
  // },

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
