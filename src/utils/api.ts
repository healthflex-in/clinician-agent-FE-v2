// Store API key in environment variable in production
const API_KEY =
  'b90718a058accf0130e62c030ef919b3eabbbff85b81bb70985d6ab87995333a';

/**
 * CORS-friendly GraphQL client using a public CORS proxy
 * @param query GraphQL query string
 * @param variables Variables to pass to the query
 * @returns Promise with the response data
 */
export async function graphqlRequest<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const apiEndpoint = 'https://devapi.stance.health/graphql';

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e: any) => e.message).join('\n'));
    }

    return data.data as T;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

// Helper: Filter out empty/zero values and 'record' fields
function filterEmptyValuesForAPI(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    const filteredArray = obj
      .map((item) => filterEmptyValuesForAPI(item))
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
        // Skip 'record' fields completely
        if (key === 'record') continue;

        const value = obj[key];
        const filteredValue = filterEmptyValuesForAPI(value);

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

  return obj;
}

// FIXED: Only include fields that have actual data, no empty fallbacks
function convertToRequiredPayload(inputData: any) {
  // First filter out empty values
  const filteredData = filterEmptyValuesForAPI(inputData);
  console.log(
    '=== Data after filtering empty values ===',
    JSON.stringify(filteredData, null, 2)
  );

  // If no data after filtering, return minimal structure
  if (!filteredData || Object.keys(filteredData).length === 0) {
    return { assessment: {} };
  }

  const assessmentPayload: any = {};

  // Only include plan if it has data
  if (filteredData.plan) {
    const planData: any = {};

    // Only include advice if it exists and is not empty
    if (filteredData.plan.advice && filteredData.plan.advice.trim() !== '') {
      planData.advice = filteredData.plan.advice;
    }

    // Only include plans if they exist and have content
    if (
      filteredData.plan.plans &&
      Array.isArray(filteredData.plan.plans) &&
      filteredData.plan.plans.length > 0
    ) {
      planData.plans = filteredData.plan.plans
        .map((plan: any) => {
          const planItem: any = {};

          // Only include fields that have actual data
          if (plan.exercise && plan.exercise.trim() !== '') {
            planItem.exercise = plan.exercise;
          }
          if (plan.comments && plan.comments.trim() !== '') {
            planItem.comments = plan.comments;
          }
          if (plan.set && Array.isArray(plan.set) && plan.set.length > 0) {
            planItem.set = plan.set;
          }
          if (
            plan.duration &&
            (plan.duration.value > 0 ||
              (plan.duration.unit && plan.duration.unit.trim() !== ''))
          ) {
            const durationData: any = {};
            if (plan.duration.value > 0)
              durationData.value = plan.duration.value;
            if (plan.duration.unit && plan.duration.unit.trim() !== '')
              durationData.unit = plan.duration.unit;
            if (Object.keys(durationData).length > 0) {
              planItem.duration = durationData;
            }
          }

          return planItem;
        })
        .filter((plan: any) => Object.keys(plan).length > 0); // Remove completely empty plans
    }

    if (Object.keys(planData).length > 0) {
      assessmentPayload.plan = planData;
    }
  }

  // Only include subjectiveAssessment if it has data
  if (
    filteredData.subjectiveAssessment &&
    filteredData.subjectiveAssessment.assessment &&
    filteredData.subjectiveAssessment.assessment.trim() !== ''
  ) {
    assessmentPayload.subjectiveAssessment = {
      assessment: filteredData.subjectiveAssessment.assessment,
    };
  }

  // Only include objectiveAssessment if it has tests with data
  if (
    filteredData.objectiveAssessment &&
    filteredData.objectiveAssessment.tests &&
    Array.isArray(filteredData.objectiveAssessment.tests) &&
    filteredData.objectiveAssessment.tests.length > 0
  ) {
    const filteredTests = filteredData.objectiveAssessment.tests
      .map((test: any) => {
        const testItem: any = {};

        if (test.testName && test.testName.trim() !== '')
          testItem.testName = test.testName;
        if (test.unitName && test.unitName.trim() !== '')
          testItem.unitName = test.unitName;
        if (test.value && parseFloat(test.value) > 0)
          testItem.value = parseFloat(test.value);
        if (test.left && parseFloat(test.left) > 0)
          testItem.left = parseFloat(test.left);
        if (test.right && parseFloat(test.right) > 0)
          testItem.right = parseFloat(test.right);
        if (test.comments && test.comments.trim() !== '')
          testItem.comments = test.comments;

        return testItem;
      })
      .filter((test: any) => Object.keys(test).length > 0); // Remove completely empty tests

    if (filteredTests.length > 0) {
      assessmentPayload.objectiveAssessment = {
        tests: filteredTests,
      };
    }
  }

  // Only include rpe if it has a value > 0
  if (
    filteredData.rpe &&
    filteredData.rpe.value &&
    parseFloat(filteredData.rpe.value) > 0
  ) {
    assessmentPayload.rpe = {
      value: parseFloat(filteredData.rpe.value),
    };
  }

  return { assessment: assessmentPayload };
}

