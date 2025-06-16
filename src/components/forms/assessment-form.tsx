
import React, { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AssessmentFormSection from './assessment-form-section';

// Define the assessment schema interfaces
interface SetType {
  repetitions: string;
  load: string;
  unit: string;
}

interface DurationType {
  value: string;
  unit: string;
}

interface PlanType {
  exercise: string;
  comments: string;
  set: SetType;
  duration: DurationType;
}

interface PlanSectionType {
  advice: string;
  record: string;
  plans: PlanType[];
}

interface SubjectiveAssessmentType {
  assessment: string;
  record: string;
}

interface ObjectiveTestType {
  testName: string;
  unitName: string;
  value: string;
  left: string;
  right: string;
  comments: string;
}

interface ObjectiveAssessmentType {
  record: string;
  tests: ObjectiveTestType[];
}

interface RpeType {
  value: string;
  record: string;
}

interface AssessmentType {
  plan: PlanSectionType;
  subjectiveAssessment: SubjectiveAssessmentType;
  objectiveAssessment: ObjectiveAssessmentType;
  rpe: RpeType;
}

interface AssessmentFormProps {
  formData: AssessmentType;
  onChange: (data: AssessmentType) => void;
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

export const AssessmentForm: React.FC<AssessmentFormProps> = ({
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
  
  // Create deep copy for local state management
  const [assessment, setAssessment] = useState<AssessmentType>({...formData});
  
  // Update local state when props change
  useEffect(() => {
    setAssessment(formData);
  }, [formData]);

  // Propagate changes to parent
  const handleChange = useCallback((updatedAssessment: AssessmentType) => {
    setAssessment(updatedAssessment);
    onChange(updatedAssessment);
  }, [onChange]);

  // Helper function to update a specific field
  const updateField = (path: string, value: any) => {
    const pathParts = path.split('.');
    const newAssessment = {...assessment};
    
    let current: any = newAssessment;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      
      // Handle array indices
      if (part.includes('[') && part.includes(']')) {
        const arrayName = part.substring(0, part.indexOf('['));
        const index = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')), 10);
        
        current = current[arrayName][index];
      } else {
        current = current[part];
      }
    }
    
    current[pathParts[pathParts.length - 1]] = value;
    handleChange(newAssessment);
  };

  // Add a new plan
  const handleAddPlan = () => {
    const newPlan: PlanType = {
      exercise: "",
      comments: "",
      set: {
        repetitions: "",
        load: "",
        unit: ""
      },
      duration: {
        value: "",
        unit: ""
      }
    };
    
    const newAssessment = {...assessment};
    newAssessment.plan.plans.push(newPlan);
    handleChange(newAssessment);
    
    toast({
      title: "Plan Added",
      description: "New plan has been added",
    });
  };

  // Remove a plan
  const handleRemovePlan = (index: number) => {
    const newAssessment = {...assessment};
    newAssessment.plan.plans.splice(index, 1);
    handleChange(newAssessment);
    
    toast({
      title: "Plan Removed",
      description: "Plan has been removed",
    });
  };
  
  // Add a new objective test
  const handleAddObjectiveTest = () => {
    const newTest: ObjectiveTestType = {
      testName: "",
      unitName: "",
      value: "",
      left: "",
      right: "",
      comments: ""
    };
    
    const newAssessment = {...assessment};
    newAssessment.objectiveAssessment.tests.push(newTest);
    handleChange(newAssessment);
    
    toast({
      title: "Test Added",
      description: "New objective test has been added",
    });
  };

  // Remove an objective test
  const handleRemoveObjectiveTest = (index: number) => {
    const newAssessment = {...assessment};
    newAssessment.objectiveAssessment.tests.splice(index, 1);
    handleChange(newAssessment);
    
    toast({
      title: "Test Removed",
      description: "Objective test has been removed",
    });
  };

  return (
    <div className="space-y-6">
      {/* Plan Section */}
      <AssessmentFormSection
        title="Plan"
        sectionId="assessment.plan"
        onAudioEncoded={onAudioEncoded}
        onTranscriptProcess={onTranscriptProcess}
        isProcessing={isProcessing}
        selectable={true}
        selected={selectedSections.includes("assessment.plan")}
        onSelectChange={onSectionSelect}
        onSectionSubmit={onSectionSubmit}
        onSectionReset={onSectionReset}
        onAddItem={handleAddPlan}
      >
        <div className="space-y-4">
          {/* Advice */}
          <div className="space-y-2">
            <Label htmlFor="plan-advice">Advice</Label>
            <Textarea
              id="plan-advice"
              value={assessment.plan.advice}
              onChange={(e) => updateField('plan.advice', e.target.value)}
              placeholder="Enter advice"
              className="min-h-[100px]"
            />
          </div>
          
          {/* Plans Array */}
          <div className="space-y-4 mt-4">
            <Label>Exercise Plans</Label>
            {assessment.plan.plans.map((plan, index) => (
              <AssessmentFormSection
                key={index}
                title="Plan"
                sectionId={`assessment.plan.plans[${index}]`}
                isArrayItem={true}
                itemIndex={index}
                showAudioControls={false}
                onRemoveItem={() => handleRemovePlan(index)}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Exercise */}
                  <div className="space-y-2">
                    <Label htmlFor={`plan-exercise-${index}`}>Exercise</Label>
                    <Input
                      id={`plan-exercise-${index}`}
                      value={plan.exercise}
                      onChange={(e) => updateField(`plan.plans[${index}].exercise`, e.target.value)}
                      placeholder="Enter exercise name"
                    />
                  </div>
                  
                  {/* Comments */}
                  <div className="space-y-2">
                    <Label htmlFor={`plan-comments-${index}`}>Comments</Label>
                    <Input
                      id={`plan-comments-${index}`}
                      value={plan.comments}
                      onChange={(e) => updateField(`plan.plans[${index}].comments`, e.target.value)}
                      placeholder="Enter comments"
                    />
                  </div>
                </div>
                
                {/* Set */}
                <div className="mt-4">
                  <Label className="block mb-2">Set</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4 border-l-2 border-border">
                    {/* Repetitions */}
                    <div className="space-y-2">
                      <Label htmlFor={`plan-set-repetitions-${index}`}>Repetitions</Label>
                      <Input
                        id={`plan-set-repetitions-${index}`}
                        value={plan.set.repetitions}
                        onChange={(e) => updateField(`plan.plans[${index}].set.repetitions`, e.target.value)}
                        placeholder="Enter repetitions"
                      />
                    </div>
                    
                    {/* Load */}
                    <div className="space-y-2">
                      <Label htmlFor={`plan-set-load-${index}`}>Load</Label>
                      <Input
                        id={`plan-set-load-${index}`}
                        value={plan.set.load}
                        onChange={(e) => updateField(`plan.plans[${index}].set.load`, e.target.value)}
                        placeholder="Enter load"
                      />
                    </div>
                    
                    {/* Unit */}
                    <div className="space-y-2">
                      <Label htmlFor={`plan-set-unit-${index}`}>Unit</Label>
                      <Input
                        id={`plan-set-unit-${index}`}
                        value={plan.set.unit}
                        onChange={(e) => updateField(`plan.plans[${index}].set.unit`, e.target.value)}
                        placeholder="Enter unit"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Duration */}
                <div className="mt-4">
                  <Label className="block mb-2">Duration</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-border">
                    {/* Value */}
                    <div className="space-y-2">
                      <Label htmlFor={`plan-duration-value-${index}`}>Value</Label>
                      <Input
                        id={`plan-duration-value-${index}`}
                        value={plan.duration.value}
                        onChange={(e) => updateField(`plan.plans[${index}].duration.value`, e.target.value)}
                        placeholder="Enter duration value"
                      />
                    </div>
                    
                    {/* Unit */}
                    <div className="space-y-2">
                      <Label htmlFor={`plan-duration-unit-${index}`}>Unit</Label>
                      <Input
                        id={`plan-duration-unit-${index}`}
                        value={plan.duration.unit}
                        onChange={(e) => updateField(`plan.plans[${index}].duration.unit`, e.target.value)}
                        placeholder="Enter duration unit"
                      />
                    </div>
                  </div>
                </div>
              </AssessmentFormSection>
            ))}
          </div>
        </div>
      </AssessmentFormSection>

      {/* Subjective Assessment Section */}
      <AssessmentFormSection
        title="Subjective Assessment"
        sectionId="assessment.subjectiveAssessment"
        onAudioEncoded={onAudioEncoded}
        onTranscriptProcess={onTranscriptProcess}
        isProcessing={isProcessing}
        selectable={true}
        selected={selectedSections.includes("assessment.subjectiveAssessment")}
        onSelectChange={onSectionSelect}
        onSectionSubmit={onSectionSubmit}
        onSectionReset={onSectionReset}
      >
        <div className="space-y-4">
          {/* Assessment */}
          <div className="space-y-2">
            <Label htmlFor="subjective-assessment">Assessment</Label>
            <Textarea
              id="subjective-assessment"
              value={assessment.subjectiveAssessment.assessment}
              onChange={(e) => updateField('subjectiveAssessment.assessment', e.target.value)}
              placeholder="Enter subjective assessment"
              className="min-h-[100px]"
            />
          </div>
        </div>
      </AssessmentFormSection>

      {/* Objective Assessment Section */}
      <AssessmentFormSection
        title="Objective Assessment"
        sectionId="assessment.objectiveAssessment"
        onAudioEncoded={onAudioEncoded}
        onTranscriptProcess={onTranscriptProcess}
        isProcessing={isProcessing}
        selectable={true}
        selected={selectedSections.includes("assessment.objectiveAssessment")}
        onSelectChange={onSectionSelect}
        onSectionSubmit={onSectionSubmit}
        onSectionReset={onSectionReset}
        onAddItem={handleAddObjectiveTest}
      >
        <div className="space-y-4">
          {/* Tests Array */}
          {assessment.objectiveAssessment.tests.map((test, index) => (
            <AssessmentFormSection
              key={index}
              title="Test"
              sectionId={`assessment.objectiveAssessment.tests[${index}]`}
              isArrayItem={true}
              itemIndex={index}
              showAudioControls={false}
              onRemoveItem={() => handleRemoveObjectiveTest(index)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Test Name */}
                <div className="space-y-2">
                  <Label htmlFor={`test-name-${index}`}>Test Name</Label>
                  <Input
                    id={`test-name-${index}`}
                    value={test.testName}
                    onChange={(e) => updateField(`objectiveAssessment.tests[${index}].testName`, e.target.value)}
                    placeholder="Enter test name"
                  />
                </div>
                
                {/* Unit Name */}
                <div className="space-y-2">
                  <Label htmlFor={`unit-name-${index}`}>Unit Name</Label>
                  <Input
                    id={`unit-name-${index}`}
                    value={test.unitName}
                    onChange={(e) => updateField(`objectiveAssessment.tests[${index}].unitName`, e.target.value)}
                    placeholder="Enter unit name"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {/* Value */}
                <div className="space-y-2">
                  <Label htmlFor={`value-${index}`}>Value</Label>
                  <Input
                    id={`value-${index}`}
                    value={test.value}
                    onChange={(e) => updateField(`objectiveAssessment.tests[${index}].value`, e.target.value)}
                    placeholder="Enter value"
                  />
                </div>
                
                {/* Left */}
                <div className="space-y-2">
                  <Label htmlFor={`left-${index}`}>Left</Label>
                  <Input
                    id={`left-${index}`}
                    value={test.left}
                    onChange={(e) => updateField(`objectiveAssessment.tests[${index}].left`, e.target.value)}
                    placeholder="Enter left value"
                  />
                </div>
                
                {/* Right */}
                <div className="space-y-2">
                  <Label htmlFor={`right-${index}`}>Right</Label>
                  <Input
                    id={`right-${index}`}
                    value={test.right}
                    onChange={(e) => updateField(`objectiveAssessment.tests[${index}].right`, e.target.value)}
                    placeholder="Enter right value"
                  />
                </div>
              </div>
              
              {/* Comments */}
              <div className="space-y-2 mt-4">
                <Label htmlFor={`comments-${index}`}>Comments</Label>
                <Textarea
                  id={`comments-${index}`}
                  value={test.comments}
                  onChange={(e) => updateField(`objectiveAssessment.tests[${index}].comments`, e.target.value)}
                  placeholder="Enter comments"
                  rows={2}
                />
              </div>
            </AssessmentFormSection>
          ))}
        </div>
      </AssessmentFormSection>

      {/* RPE Section */}
      <AssessmentFormSection
        title="RPE"
        sectionId="assessment.rpe"
        onAudioEncoded={onAudioEncoded}
        onTranscriptProcess={onTranscriptProcess}
        isProcessing={isProcessing}
        selectable={true}
        selected={selectedSections.includes("assessment.rpe")}
        onSelectChange={onSectionSelect}
        onSectionSubmit={onSectionSubmit}
        onSectionReset={onSectionReset}
      >
        <div className="space-y-4">
          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="rpe-value">Value</Label>
            <Input
              id="rpe-value"
              value={assessment.rpe.value}
              onChange={(e) => updateField('rpe.value', e.target.value)}
              placeholder="Enter RPE value"
            />
          </div>
        </div>
      </AssessmentFormSection>

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
              className="flex items-center gap-2"
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

export default AssessmentForm;
