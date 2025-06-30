import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getNestedValue } from '@/utils/schema-utils';
import { FORM_SECTIONS } from '@/constants';
import { InputField } from './form-renderer.components';
import { ArrayItemControls } from '@/components/forms/array-item-controls';
import {
  isPlanPath,
  isTestPath,
  shouldHaveAudioRecording,
} from '@/utils/form-renderer.utils';

export interface FieldRenderersProps {
  state: any;
  formKey: string;
  llmUpdatedFields: Set<string>;
  handleUserChange: (path: string, value: any) => void;
  rejectLLMChange: (path: string) => void;
  handleResetField: (path: string) => void;
  addArrayItem: (path: string) => void;
  removeArrayItem: (path: string) => void;
  canRemoveArrayItem: (path: string) => boolean;
  renderTestTranscriptionBox: (testPath: string) => JSX.Element;
}

export const useFieldRenderers = (props: FieldRenderersProps) => {
  const {
    state,
    formKey,
    llmUpdatedFields,
    handleUserChange,
    rejectLLMChange,
    handleResetField,
    addArrayItem,
    removeArrayItem,
    canRemoveArrayItem,
    renderTestTranscriptionBox,
  } = props;

  // Determine the appropriate input field type based on the data type
  const renderInputForType = React.useCallback(
    (
      type: string,
      value: any,
      path: string,
      isLLMUpdated: boolean,
      placeholder?: string
    ) => {
      return (
        <InputField
          key={path} // Add key to prevent recreation
          type={type}
          value={value}
          path={path}
          isLLMUpdated={isLLMUpdated}
          placeholder={placeholder}
          onChange={handleUserChange} // Changed from handleChange for auto-submit cancellation
          onRejectLLMChange={rejectLLMChange}
        />
      );
    },
    [handleUserChange, rejectLLMChange]
  );

  // Render a field based on its type (string, number, object, array)
  const renderField = React.useCallback(
    (
      fieldSchema: any,
      path: string,
      fieldName: string,
      parentIsArray: boolean = false
    ): JSX.Element => {
      // Skip "record" fields as requested
      if (fieldName === 'record') {
        return <></>;
      }

      // Get current value from state
      const value = path ? getNestedValue(state, path) : state;

      // Check if this field was updated by LLM
      const isLLMUpdated = llmUpdatedFields.has(path);

      // Check if this section should have audio recording
      const isTopLevelSection = shouldHaveAudioRecording(path, formKey);

      // Check if this is a plan that should have audio recording
      const isPlan = isPlanPath(path, formKey);

      // Check if this is a test that should have audio recording (for Physio forms)
      const isTest = isTestPath(path, formKey);

      // Skip rendering the "root" field label
      if (fieldName === 'root') {
        return (
          <div className="space-y-2">
            {/* Only render main form sections from FORM_SECTIONS */}
            {Object.entries(fieldSchema)
              .filter(([key, _]) => {
                const sections =
                  FORM_SECTIONS[formKey as keyof typeof FORM_SECTIONS] || [];
                return sections.includes(key);
              })
              .map(([key, nestedSchema]) => (
                <div key={key} className="mb-3">
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
        const arrayPlaceholder =
          fieldName.charAt(0).toUpperCase() +
          fieldName
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();

        return (
          <div
            className={`mb-4 ${
              isLLMUpdated ? 'p-2 border-2 border-yellow-300 rounded' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">
                  {arrayPlaceholder}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-full touch-manipulation"
                  onClick={() => handleResetField(path)}
                  title="Reset this section"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Reset section</span>
                </Button>
              </div>

              {/* UPDATED: Use new ArrayItemControls for adding */}
              <ArrayItemControls
                itemPath={`${path}.0`} // dummy path for add button
                arrayPath={path}
                canRemove={false} // not applicable for add button
                onAdd={addArrayItem}
                onRemove={() => {}} // not used
                addButtonText={`Add ${
                  parentIsArray ? 'Item' : arrayPlaceholder.slice(0, -1)
                }`}
                className=""
                showOnlyAdd={true}
              />
            </div>

            <div className="space-y-3">
              {value?.map((item: any, index: number) => {
                const itemPath = `${path}.${index}`;
                const isItemPlan = isPlanPath(itemPath, formKey);
                const isItemTest = isTestPath(itemPath, formKey);

                return (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-2 form-card-content">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-xs">
                          {arrayPlaceholder} {index + 1}
                        </h3>

                        {/* UPDATED: Use new ArrayItemControls for removing */}
                        <ArrayItemControls
                          itemPath={itemPath}
                          arrayPath={path}
                          canRemove={canRemoveArrayItem(itemPath)}
                          onAdd={() => {}} // not used here
                          onRemove={removeArrayItem}
                          removeButtonText="Remove"
                          showOnlyRemove={true}
                          variant="compact"
                        />
                      </div>

                      {/* Add transcription box for individual tests (Physio forms) */}
                      {isItemTest && renderTestTranscriptionBox(itemPath)}

                      {/* Render each field in the array item */}
                      <div className="space-y-2">
                        {Object.entries(fieldSchema[0] || {}).map(
                          ([key, subSchema]) => (
                            <div key={key} className="mb-2">
                              {renderField(
                                subSchema,
                                `${path}.${index}.${key}`,
                                key,
                                true
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {(!value || value.length === 0) && (
                <div className="text-center py-2 text-muted-foreground text-xs">
                  No {arrayPlaceholder.toLowerCase()} added yet
                </div>
              )}
            </div>
          </div>
        );
      } else if (typeof fieldSchema === 'object' && fieldSchema !== null) {
        // It's an object (nested fields)
        const sectionName =
          fieldName.charAt(0).toUpperCase() +
          fieldName
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();

        return (
          <div
            className={`mb-4 ${
              isLLMUpdated ? 'p-2 border-2 border-yellow-300 rounded' : ''
            }`}
          >
            {!parentIsArray && (
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-base font-semibold block">
                  {sectionName}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-full touch-manipulation"
                  onClick={() => handleResetField(path)}
                  title="Reset this section"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Reset section</span>
                </Button>
              </div>
            )}
            <div
              className={parentIsArray ? '' : 'pl-2 border-l-2 border-border'}
            >
              {Object.entries(fieldSchema).map(([key, nestedSchema]) => (
                <div key={key} className="mb-2">
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
        const labelText =
          fieldName.charAt(0).toUpperCase() +
          fieldName
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();

        return (
          <div
            className={`mb-3 ${
              isLLMUpdated ? 'transition-all duration-300' : ''
            }`}
            key={`field-${path}`} // Stable key to prevent recreation
          >
            <Label htmlFor={path} className="block mb-1 text-sm">
              {labelText}
            </Label>

            {fieldName.toLowerCase().includes('comment') ||
            fieldName.toLowerCase().includes('advice') ||
            fieldName.toLowerCase().includes('notes') ||
            fieldName.toLowerCase().includes('description')
              ? renderInputForType(
                  'textarea',
                  value,
                  path,
                  isLLMUpdated,
                  `Enter ${labelText.toLowerCase()}`
                )
              : renderInputForType(
                  fieldType,
                  value,
                  path,
                  isLLMUpdated,
                  `Enter ${labelText.toLowerCase()}`
                )}
          </div>
        );
      }
    },
    [
      state,
      formKey,
      llmUpdatedFields,
      handleResetField,
      addArrayItem,
      canRemoveArrayItem,
      removeArrayItem,
      renderTestTranscriptionBox,
      renderInputForType,
    ]
  );

  return {
    renderField,
    renderInputForType,
  };
};
