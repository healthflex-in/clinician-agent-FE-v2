
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MinusCircle, PlusCircle } from 'lucide-react';
import FormSection from './FormSection';
import { TestValue } from '@/types/form';

interface PhysioFormRendererProps {
  formData: TestValue[];
  onChange: (data: TestValue[]) => void;
  onAudioEncoded?: (base64Audio: string, sectionId: string) => void;
  onTranscriptProcess?: (text: string, sectionId: string) => void;
  isProcessing?: boolean;
  selectedSections: string[];
  onSectionSelect: (sectionId: string, selected: boolean) => void;
}

const PhysioFormRenderer: React.FC<PhysioFormRendererProps> = ({
  formData,
  onChange,
  onAudioEncoded,
  onTranscriptProcess,
  isProcessing = false,
  selectedSections,
  onSectionSelect
}) => {
  
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
  };

  // Remove a test
  const handleRemoveTest = (index: number) => {
    const newData = [...formData];
    newData.splice(index, 1);
    onChange(newData);
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
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor={`testName-${index}`}>Test Name</Label>
                <Input
                  id={`testName-${index}`}
                  value={test.testName || ''}
                  onChange={(e) => handleUpdateField(index, 'testName', e.target.value)}
                  placeholder="Enter test name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`unitName-${index}`}>Unit Name</Label>
                <Input
                  id={`unitName-${index}`}
                  value={test.unitName || ''}
                  onChange={(e) => handleUpdateField(index, 'unitName', e.target.value)}
                  placeholder="Enter unit of measurement"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor={`value-${index}`}>Value</Label>
                <Input
                  id={`value-${index}`}
                  type="text"
                  value={test.value || ''}
                  onChange={(e) => handleUpdateField(index, 'value', e.target.value)}
                  placeholder="Enter value"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`leftValue-${index}`}>Left Value</Label>
                <Input
                  id={`leftValue-${index}`}
                  type="text"
                  value={test.leftValue || ''}
                  onChange={(e) => handleUpdateField(index, 'leftValue', e.target.value)}
                  placeholder="Enter left value"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`rightValue-${index}`}>Right Value</Label>
                <Input
                  id={`rightValue-${index}`}
                  type="text"
                  value={test.rightValue || ''}
                  onChange={(e) => handleUpdateField(index, 'rightValue', e.target.value)}
                  placeholder="Enter right value"
                />
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <Label htmlFor={`comments-${index}`}>Comments</Label>
              <Textarea
                id={`comments-${index}`}
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
    </div>
  );
};

export default PhysioFormRenderer;
