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
  // Using a public CORS proxy service to avoid CORS issues
  // Warning: This is a temporary solution for development only
  // Do not use this in production - use a proper backend/proxy service
  const corsProxy = 'https://corsproxy.io/?';
  const apiEndpoint = 'https://devapi.stance.health/graphql';
  // const apiEndpoint = 'http://localhost:3000/graphql';
  const proxyUrl = `${corsProxy}${encodeURIComponent(apiEndpoint)}`;

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

function convertToRequiredPayload(inputData: any) {
  return {
    assessment: {
      plan: {
        advice: inputData.plan?.advice || '', // Use received data or empty string
        plans:
          inputData.plan?.plans?.map((plan: any) => ({
            exercise: plan.exercise || '', // Ensure valid exercise name
            comments: plan.comments || '', // Ensure valid comments
            set: plan.set?.map((set: any) => ({
              repetitions: set.repetitions || 0, // Ensure it's a number (default 0)
              load: set.load || '', // Default to empty string if not available
              unit: set.unit || '', // Default to empty string if not available
            })),
            duration: {
              value: plan.duration?.value || 0, // Ensure it's a number (default 0)
              unit: plan.duration?.unit || '', // Default to empty if not available
            },
          })) || [],
      },
      subjectiveAssessment: {
        assessment: inputData.subjectiveAssessment?.assessment || '', // Default to empty if not available
      },
      objectiveAssessment: {
        tests:
          inputData.objectiveAssessment?.tests?.map((test: any) => ({
            testName: test.testName || '', // Ensure valid test name
            unitName: test.unitName || '', // Ensure valid unit name
            value: parseFloat(test.value) || 0, // Ensure this is a Float (default 0)
            left: parseFloat(test.left) || 0, // Ensure this is a Float (default 0)
            right: parseFloat(test.right) || 0, // Ensure this is a Float (default 0)
            comments: test.comments || '', // Default to empty if not available
          })) || [],
      },
      rpe: {
        value: parseFloat(inputData.rpe?.value) || 0, // Ensure this is a Float (default 0)
      },
    },
  };
}

/**
 * Update agent report with form data
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
  console.log('=== Validating form data before sending to API ===');
  console.log(
    'Input data being sent to the server:',
    JSON.stringify(input.input, null, 2)
  ); // Log the input data

  const convertedData = convertToRequiredPayload(input.input);

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
export async function fetchAppointments(filter: any) {
  const query = `
    query Appointments($filter: AppointmentFilter!) {
      appointments(filter: $filter) {
        _id
        seqNo
        createdAt
      }
    }
  `;

  return graphqlRequest(query, { filter });
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
