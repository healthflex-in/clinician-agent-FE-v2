
// Only modifying the section that controls scrolling behavior
import React, { useReducer, useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { defaultStateFromSchema, deepUpdateObject, getNestedValue, findDifferences } from '@/utils/schemaUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MinusCircle, PlusCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FormRendererProps {
  schema: any;
  formKey: string;
  formData?: any;
  onChange?: (data: any) => void;
  onLLMUpdate?: (data: any) => void;
}

// Action types for the reducer
type FormAction = 
  | { type: 'UPDATE_FIELD'; path: string; value: any }
  | { type: 'ADD_ARRAY_ITEM'; path: string; template: any }
  | { type: 'REMOVE_ARRAY_ITEM'; path: string; index: number }
  | { type: 'RESET_FORM'; data: any }
  | { type: 'MERGE_LLM_DATA'; data: any; source: 'llm' };

// Type for the form renderer ref
export interface FormRendererRef {
  updateFormWithLLMData: (llmData: any) => void;
}

const FormRenderer = forwardRef<FormRendererRef, FormRendererProps>(({ 
  schema, 
  formKey,
  formData, 
  onChange,
  onLLMUpdate
}, ref) => {
  // Track which fields were updated by LLM
  const [llmUpdatedFields, setLlmUpdatedFields] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Initialize form state from schema or provided formData
  const initialState = formData || defaultStateFromSchema(schema);

  // Reducer function to handle form state updates
  const formReducer = (state: any, action: FormAction): any => {
    switch (action.type) {
      case 'UPDATE_FIELD':
        return deepUpdateObject(state, action.path, action.value);
      case 'ADD_ARRAY_ITEM':
        const currentArray = getNestedValue(state, action.path) || [];
        return deepUpdateObject(
          state, 
          action.path, 
          [...currentArray, defaultStateFromSchema(action.template)]
        );
      case 'REMOVE_ARRAY_ITEM':
        const array = getNestedValue(state, action.path) || [];
        return deepUpdateObject(
          state,
          action.path,
          array.filter((_: any, i: number) => i !== action.index)
        );
      case 'RESET_FORM':
        return action.data;
      case 'MERGE_LLM_DATA':
        // Find differences between current state and incoming LLM data
        const differences = findDifferences(state, action.data);
        
        // Update LLM fields tracking only if the source is LLM
        if (action.source === 'llm' && differences.length > 0) {
          setLlmUpdatedFields(prev => {
            const newSet = new Set(prev);
            differences.forEach(field => newSet.add(field));
            return newSet;
          });
          
          // Show toast notification for LLM updates
          toast({
            title: "Form Updated by AI",
            description: `${differences.length} field(s) were updated`,
          });
        }
        
        // Merge the LLM data with current state
        return { ...state, ...action.data };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(formReducer, initialState);

  // Method for LLM to update form data
  const updateFormWithLLMData = useCallback((llmData: any) => {
    // Check if there are suggestions in the data
    if (llmData.suggestions) {
      setSuggestions(llmData.suggestions);
      
      // Auto-hide suggestions after 7 seconds
      setTimeout(() => {
        setSuggestions(null);
      }, 7000);
    }
    
    dispatch({ 
      type: 'MERGE_LLM_DATA', 
      data: llmData,
      source: 'llm'
    });
    
    // Notify parent component about LLM update
    if (onLLMUpdate) onLLMUpdate(llmData);
  }, [onLLMUpdate]);
  
  // Expose the LLM update method to the parent via ref
  useImperativeHandle(ref, () => ({
    updateFormWithLLMData
  }));

  // Notify parent component when form data changes
  useEffect(() => {
    if (onChange) onChange(state);
  }, [state, onChange]);

  // Field change handler
  const handleChange = useCallback((path: string, value: any) => {
    // When user changes a field, remove it from the LLM updated fields list
    setLlmUpdatedFields(prev => {
      const newSet = new Set(prev);
      newSet.delete(path);
      return newSet;
    });
    
    dispatch({ type: 'UPDATE_FIELD', path, value });
  }, []);

  // Add array item handler
  const handleAddArrayItem = useCallback((path: string, template: any) => {
    dispatch({ type: 'ADD_ARRAY_ITEM', path, template });
  }, []);

  // Remove array item handler
  const handleRemoveArrayItem = useCallback((path: string, index: number) => {
    dispatch({ type: 'REMOVE_ARRAY_ITEM', path, index });
  }, []);

  // Accept all LLM changes
  const acceptAllLLMChanges = useCallback(() => {
    setLlmUpdatedFields(new Set());
    toast({
      title: "Changes Accepted",
      description: "All AI suggestions have been accepted",
    });
  }, [toast]);
  
  // Reject specific LLM change
  const rejectLLMChange = useCallback((path: string) => {
    // Remove the path from LLM updated fields
    setLlmUpdatedFields(prev => {
      const newSet = new Set(prev);
      newSet.delete(path);
      return newSet;
    });
  }, []);

  // Determine the appropriate input field type based on the data type
  const renderInputForType = (
    type: string, 
    value: any, 
    path: string, 
    isLLMUpdated: boolean,
    placeholder?: string
  ) => {
    const baseClassName = isLLMUpdated 
      ? "border-yellow-400 bg-yellow-50" 
      : "";
    
    switch(type) {
      case 'number':
        return (
          <div className="relative">
            <Input
              type="number"
              value={value === null || value === undefined ? '' : value}
              onChange={(e) => handleChange(path, Number(e.target.value))}
              className={baseClassName}
              placeholder={placeholder}
            />
            {isLLMUpdated && (
              <button 
                onClick={() => rejectLLMChange(path)} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Reject this AI suggestion"
              >
                <MinusCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      case 'textarea':
        return (
          <div className="relative">
            <Textarea
              value={value || ''}
              onChange={(e) => handleChange(path, e.target.value)}
              className={baseClassName}
              placeholder={placeholder}
            />
            {isLLMUpdated && (
              <button 
                onClick={() => rejectLLMChange(path)} 
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                title="Reject this AI suggestion"
              >
                <MinusCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      default: // string or any other type
        return (
          <div className="relative">
            <Input
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(path, e.target.value)}
              className={baseClassName}
              placeholder={placeholder}
            />
            {isLLMUpdated && (
              <button 
                onClick={() => rejectLLMChange(path)} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Reject this AI suggestion"
              >
                <MinusCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        );
    }
  };

  // Render a field based on its type (string, number, object, array)
  const renderField = (fieldSchema: any, path: string, fieldName: string, parentIsArray: boolean = false): JSX.Element => {
    // Skip "record" fields as requested
    if (fieldName === 'record') {
      return <></>; // Return empty fragment to skip rendering
    }
    
    // Get current value from state
    const value = path ? getNestedValue(state, path) : state;
    
    // Check if this field was updated by LLM
    const isLLMUpdated = llmUpdatedFields.has(path);
    
    // Skip rendering the "root" field label
    if (fieldName === 'root') {
      return (
        <div className="space-y-4">
          {Object.entries(fieldSchema).map(([key, nestedSchema]) => (
            <div key={key} className="mb-4">
              {renderField(
                nestedSchema,
                path ? `${path}.${key}` : key,
                key
              )}
            </div>
          ))}
        </div>
      );
    }
    
    // Handle different field types
    if (Array.isArray(fieldSchema)) {
      // It's an array of items
      const arrayPlaceholder = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
      
      return (
        <div className={`mb-6 ${isLLMUpdated ? 'p-2 border-2 border-yellow-300 rounded' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-lg font-semibold">{arrayPlaceholder}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => handleAddArrayItem(path, fieldSchema[0])}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add {parentIsArray ? 'Item' : arrayPlaceholder}</span>
            </Button>
          </div>
          
          <div className="space-y-4">
            {value?.map((item: any, index: number) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">{arrayPlaceholder} {index + 1}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveArrayItem(path, index)}
                    >
                      <MinusCircle className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                  
                  {/* Render each field in the array item */}
                  <div className="space-y-3">
                    {Object.entries(fieldSchema[0] || {}).map(([key, subSchema]) => (
                      <div key={key} className="mb-4">
                        {renderField(
                          subSchema,
                          `${path}.${index}.${key}`,
                          key,
                          true
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {(!value || value.length === 0) && (
              <div className="text-center py-4 text-muted-foreground">
                No {arrayPlaceholder.toLowerCase()} added yet
              </div>
            )}
          </div>
        </div>
      );
    } else if (typeof fieldSchema === 'object' && fieldSchema !== null) {
      // It's an object (nested fields)
      const sectionName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
      
      return (
        <div className={`mb-6 ${isLLMUpdated ? 'p-2 border-2 border-yellow-300 rounded' : ''}`}>
          {!parentIsArray && (
            <Label className="text-lg font-semibold mb-2 block">{sectionName}</Label>
          )}
          
          <div className={parentIsArray ? '' : 'pl-2 border-l-2 border-border'}>
            {Object.entries(fieldSchema).map(([key, nestedSchema]) => (
              <div key={key} className="mb-4">
                {renderField(
                  nestedSchema,
                  path ? `${path}.${key}` : key,
                  key
                )}
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      // It's a primitive field (string, number, etc.)
      const fieldType = typeof fieldSchema;
      const labelText = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
      
      return (
        <div className={`mb-4 ${isLLMUpdated ? 'transition-all duration-300' : ''}`}>
          <Label htmlFor={path} className="block mb-1">
            {labelText}
          </Label>
          
          {fieldName.toLowerCase().includes('comment') || fieldName.toLowerCase().includes('advice') ? 
            renderInputForType('textarea', value, path, isLLMUpdated, `Enter ${labelText.toLowerCase()}`) :
            renderInputForType(fieldType, value, path, isLLMUpdated, `Enter ${labelText.toLowerCase()}`)}
        </div>
      );
    }
  };

  // Reset form to initial state
  const handleResetForm = () => {
    // Ask for confirmation
    if (confirm("Are you sure you want to reset this form? All your data will be lost.")) {
      // Reset to initial state based on schema
      dispatch({ type: 'RESET_FORM', data: defaultStateFromSchema(schema) });
      setLlmUpdatedFields(new Set());
      toast({
        title: "Form Reset",
        description: "All form data has been reset to default values",
      });
    }
  };

  return (
    <div className="w-full">
      {suggestions && (
        <Alert variant="default" className="mb-6 bg-slate-900 text-white border-slate-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Suggestions</AlertTitle>
          <AlertDescription>
            <div className="text-sm whitespace-pre-wrap max-h-16 overflow-y-auto">
              {typeof suggestions === 'string' && suggestions.includes('[') && suggestions.includes(']') ? 
                (() => {
                  try {
                    // Try to parse as JSON if it looks like JSON
                    const suggestionsText = suggestions.substring(
                      suggestions.indexOf('['),
                      suggestions.lastIndexOf(']') + 1
                    );
                    const parsedSuggestions = JSON.parse(suggestionsText);
                    // Show only the first two suggestions
                    const limitedSuggestions = parsedSuggestions.slice(0, 2);
                    
                    return (
                      <ul className="list-disc pl-5">
                        {limitedSuggestions.map((suggestion: string, index: number) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    );
                  } catch (e) {
                    // If parsing fails, show as regular text
                    return suggestions;
                  }
                })() 
                : suggestions
              }
            </div>
          </AlertDescription>
        </Alert>
      )}
    
      {llmUpdatedFields.size > 0 && (
        <Card className="mb-6 bg-yellow-50 border-yellow-300">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">AI suggested {llmUpdatedFields.size} update{llmUpdatedFields.size > 1 ? 's' : ''}</h3>
                <p className="text-sm text-muted-foreground">Review highlighted fields</p>
              </div>
              <Button onClick={acceptAllLLMChanges} variant="default" size="sm">
                Accept All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="space-y-4">
        {renderField(schema, '', 'root')}
      </div>
      
      {/* Form action buttons */}
      <div className="flex justify-end space-x-4 mt-8">
        <Button 
          variant="outline" 
          onClick={handleResetForm}
          className="flex items-center gap-2"
        >
          Reset Form
        </Button>
      </div>
    </div>
  );
});

FormRenderer.displayName = 'FormRenderer';

export default FormRenderer;
