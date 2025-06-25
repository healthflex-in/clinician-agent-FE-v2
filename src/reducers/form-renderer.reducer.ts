import {
  getNestedValue,
  findDifferences,
  deepUpdateObject,
  defaultStateFromSchema,
} from '@/utils/schema-utils';
import { FormAction } from '@/types/form-renderer.types';

// Reducer function to handle form state updates
export const formReducer = (
  state: any,
  toast: any,
  schema: any,
  action: FormAction,
  setLlmUpdatedFields: React.Dispatch<React.SetStateAction<Set<string>>>
): any => {
  // Helper function to set nested value by path
  const setNestedValue = (obj: any, path: string, value: any) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
    return obj;
  };

  // Helper function to get nested value by path
  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  };

  switch (action.type) {
    case 'UPDATE_FIELD':
      return deepUpdateObject(state, action.path, action.value);

    case 'ADD_ARRAY_ITEM': {
      const { arrayPath, item } = action;
      const newState = JSON.parse(JSON.stringify(state));
      const targetArray = getNestedValue(newState, arrayPath);

      if (Array.isArray(targetArray)) {
        targetArray.push(item);
      } else {
        console.error(`ADD_ARRAY_ITEM: ${arrayPath} is not an array`);
      }

      return newState;
    }

    case 'REMOVE_ARRAY_ITEM': {
      const { arrayPath, itemIndex } = action;
      const newState = JSON.parse(JSON.stringify(state));
      const targetArray = getNestedValue(newState, arrayPath);

      if (Array.isArray(targetArray) && targetArray.length > 1) {
        targetArray.splice(itemIndex, 1);
      } else {
        console.error(
          `REMOVE_ARRAY_ITEM: Cannot remove from ${arrayPath} - insufficient items or not an array`
        );
      }

      return newState;
    }

    case 'UPDATE_ARRAY_ITEM': {
      const { itemPath, value } = action;
      const newState = JSON.parse(JSON.stringify(state));
      setNestedValue(newState, itemPath, value);
      return newState;
    }

    case 'MOVE_ARRAY_ITEM': {
      const { arrayPath, fromIndex, toIndex } = action;
      const newState = JSON.parse(JSON.stringify(state));
      const targetArray = getNestedValue(newState, arrayPath);

      if (Array.isArray(targetArray)) {
        const [movedItem] = targetArray.splice(fromIndex, 1);
        targetArray.splice(toIndex, 0, movedItem);
      }

      return newState;
    }

    case 'REPLACE_STATE':
      return action.data;

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
