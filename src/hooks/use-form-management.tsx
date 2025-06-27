import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { graphqlRequest } from '@/utils/graphql-client';
import { createAgentReport } from '../utils/api';
import { normalizeObjectiveAssessment } from '@/utils/form-renderer.utils';

type UseFormManagementProps = {
  formKey: string;
  patientId: string;
  appointmentId: string;
};

type UseFormManagementReturn = {
  formData: any;
  patientName: string;
  isSubmitting: boolean;
  reportId: string | null;
  isInitialLoadComplete: boolean;

  handleFormReset: () => void;
  setFormData: (data: any) => void;
  handleFormSubmit: () => Promise<void>;
  handleFormChange: (newFormData: any) => void;
};

export const useFormManagement = ({
  formKey,
  patientId,
  appointmentId,
}: UseFormManagementProps): UseFormManagementReturn => {
  const [formData, setFormData] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reportId, setReportId] = React.useState<string | null>(null);
  const [patientName, setPatientName] = React.useState<string>('Patient');
  const [isInitialLoadComplete, setIsInitialLoadComplete] =
    React.useState(false);

  const { toast } = useToast();

  // Store formKey, patientId and appointmentId in localStorage for WebSocket access
  React.useEffect(() => {
    if (formKey) localStorage.setItem('formKey', formKey);
    if (patientId) localStorage.setItem('userId', patientId);
    if (appointmentId) localStorage.setItem('appointmentId', appointmentId);
  }, [formKey, patientId, appointmentId]);

  // FAST: Get patient name from localStorage immediately (no API call needed)
  React.useEffect(() => {
    const storedPatient = localStorage.getItem('selectedPatient');
    if (storedPatient) {
      try {
        const patientData = JSON.parse(storedPatient);
        if (patientData && patientData.name) {
          setPatientName(patientData.name);
        }
      } catch (e) {
        console.warn('Failed to parse stored patient data');
      }
    }
  }, []);

  // MAIN: Create initial report (only API call we need to wait for)
  React.useEffect(() => {
    const createInitialReport = async () => {
      if (!patientId || !appointmentId) {
        setFormData(null); // null means use schema defaults
        setIsInitialLoadComplete(true);
        return;
      }

      try {
        console.log('Starting createAgentReport API call...');
        const startTime = Date.now();

        const centerId =
          localStorage.getItem('centerId') || '67fe35f25e42152fb5185a5e';
        const variables = {
          patient: patientId,
          center: centerId,
          appointment: appointmentId,
        };

        const result = await createAgentReport(variables);
        console.log(
          `API response received in ${Date.now() - startTime}ms:`,
          result
        );

        if (
          result &&
          result.createAgentReport &&
          result.createAgentReport._id
        ) {
          setReportId(result.createAgentReport._id);
          toast({
            title: 'Report Created',
            description: 'New report initialized successfully',
          });

          // Handle SNC form data transformation
          if (
            formKey === 'snc' &&
            result.createAgentReport.assessment &&
            result.createAgentReport.assessment.plan
          ) {
            console.log('Processing SNC form data...');
            // Transform 'set' to 'sets' for each plan
            const plan = result.createAgentReport.assessment.plan;
            const transformedPlan = {
              ...plan,
              plans: Array.isArray(plan.plans)
                ? plan.plans.map((p) => {
                    let sets = [];
                    if (Array.isArray(p.set)) {
                      sets = p.set;
                    } else if (p.set) {
                      sets = [p.set];
                    }
                    // Remove 'set' and add 'sets'
                    const { set, ...rest } = p;
                    return { ...rest, sets };
                  })
                : [],
            };
            console.log('Setting SNC form data:', transformedPlan);
            setFormData(transformedPlan);
          }
          // Handle assessment form data transformation
          else if (
            formKey === 'assessment' &&
            result.createAgentReport.assessment
          ) {
            console.log('Processing assessment form data...');
            const assessmentData = result.createAgentReport.assessment;

            // Inline normalization for objectiveAssessment
            let objectiveAssessmentData: { tests: any[] } = { tests: [] };
            const input = assessmentData.objectiveAssessment;
            if (!input) {
              objectiveAssessmentData = { tests: [] };
            } else if (Array.isArray(input)) {
              if (input.length > 0 && input[0].tests) {
                objectiveAssessmentData = { tests: input[0].tests };
              } else {
                objectiveAssessmentData = { tests: input };
              }
            } else if (input.tests && Array.isArray(input.tests)) {
              objectiveAssessmentData = { tests: input.tests };
            } else {
              objectiveAssessmentData = { tests: [] };
            }

            // Transform the assessment data structure
            const transformedAssessment = {
              plan: {
                advice: assessmentData.plan?.advice || '',
                plans: Array.isArray(assessmentData.plan?.plans)
                  ? assessmentData.plan.plans.map((p) => {
                      let sets = [];
                      // Transform 'set' array to 'sets' array
                      if (Array.isArray(p.set)) {
                        sets = p.set;
                      } else if (p.set) {
                        sets = [p.set];
                      }
                      // Remove 'set' and add 'sets'
                      const { set, ...rest } = p;
                      return { ...rest, sets };
                    })
                  : [
                      {
                        exercise: '',
                        comments: '',
                        sets: [
                          {
                            repetitions: 0,
                            load: '',
                            unit: '',
                          },
                        ],
                        duration: {
                          value: 0,
                          unit: '',
                        },
                      },
                    ],
              },
              subjectiveAssessment: {
                assessment:
                  assessmentData.subjectiveAssessment?.assessment || '',
              },
              objectiveAssessment: objectiveAssessmentData,
              rpe: {
                value: assessmentData.rpe?.value || 0,
              },
            };

            console.log('Setting assessment form data:', transformedAssessment);
            setFormData(transformedAssessment);
          }
          // Handle other form types
          else if (result.createAgentReport[formKey]) {
            console.log(
              `Setting ${formKey} form data:`,
              result.createAgentReport[formKey]
            );
            setFormData(result.createAgentReport[formKey]);
          } else {
            console.log(
              'No data returned for this form key, using schema defaults'
            );
            // No data returned for this form key, set to null so FormRenderer uses schema
            setFormData(null);
          }
        } else {
          console.log('No report created, using schema defaults');
          // No report created, set to null so FormRenderer uses schema
          setFormData(null);
        }
      } catch (error) {
        console.error('Error creating initial report:', error);
        // On error, set to null so form can still load with schema defaults
        setFormData(null);
        toast({
          title: 'Failed to Create Report',
          description: 'Could not initialize the form data',
          variant: 'destructive',
        });
      } finally {
        console.log('Form initialization complete');
        setIsInitialLoadComplete(true);
      }
    };

    createInitialReport();
  }, [patientId, appointmentId, toast, formKey]);

  // Handle form data changes
  const handleFormChange = (newFormData: any) => {
    setFormData(newFormData);

    try {
      const savedReport = localStorage.getItem('agentReport');
      if (savedReport) {
        const reportData = JSON.parse(savedReport);
        reportData[formKey] = newFormData;
        localStorage.setItem('agentReport', JSON.stringify(reportData));
      }
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  };

  // Submit form data
  const handleFormSubmit = async () => {
    if (!reportId || !appointmentId) {
      toast({
        title: 'Missing Information',
        description: 'Report ID or Appointment ID is missing',
        variant: 'destructive',
      });
      return;
    }

    const currentFormData = formData;

    if (!currentFormData) {
      toast({
        title: 'No Form Data',
        description: 'No form data to submit',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const mutation = `
        mutation UpdateAgentReport($appointmentId: ObjectID!, $input: UpdateAgentReportInput!) {
          updateAgentReport(appointmentId: $appointmentId, input: $input) {
            _id
            createdAt
            updatedAt
            version
            isActive
            isFilledCompletely
          }
        }
      `;

      const formDataCopy = JSON.parse(JSON.stringify(currentFormData));

      const processData = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
          return obj.map((item) => processData(item));
        }

        const result: any = {};
        for (const key in obj) {
          if (key === 'record') continue;

          if (key === 'load' && typeof obj[key] === 'number') {
            result[key] = String(obj[key]);
          } else if (typeof obj[key] === 'object') {
            result[key] = processData(obj[key]);
          } else {
            result[key] = obj[key];
          }
        }
        return result;
      };

      // FIXED: Prepare input based on form type
      let input: any = {};

      if (formKey === 'assessment') {
        // For assessment forms, wrap data under 'assessment' key and convert sets to set
        const processedFormData = processData(formDataCopy);

        // Convert 'sets' arrays back to 'set' arrays for API compatibility
        if (processedFormData.plan && processedFormData.plan.plans) {
          processedFormData.plan.plans = processedFormData.plan.plans.map(
            (plan: any) => {
              if (plan.sets && Array.isArray(plan.sets)) {
                const { sets, ...rest } = plan;
                return {
                  ...rest,
                  set: sets, // Convert 'sets' back to 'set' for API
                };
              }
              return plan;
            }
          );
        }

        input.assessment = processedFormData;
      } else if (formKey === 'snc') {
        // For SNC forms, convert sets to set and wrap under snc key
        const processedFormData = processData(formDataCopy);

        if (processedFormData.plans) {
          processedFormData.plans = processedFormData.plans.map((plan: any) => {
            if (plan.sets && Array.isArray(plan.sets)) {
              const { sets, ...rest } = plan;
              return {
                ...rest,
                set: sets, // Convert 'sets' back to 'set' for API
              };
            }
            return plan;
          });
        }

        input.snc = processedFormData;
      } else {
        // For other form types, use as is
        input[formKey] = processData(formDataCopy);
      }

      const variables = {
        appointmentId,
        input,
      };

      console.log('Submitting with variables:', variables);

      await graphqlRequest(mutation, variables);

      toast({
        title: 'Form Submitted',
        description: 'Your form has been successfully submitted',
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your form',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const handleFormReset = () => {
    if (
      confirm(
        'Are you sure you want to reset this form? All your data will be lost.'
      )
    ) {
      setFormData(null);

      try {
        const savedReport = localStorage.getItem('agentReport');
        if (savedReport) {
          const reportData = JSON.parse(savedReport);
          reportData[formKey] = null;
          localStorage.setItem('agentReport', JSON.stringify(reportData));
        }
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }

      toast({
        title: 'Form Reset',
        description: 'All form data has been reset',
      });
    }
  };

  return {
    formData,
    isSubmitting,
    reportId,
    patientName,
    isInitialLoadComplete,
    handleFormChange,
    handleFormSubmit,
    handleFormReset,
    setFormData,
  };
};
