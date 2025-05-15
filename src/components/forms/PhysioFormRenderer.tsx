
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MinusCircle, PlusCircle, Save, RefreshCw } from 'lucide-react';
import FormSection from './FormSection';
import { TestValue } from '@/types/form';
import { useToast } from '@/hooks/use-toast';
import { themeColors } from '@/styles/theme';

interface PhysioFormRendererProps {
  formData: TestValue[];
  onChange: (data: TestValue[]) => void;
  onAudioEncoded?: (base64Audio: string, sectionId: string) => void;
  onTranscriptProcess?: (text: string, sectionId: string) => void;
  isProcessing?: boolean;
  selectedSections: string[];
  onSectionSelect: (sectionId: string, selected: boolean) => void;
  onSubmit?: () => void;
  onReset?: () => void;
  onSectionSubmit?: (sectionId: string) => void;
  onSectionReset?: (sectionId: string) => void;
}

const PhysioFormRenderer: React.FC<PhysioFormRendererProps> = ({
  formData,
  onChange,
  onAudioEncoded,
  onTranscriptProcess,
  isProcessing = false,
  selectedSections,
  onSectionSelect,
  onSubmit,
  onReset,
  onSectionSubmit,
  onSectionReset
}) => {
  const { toast } = useToast();
  
  // Add a new test
  const handleAddTest = () => {
    const newTest: TestValue = {
      testName: "",
      unitName: "",
      value: "",
      rightValue: "",
      leftValue: "",
      comments: ""
    };
    
    onChange([...formData, newTest]);
    toast({
      title: "Assessment Added",
      description: "New assessment has been added",
    });
  };

  // Remove a test
  const handleRemoveTest = (index: number) => {
    const newData = [...formData];
    newData.splice(index, 1);
    onChange(newData);
    toast({
      title: "Assessment Removed",
      description: "Assessment has been removed",
    });
  };

  // Update a field in a test
  const handleUpdateField = (index: number, field: keyof TestValue, value: string | number) => {
    const newData = [...formData];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      {formData.map((test, index) => {
        const sectionId = `physio-test-${index}`;
        const isSelected = selectedSections.includes(sectionId);
        
        return (
          <FormSection
            key={sectionId}
            title={`Assessment ${index + 1}`}
            sectionId={sectionId}
            onAudioEncoded={onAudioEncoded}
            onTranscriptProcess={onTranscriptProcess}
            isProcessing={isProcessing}
            selectable={formData.length > 1}
            selected={isSelected}
            onSelectChange={onSectionSelect}
            onSectionSubmit={onSectionSubmit ? () => onSectionSubmit(sectionId) : undefined}
            onSectionReset={onSectionReset ? () => onSectionReset(sectionId) : undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label htmlFor={`testName-${index}`} className="block text-sm font-medium">Test Name</label>
                <input
                  id={`testName-${index}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={test.testName || ''}
                  onChange={(e) => handleUpdateField(index, 'testName', e.target.value)}
                  placeholder="Enter test name"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor={`unitName-${index}`} className="block text-sm font-medium">Unit Name</label>
                <input
                  id={`unitName-${index}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={test.unitName || ''}
                  onChange={(e) => handleUpdateField(index, 'unitName', e.target.value)}
                  placeholder="Enter unit of measurement"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label htmlFor={`value-${index}`} className="block text-sm font-medium">Value</label>
                <input
                  id={`value-${index}`}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={test.value || ''}
                  onChange={(e) => handleUpdateField(index, 'value', e.target.value)}
                  placeholder="Enter value"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor={`leftValue-${index}`} className="block text-sm font-medium">Left Value</label>
                <input
                  id={`leftValue-${index}`}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={test.leftValue || ''}
                  onChange={(e) => handleUpdateField(index, 'leftValue', e.target.value)}
                  placeholder="Enter left value"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor={`rightValue-${index}`} className="block text-sm font-medium">Right Value</label>
                <input
                  id={`rightValue-${index}`}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  value={test.rightValue || ''}
                  onChange={(e) => handleUpdateField(index, 'rightValue', e.target.value)}
                  placeholder="Enter right value"
                />
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <label htmlFor={`comments-${index}`} className="block text-sm font-medium">Comments</label>
              <textarea
                id={`comments-${index}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                value={test.comments || ''}
                onChange={(e) => handleUpdateField(index, 'comments', e.target.value)}
                placeholder="Enter any comments"
                rows={3}
              />
            </div>
            
            {formData.length > 1 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveTest(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <MinusCircle className="h-4 w-4 mr-1" />
                  Remove Assessment
                </Button>
              </div>
            )}
          </FormSection>
        );
      })}
      
      {/* Add new test button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAddTest}
          variant="outline"
          className="flex items-center gap-1 border-dashed border-primary"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add Assessment</span>
        </Button>
      </div>

      {/* Form action buttons */}
      {(onSubmit || onReset) && (
        <div className="flex justify-end space-x-4 mt-8">
          {onReset && (
            <Button 
              variant="outline" 
              onClick={onReset}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Form
            </Button>
          )}
          
          {onSubmit && (
            <Button 
              variant="default"
              onClick={onSubmit}
              className="flex items-center gap-2 bg-primary text-white hover:bg-primary-dark"
            >
              <Save className="h-4 w-4" />
              Submit Form
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PhysioFormRenderer;
