import { FIRST_ASSESSMENT_FIELDS } from './first-assessment';
import { graphqlRequest, saveReport } from './graphql-client';
export { graphqlRequest } from './graphql-client';

export async function updateAgentReport(input: {
  patientId?: string;
  appointmentId: string;
  centerId?: string;
  formKey?: string;
  input: any;
}) {
  return saveReport(input.appointmentId, input.formKey || localStorage.getItem('formKey') || 'assessment', input.input);
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
 * Search users by name, type, and center with pagination
 * @param userType User type (e.g. PATIENT)
 * @param centerId Center ID array
 * @param search Search term
 * @returns Promise with users data
 */
export async function searchUsers(
  userType: string,
  centerId: string[],
  search?: string
) {
  const query = `
    query Users(
      $userType: UserType!
      $centerId: [ObjectID!]!
      $search: String
      $filter: UserFilterInput
      $pagination: CursorPaginationInput
      $sort: UserSortInput
    ) {
      users(
        userType: $userType
        centerId: $centerId
        search: $search
        filter: $filter
        pagination: $pagination
        sort: $sort
      ) {
        data {
          _id
          seqNo
          phone
          email
          isActive
          userType
          profileData {
            ... on Patient {
              firstName
              lastName
              dob
              bio
              gender
              profilePicture
              status
              category
              cohort
              patientType
              __typename
            }
            __typename
          }
          __typename
        }
        pagination {
          nextCursor
          prevCursor
          hasNext
          hasPrevious
          limit
          __typename
        }
        __typename
      }
    }
  `;

  const variables = {
    userType,
    centerId,
    search: search || null,
    filter: null,
    pagination: {
      limit: 200,
      direction: 'FORWARD',
    },
    sort: {
      field: 'CREATED_AT',
      order: 'DESC',
    },
  };

  console.log('GraphQL Query:', query);
  console.log('GraphQL Variables:', JSON.stringify(variables, null, 2));

  return graphqlRequest(query, variables);
}

/**
 * NEW: Search users with pagination - temporary function to avoid caching issues
 */
export async function searchUsersWithPagination(
  userType: string,
  centerId: string[],
  search?: string
) {
  const query = `
    query Users(
      $userType: UserType!
      $centerId: [ObjectID!]!
      $search: String
      $filter: UserFilterInput
      $pagination: CursorPaginationInput
      $sort: UserSortInput
    ) {
      users(
        userType: $userType
        centerId: $centerId
        search: $search
        filter: $filter
        pagination: $pagination
        sort: $sort
      ) {
        data {
          _id
          seqNo
          phone
          email
          isActive
          userType
          profileData {
            ... on Patient {
              firstName
              lastName
              dob
              bio
              gender
              profilePicture
              status
              category
              cohort
              patientType
              __typename
            }
            __typename
          }
          __typename
        }
        pagination {
          nextCursor
          prevCursor
          hasNext
          hasPrevious
          limit
          __typename
        }
        __typename
      }
    }
  `;

  const variables = {
    userType,
    centerId,
    search: search || null,
    filter: null,
    pagination: {
      limit: 200,
      direction: 'FORWARD',
    },
    sort: {
      field: 'CREATED_AT',
      order: 'DESC',
    },
  };

  console.log('NEW GraphQL Query:', query);
  console.log('NEW GraphQL Variables:', JSON.stringify(variables, null, 2));

  return graphqlRequest(query, variables);
}

/**
 * Fetch appointments for a patient
 * @param patientId Patient ID
 * @returns Promise with reports data
 */
export async function fetchAppointments<T = any>(
  patientId: string
): Promise<T> {
  const query = `
    query Reports($patientId: ObjectID!) {
      reports(patientId: $patientId) {
        _id
        createdAt
        updatedAt
        version
        isActive
        seqNo
        pdf
        isFirstAssessment
        appointment {
          _id
          status
          visitType
          event {
            startTime
            endTime
          }
          consultant {
            email
            profileData {
              ... on Consultant {
                bio
                designation
                firstName
                lastName
                profilePicture
                specialization
              }
            }
          }
          isActive
          medium
          notes
        }
        agentReport {
          _id
          isAccepted
        }
        records {
          plan {
            advice
            plans {
              exercise
              set {
                repetitions
                load
                unit
              }
              duration {
                value
                unit
              }
              comments
            }
          }
        }
      }
    }
  `;

  return graphqlRequest(query, { patientId });
}

/**
 * Fetch user by ID
 * @param userId User ID
 * @returns Promise with user data
 */
export async function fetchUserById(userId: string) {
  const query = `
    query User($userId: ObjectID!) {
      user(userId: $userId) {
        _id
        profileData {
          ... on Patient {
            firstName
            lastName
            __typename
          }
          __typename
        }
        __typename
      }
    }
  `;

  return graphqlRequest(query, { userId });
}

export async function createAgentReport(input: any, formKey = "assessment") {
  if (formKey === "firstAssessment") {
    return graphqlRequest(`mutation CreateAgentReport($input: CreateAgentReportInput!) {
      createAgentReport(input: $input) { _id firstAssessment { ${FIRST_ASSESSMENT_FIELDS} } }
    }`, { input });
  }
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

/** Read the existing target report before considering initialization. */
export async function fetchFirstAssessmentReport(patientId: string, appointmentId: string) {
  const result = await graphqlRequest<any>(`
    query ReadFirstAssessment($patientId: ObjectID!) {
      reports(patientId: $patientId) {
        appointment { _id }
        agentReport { _id firstAssessment { ${FIRST_ASSESSMENT_FIELDS} } }
      }
    }
  `, { patientId });
  const matches = (result?.reports || []).filter((report: any) => report.appointment?._id === appointmentId);
  if (matches.length > 1) throw new Error('Multiple reports found for this appointment');
  return matches[0]?.agentReport ?? null;
}
