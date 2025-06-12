import {
  getNestedValue,
  findDifferences,
  deepUpdateObject,
  defaultStateFromSchema,
} from '@/utils/schemaUtils';
import { FormAction } from '../types/FormRenderer.types';

// Reducer function to handle form state updates
export const formReducer = (
  state: any,
  toast: any,
  schema: any,
  action: FormAction,
  setLlmUpdatedFields: React.Dispatch<React.SetStateAction<Set<string>>>,
): any => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return deepUpdateObject(state, action.path, action.value);

    case 'ADD_ARRAY_ITEM':
      const currentArray = getNestedValue(state, action.path) || [];
      return deepUpdateObject(state, action.path, [
        ...currentArray,
        defaultStateFromSchema(action.template),
      ]);

    case 'REMOVE_ARRAY_ITEM':
      const array = getNestedValue(state, action.path) || [];
      return deepUpdateObject(
        state,
        action.path,
        array.filter((_: any, i: number) => i !== action.index)
      );

    case 'RESET_FORM':
      return action.data;

    case 'MERGE_LLM_DATA': {
      const differences = findDifferences(state, action.data);

      if (action.source === 'llm' && differences.length > 0) {
        setLlmUpdatedFields((prev) => {
          const newSet = new Set(prev);
          differences.forEach((field) => newSet.add(field));
          return newSet;
        });

        toast({
          title: 'Form Updated by AI',
          description: `${differences.length} field(s) were updated`,
        });
      }

      const mergeDeep = (target: any, source: any): any => {
        if (typeof source !== 'object' || source === null) return target;

        for (const key of Object.keys(source)) {
          if (
            typeof source[key] === 'object' &&
            source[key] !== null &&
            !Array.isArray(source[key])
          ) {
            target[key] = mergeDeep({ ...(target[key] || {}) }, source[key]);
          } else {
            target[key] = source[key];
          }
        }
        return target;
      };

      const newState = mergeDeep({ ...state }, action.data);
      return newState;
    }

    case 'RESET_FIELD': {
      const defaultValue = getNestedValue(
        defaultStateFromSchema(schema),
        action.path
      );
      return deepUpdateObject(state, action.path, defaultValue);
    }

    default:
      return state;
  }
};