/**
 * Update agent report with form data - ONLY SEND NON-EMPTY DATA
 * @param input Update agent report input
 * @returns Promise with the response data
 */
export async function updateAgentReport(input: {
  patientId?: string;
  appointmentId: string;
  centerId?: string;
  formKey?: string;
  input: any;
}) {
  console.log('=== updateAgentReport called (only non-empty data) ===');
  console.log('Input data received:', JSON.stringify(input.input, null, 2));

  // Convert to required payload format - only include non-empty data
  const convertedData = convertToRequiredPayload(input.input);

  console.log(
    '=== Final payload being sent to API (only non-empty data) ===',
    JSON.stringify(convertedData, null, 2)
  );

  const query = `
    mutation updateAgentReport( $appointmentId: ObjectID!, $input: UpdateAgentReportInput!) {
      updateAgentReport(appointmentId: $appointmentId, input: $input) {
        _id
      }
    }
  `;

  return graphqlRequest(query, {
    appointmentId: input.appointmentId,
    input: convertedData,
  });
}

/**
 * Fetch centers
 * @returns Promise with centers data
 */
export async function fetchCenters() {
  const query = `
    query Centers {
      centers {
        _id
        name
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Search users by name, type, and center
 * @param userType User type (e.g. PATIENT)
 * @param centerId Center ID
 * @param search Search term
 * @returns Promise with users data
 */
export async function searchUsers(
  userType: string,
  centerId: string[],
  search?: string
) {
  const query = `
    query Users($userType: UserType, $centerId: [ObjectID!]!, $search: String) {
      users(userType: $userType, centerId: $centerId, search: $search) {
        _id
        profileData {
          ... on Patient {
            firstName
            lastName
          }
        }
      }
    }
  `;

  return graphqlRequest(query, {
    userType,
    centerId,
    search,
  });
}

/**
 * Fetch appointments for a patient
 * @param filter Appointment filter
 * @returns Promise with appointments data
 */
export async function fetchAppointments<T = any>(
  filter: any,
  search?: string
): Promise<T> {
  const query = `
    query Events($filter: EventFilter!, $search: String) {
      events(filter: $filter, search: $search) {
        ... on AppointmentEvent {
          _id
          startTime
          attendees {
            profileData {
              ... on Patient {
                firstName
                lastName
              }
            }
          }
          appointment {
            seqNo
          }
        }
      }
    }
  `;

  return graphqlRequest(query, { filter, search });
}

export async function createAgentReport(input: any) {
  const mutation = `
    mutation CreateAgentReport($input: CreateAgentReportInput!) {
      createAgentReport(input: $input) {
        _id
        createdAt
        updatedAt
        version
        isActive
        assessment {
          plan {
            advice
            record
            plans {
              exercise
              comments
              set {
                repetitions
                load
                unit
              }
              duration {
                value
                unit
              }
            }
          }
          subjectiveAssessment {
            assessment
            record
          }
          objectiveAssessment {
            record
            tests {
              testName
              unitName
              value
              left
              right
              comments
            }
          }
          rpe {
            value
            record
          }
        }
      }
    }
  `;
  return graphqlRequest(mutation, { input });
}
