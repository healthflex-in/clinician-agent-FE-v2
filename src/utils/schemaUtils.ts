
/**
 * Generates initial default state from a schema
 * Preserves structure while initializing with empty/zero values
 */
export function defaultStateFromSchema(schema: any): any {
  if (schema === null || schema === undefined) return null;
  
  // Handle primitive types
  if (typeof schema !== 'object') return schema;
  
  // Handle arrays
  if (Array.isArray(schema)) {
    if (schema.length === 0) return [];
    // Use first item as template for array items
    return [defaultStateFromSchema(schema[0])];
  }
  
  // Handle objects
  const result: Record<string, any> = {};
  for (const key in schema) {
    result[key] = defaultStateFromSchema(schema[key]);
  }
  return result;
}

/**
 * Flattens nested object structure into dot notation
 * Example: { user: { name: 'John' }} → { 'user.name': 'John' }
 */
export function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Unflattens dot notation back to nested object
 * Example: { 'user.name': 'John' } → { user: { name: 'John' }}
 */
export function unflattenObject(flatObj: Record<string, any>): any {
  const result: Record<string, any> = {};
  
  for (const key in flatObj) {
    const value = flatObj[key];
    const keys = key.split('.');
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) current[k] = {};
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  return result;
}

/**
 * Gets a nested value from an object using a dot-notation path
 */
export function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array indices in the path
    if (Array.isArray(current) && !isNaN(Number(key))) {
      current = current[Number(key)];
    } else {
      current = current[key];
    }
  }
  
  return current;
}

/**
 * Deep updates a nested object without mutation
 * Handles array indexes in path (e.g., 'plans.0.exercise')
 */
export function deepUpdateObject(obj: any, path: string, value: any): any {
  if (!path) return value;
  
  const keys = path.split('.');
  const key = keys[0];
  
  // Base case: last key in path
  if (keys.length === 1) {
    if (Array.isArray(obj)) {
      const index = parseInt(key, 10);
      return [
        ...obj.slice(0, index),
        value,
        ...obj.slice(index + 1)
      ];
    } else {
      return { ...obj, [key]: value };
    }
  }
  
  // Recursive case
  const remainingPath = keys.slice(1).join('.');
  
  if (obj === undefined || obj === null) {
    // If current object is undefined/null, create a new object
    const nextIsArray = !isNaN(parseInt(keys[1], 10));
    const newObj = nextIsArray ? [] : {};
    return {
      [key]: deepUpdateObject(newObj, remainingPath, value)
    };
  }
  
  if (Array.isArray(obj)) {
    const index = parseInt(key, 10);
    return [
      ...obj.slice(0, index),
      deepUpdateObject(obj[index], remainingPath, value),
      ...obj.slice(index + 1)
    ];
  } else {
    return {
      ...obj,
      [key]: deepUpdateObject(obj[key], remainingPath, value)
    };
  }
}

/**
 * Finds differences between two objects and returns paths that differ
 */
export function findDifferences(obj1: any, obj2: any, path: string = ''): string[] {
  const differences: string[] = [];
  
  // Compare primitive fields
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    if (obj1 !== obj2) {
      differences.push(path);
    }
    return differences;
  }
  
  // Handle null values
  if (obj1 === null || obj2 === null) {
    if (obj1 !== obj2) {
      differences.push(path);
    }
    return differences;
  }
  
  // Compare object fields recursively
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj1) || !(key in obj2)) {
      differences.push(keyPath);
      continue;
    }
    
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      // For arrays, compare each item
      const maxLength = Math.max(obj1[key].length, obj2[key].length);
      for (let i = 0; i < maxLength; i++) {
        if (i >= obj1[key].length || i >= obj2[key].length) {
          differences.push(`${keyPath}.${i}`);
          continue;
        }
        
        const itemDiffs = findDifferences(obj1[key][i], obj2[key][i], `${keyPath}.${i}`);
        differences.push(...itemDiffs);
      }
    } else if (typeof obj1[key] === 'object' && obj1[key] !== null && 
               typeof obj2[key] === 'object' && obj2[key] !== null) {
      // For objects
      const nestedDiffs = findDifferences(obj1[key], obj2[key], keyPath);
      differences.push(...nestedDiffs);
    } else if (obj1[key] !== obj2[key]) {
      // For primitives
      differences.push(keyPath);
    }
  }
  
  return differences;
}
