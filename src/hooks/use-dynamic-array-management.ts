// hooks/use-dynamic-array-management.ts
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ArrayManagementConfig {
  formKey: string;
  state: any;
  dispatch: (action: any) => void;
  setLlmUpdatedFields: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useDynamicArrayManagement = ({
  formKey,
  state,
  dispatch,
  setLlmUpdatedFields,
}: ArrayManagementConfig) => {
  const { toast } = useToast();

  // Helper function to get nested value by path
  const getNestedValue = useCallback((obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        // Handle array indices
        if (!isNaN(Number(key))) {
          return current[Number(key)];
        }
        return current[key];
      }
      return undefined;
    }, obj);
  }, []);

  // Helper function to get parent array and item index from path
  const getArrayInfo = useCallback(
    (path: string) => {
      const parts = path.split('.');
      const lastIndex = parts.length - 1;
      const itemIndex = Number(parts[lastIndex]);
      const arrayPath = parts.slice(0, lastIndex).join('.');
      const parentArray = getNestedValue(state, arrayPath);

      return {
        parentArray,
        itemIndex,
        arrayPath,
        isValidArray: Array.isArray(parentArray),
      };
    },
    [state, getNestedValue]
  );

  // Enable field modification after LLM update
  const enableFieldModification = useCallback(
    (fieldPath: string) => {
      setLlmUpdatedFields((prev) => {
        const newSet = new Set(prev);

        // Remove the specific field and any parent paths that might be locked
        const pathParts = fieldPath.split('.');
        for (let i = pathParts.length; i > 0; i--) {
          const partialPath = pathParts.slice(0, i).join('.');
          newSet.delete(partialPath);
        }

        return newSet;
      });
    },
    [setLlmUpdatedFields]
  );

  // Generate default item based on array path and form structure
  const generateDefaultItem = useCallback(
    (arrayPath: string, existingArray: any[]) => {
      // If array has existing items, copy structure from first item
      if (existingArray.length > 0) {
        const template = JSON.parse(JSON.stringify(existingArray[0]));

        // Reset values to defaults
        const resetValues = (obj: any): any => {
          if (Array.isArray(obj)) {
            return obj.length > 0 ? [resetValues(obj[0])] : [];
          } else if (typeof obj === 'object' && obj !== null) {
            const resetObj: any = {};
            for (const key in obj) {
              resetObj[key] = resetValues(obj[key]);
            }
            return resetObj;
          } else if (typeof obj === 'string') {
            return '';
          } else if (typeof obj === 'number') {
            return 0;
          } else {
            return obj;
          }
        };

        return resetValues(template);
      }

      // Fallback: Generate based on array path patterns
      if (arrayPath.includes('plans')) {
        return {
          exercise: '',
          comments: '',
          sets: [{ repetitions: 0, load: '', unit: '' }],
          duration: { value: 0, unit: '' },
        };
      } else if (arrayPath.includes('sets')) {
        return { repetitions: 0, load: '', unit: '' };
      } else if (arrayPath.includes('tests')) {
        return {
          testName: '',
          unitName: '',
          value: 0,
          left: 0,
          right: 0,
          comments: '',
        };
      } else {
        // Generic fallback
        return {};
      }
    },
    []
  );

  // Dynamic add item to any array
  const addArrayItem = useCallback(
    (arrayPath: string, defaultItem?: any) => {
      enableFieldModification(arrayPath);

      const parentArray = getNestedValue(state, arrayPath);

      if (!Array.isArray(parentArray)) {
        console.error(`Path ${arrayPath} does not point to an array`);
        toast({
          title: 'Error',
          description: `Cannot add item: ${arrayPath} is not an array`,
          variant: 'destructive',
        });
        return;
      }

      // Generate appropriate default item
      const newItem =
        defaultItem || generateDefaultItem(arrayPath, parentArray);

      dispatch({
        type: 'ADD_ARRAY_ITEM',
        arrayPath,
        item: newItem,
      });

      const arrayName = arrayPath.split('.').pop() || 'items';
      toast({
        title: 'Item Added',
        description: `New ${arrayName.slice(0, -1)} added successfully`,
      });
    },
    [
      state,
      dispatch,
      toast,
      enableFieldModification,
      getNestedValue,
      generateDefaultItem,
    ]
  );

  // Dynamic remove item from any array
  const removeArrayItem = useCallback(
    (itemPath: string) => {
      const { parentArray, itemIndex, arrayPath, isValidArray } =
        getArrayInfo(itemPath);

      if (!isValidArray) {
        console.error(
          `Cannot remove item: ${itemPath} is not in a valid array`
        );
        toast({
          title: 'Error',
          description: 'Cannot remove item: invalid array path',
          variant: 'destructive',
        });
        return;
      }

      // Enforce minimum of 1 item rule
      if (parentArray.length <= 1) {
        const arrayName = arrayPath.split('.').pop() || 'items';
        toast({
          title: 'Cannot remove',
          description: `At least one ${arrayName.slice(0, -1)} is required`,
          variant: 'destructive',
        });
        return;
      }

      enableFieldModification(arrayPath);

      dispatch({
        type: 'REMOVE_ARRAY_ITEM',
        arrayPath,
        itemIndex,
      });

      const arrayName = arrayPath.split('.').pop() || 'items';
      toast({
        title: 'Item Removed',
        description: `${arrayName.slice(0, -1)} removed successfully`,
      });
    },
    [getArrayInfo, dispatch, toast, enableFieldModification]
  );

  // Duplicate an existing array item
  const duplicateArrayItem = useCallback(
    (itemPath: string) => {
      const { parentArray, itemIndex, arrayPath, isValidArray } =
        getArrayInfo(itemPath);

      if (!isValidArray || itemIndex >= parentArray.length) {
        console.error(`Cannot duplicate item: invalid path ${itemPath}`);
        toast({
          title: 'Error',
          description: 'Cannot duplicate item: invalid path',
          variant: 'destructive',
        });
        return;
      }

      enableFieldModification(arrayPath);

      const itemToDuplicate = JSON.parse(
        JSON.stringify(parentArray[itemIndex])
      );

      dispatch({
        type: 'ADD_ARRAY_ITEM',
        arrayPath,
        item: itemToDuplicate,
      });

      const arrayName = arrayPath.split('.').pop() || 'items';
      toast({
        title: 'Item Duplicated',
        description: `${arrayName.slice(0, -1)} duplicated successfully`,
      });
    },
    [getArrayInfo, dispatch, toast, enableFieldModification]
  );

  // Check if an array item can be removed (has more than 1 item)
  const canRemoveArrayItem = useCallback(
    (itemPath: string) => {
      const { parentArray, isValidArray } = getArrayInfo(itemPath);
      return isValidArray && parentArray.length > 1;
    },
    [getArrayInfo]
  );

  // Get array length for a given path
  const getArrayLength = useCallback(
    (arrayPath: string) => {
      const array = getNestedValue(state, arrayPath);
      return Array.isArray(array) ? array.length : 0;
    },
    [state, getNestedValue]
  );

  return {
    addArrayItem,
    removeArrayItem,
    duplicateArrayItem,
    canRemoveArrayItem,
    getArrayLength,
    enableFieldModification,
  };
};
