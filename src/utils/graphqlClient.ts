// src/api/graphqlClient.ts
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { gql } from '@apollo/client';
import { API_KEY, getApiUrl } from './apiConfig';

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

/**
 * Update agent report with form data
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
export async function fetchAppointments<T = any>(filter: any): Promise<T> {
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

// Export everything for centralized access
export default {
  client,
  graphqlRequest,
  updateAgentReport,
  fetchCenters,
  searchUsers,
  fetchAppointments,
};
