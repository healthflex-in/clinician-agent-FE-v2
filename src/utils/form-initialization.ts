import React from 'react';
import { defaultStateFromSchema } from '@/utils/schema-utils';

export interface FormInitializationProps {
  formData: any;
  schema: any;
  state: any;
  dispatch: React.Dispatch<any>;
}

// Helper: Deep merge API data with schema defaults
const mergeWithDefaults = (apiData: any, schemaDefaults: any): any => {
  // If no API data, return schema defaults
  if (!apiData || typeof apiData !== 'object') {
    return schemaDefaults;
  }

  // If no schema defaults, return API data
  if (!schemaDefaults || typeof schemaDefaults !== 'object') {
    return apiData;
  }

  // Handle arrays - merge array items with default structure
  if (Array.isArray(schemaDefaults)) {
    if (!Array.isArray(apiData)) {
      return schemaDefaults;
    }

    // If API has data, merge each item with the default array item structure
    if (apiData.length > 0 && schemaDefaults.length > 0) {
      return apiData.map((item: any) =>
        mergeWithDefaults(item, schemaDefaults[0])
      );
    }

    return apiData.length > 0 ? apiData : schemaDefaults;
  }

  // Handle objects - merge properties
  if (typeof schemaDefaults === 'object' && typeof apiData === 'object') {
    const merged: any = { ...schemaDefaults }; // Start with schema defaults

    // Override/merge with API data
    for (const key in apiData) {
      if (Object.prototype.hasOwnProperty.call(apiData, key)) {
        if (apiData[key] === null || apiData[key] === undefined) {
          // Keep schema default for null/undefined API values
          continue;
        } else if (
          typeof apiData[key] === 'object' &&
          typeof merged[key] === 'object'
        ) {
          // Recursively merge nested objects/arrays
          merged[key] = mergeWithDefaults(apiData[key], merged[key]);
        } else {
          // Direct assignment for primitive values
          merged[key] = apiData[key];
        }
      }
    }

    return merged;
  }

  // For primitive values, prefer API data over defaults (unless null/undefined)
  return apiData !== null && apiData !== undefined ? apiData : schemaDefaults;
};

export const useFormInitialization = ({
  formData,
  schema,
  state,
  dispatch,
}: FormInitializationProps) => {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationRef = React.useRef(false);

  // Initialize form state with API data merged with schema defaults
  React.useEffect(() => {
    if (initializationRef.current) return;

    console.log('=== Starting form initialization ===');

    // Always generate schema defaults first
    const schemaDefaults = defaultStateFromSchema(schema);
    console.log(
      '=== Schema defaults ===',
      JSON.stringify(schemaDefaults, null, 2)
    );

    let finalFormData = schemaDefaults;

    // If we have API data, merge it with schema defaults
    if (formData) {
      // Handle nested API response structure
      let actualFormData = formData;

      // If data is nested (from createAgentReport response)
      if (formData.createAgentReport?.assessment) {
        actualFormData = formData.createAgentReport.assessment;
      } else if (formData.assessment) {
        actualFormData = formData.assessment;
      }

      console.log(
        '=== Original API data ===',
        JSON.stringify(actualFormData, null, 2)
      );

      // Transform API data to match schema structure
      const normalizedFormData = JSON.parse(JSON.stringify(actualFormData)); // Deep clone

      // CRITICAL FIX: Convert 'sets' to 'set' to match schema
      if (normalizedFormData.plan?.plans) {
        normalizedFormData.plan.plans = normalizedFormData.plan.plans.map(
          (plan: any) => {
            const transformedPlan = { ...plan };

            // Convert sets to set (API uses 'sets', schema uses 'set')
            if (plan.sets) {
              transformedPlan.set = plan.sets;
              delete transformedPlan.sets; // Remove the old field
            } else if (plan.set) {
              transformedPlan.set = plan.set; // Keep as is if already 'set'
            }
            // Don't add default empty array here - let mergeWithDefaults handle it

            return transformedPlan;
          }
        );
      }

      // Handle objectiveAssessment array format
      if (Array.isArray(normalizedFormData.objectiveAssessment)) {
        normalizedFormData.objectiveAssessment = {
          tests: normalizedFormData.objectiveAssessment[0]?.tests || [],
        };
      }

      console.log(
        '=== Normalized API data ===',
        JSON.stringify(normalizedFormData, null, 2)
      );

      // Merge API data with schema defaults
      finalFormData = mergeWithDefaults(normalizedFormData, schemaDefaults);
      console.log(
        '=== Merged data (API + Schema defaults) ===',
        JSON.stringify(finalFormData, null, 2)
      );
    } else {
      console.log('=== No API data, using schema defaults only ===');
    }

    // Check if the merged data is different from current state
    const isSame = JSON.stringify(state) === JSON.stringify(finalFormData);

    if (!isSame) {
      console.log('=== Dispatching REPLACE_STATE with merged data ===');
      dispatch({ type: 'REPLACE_STATE', data: finalFormData });
    } else {
      console.log('=== State is already correct, no dispatch needed ===');
    }

    initializationRef.current = true;
    setIsInitialized(true);
    console.log('=== Form initialization complete ===');
  }, [formData, dispatch, schema, state]);

  return {
    isInitialized,
    setIsInitialized,
  };
};
