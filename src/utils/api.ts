// Store API key in environment variable in production
const API_KEY = '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20';

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
  const proxyUrl = `${corsProxy}${encodeURIComponent(apiEndpoint)}`;

  try {
    const response = await fetch(proxyUrl, {
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

/**
 * Update agent report with form data
 * @param input Update agent report input
 * @returns Promise with the response data
 */
export async function updateAgentReport(input: {
  patientId: string;
  appointmentId: string;
  centerId?: string;
  formKey: string;
  formData: any;
}) {
  const query = `
    mutation updateAgentReport($input: UpdateAgentReportInput!) {
      updateAgentReport(input: $input) {
        _id
      }
    }
  `;

  return graphqlRequest(query, { input });
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
