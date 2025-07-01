import { API_KEY, getApiUrl } from './api-config';
import { onError } from '@apollo/client/link/error';
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';

// Create an error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// Create the HTTP link with the proper headers (no proxy)
const httpLink = new HttpLink({
  uri: getApiUrl(), // Direct URL (not proxied)
  headers: {
    'x-api-key': API_KEY,
    'x-organization-id': '67fe35f25e42152fb5185a5e', // Change if dynamic
  },
});

// Initialize Apollo Client
export const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

/**
 * Simple GraphQL client for making API calls
 */
export async function graphqlRequest<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = getApiUrl();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-organization-id': '67fe35f25e42152fb5185a5e', // Change if dynamic
        Origin: window.location.origin,
      },
      mode: 'cors',
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Details: ${errorText}`
      );
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

export async function updateAgentReport(input: {
  patientId: string;
  appointmentId: string;
  centerId?: string;
  formKey: string;
  formData: any;
}) {
  // Process the form data to remove record fields and fix types
  const processData = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => processData(item));
    }

    const result: any = {};
    for (const key in obj) {
      if (key === 'record') continue; // Skip record fields

      if (key === 'load' && typeof obj[key] === 'number') {
        result[key] = String(obj[key]);
      } else if (typeof obj[key] === 'object') {
        result[key] = processData(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  };

  // Create the input object with the processed form data
  const inputData: any = {};

  // Set the form data under the formKey, after processing
  inputData[input.formKey] = processData(input.formData);

  // Use the correct mutation structure with appointmentId as a separate parameter
  const query = `
    mutation UpdateAgentReport($appointmentId: ObjectID!, $input: UpdateAgentReportInput!) {
      updateAgentReport(appointmentId: $appointmentId, input: $input) {
        _id
        createdAt
        updatedAt
        version
        isActive
        isFilledCompletely
      }
    }
  `;

  // Set up variables with appointmentId separate from input
  const variables = {
    appointmentId: input.appointmentId,
    input: inputData,
  };

  return graphqlRequest(query, variables);
}

/**
 * Fetch centers
 */
export async function fetchCenters<T = any>(): Promise<T> {
  const query = `
    query Centers {
      centers {
        _id
        name
        phone
        location
        seqNo
        address {
          street
          city
          state
          country
          zip
        }
        organization {
          _id
          logo
          gstNumber
          panNumber
          brandName
          companyName
          socialLinks
        }
      }
    }
  `;

  return graphqlRequest(query);
}

/**
 * Search users by name, type, and center
 */
export async function searchUsers<T = any>(
  userType: string,
  centerId: string[],
  search?: string
): Promise<T> {
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
          appointment {
            seqNo
          }
        }
      }
    }
  `;

  return graphqlRequest(query, { filter, search });
}

// Export everything for centralized access
export default {
  client,
  graphqlRequest,
  updateAgentReport,
  fetchCenters,
  searchUsers,
  fetchAppointments,
};
