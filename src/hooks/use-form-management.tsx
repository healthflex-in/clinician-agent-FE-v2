import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { graphqlRequest } from '@/utils/graphql-client';
import { createAgentReport } from '../utils/api';

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

  // Fetch patient name and create initial report
  React.useEffect(() => {
    const fetchPatientName = async () => {
      if (!patientId) return;

      try {
        const storedPatient = localStorage.getItem('selectedPatient');
        if (storedPatient) {
          const patientData = JSON.parse(storedPatient);
          if (patientData && patientData.name) {
            setPatientName(patientData.name);
            return;
          }
        }

        const query = `
          query GetPatientById($patientId: ObjectID!) {
            getPatientById(patientId: $patientId) {
              _id
              name
            }
          }
        `;

        const variables = { patientId };
        const result = await graphqlRequest(query, variables);
        if (result && result.getPatientById && result.getPatientById.name) {
          setPatientName(result.getPatientById.name);
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
      }
    };

    const createInitialReport = async () => {
      if (!patientId || !appointmentId) {
        console.log('No patientId or appointmentId, using schema defaults');
        setFormData(null); // null means use schema defaults
        setIsInitialLoadComplete(true);
        return;
      }
      try {
        const centerId =
          localStorage.getItem('centerId') || '67fe35f25e42152fb5185a5e';
        const variables = {
          patient: patientId,
          center: centerId,
          appointment: appointmentId,
        };
        const result = await createAgentReport(variables);
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
          if (
            formKey === 'snc' &&
            result.createAgentReport.assessment &&
            result.createAgentReport.assessment.plan
          ) {
            // Log the raw API plan
            console.log(
              'API assessment.plan:',
              result.createAgentReport.assessment.plan
            );
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
            console.log('Transformed SNC plan for form:', transformedPlan);
            setFormData(transformedPlan);
            console.log('setFormData called with:', transformedPlan);
          } else if (result.createAgentReport[formKey]) {
            setFormData(result.createAgentReport[formKey]);
            console.log(
              'setFormData called with:',
              result.createAgentReport[formKey]
            );
          } else if (
            result.createAgentReport.assessment &&
            formKey === 'assessment'
          ) {
            setFormData(result.createAgentReport.assessment);
            console.log(
              'setFormData called with:',
              result.createAgentReport.assessment
            );
          } else {
            // No data returned for this form key, set to null so FormRenderer uses schema
            console.log('No API data for formKey, using schema defaults');
            setFormData(null);
            console.log(
              'setFormData called with null - will use schema defaults'
            );
          }
        } else {
          // No report created, set to null so FormRenderer uses schema
          console.log('No report created, using schema defaults');
          setFormData(null);
          console.log(
            'setFormData called with null - will use schema defaults'
          );
        }
      } catch (error) {
        console.error('Error creating initial report:', error);
        // On error, set to null so form can still load with schema defaults
        console.log('Error in API call, using schema defaults');
        setFormData(null);
        toast({
          title: 'Failed to Create Report',
          description: 'Could not initialize the form data',
          variant: 'destructive',
        });
      } finally {
        setIsInitialLoadComplete(true);
      }
    };

    fetchPatientName();
    createInitialReport();
  }, [patientId, appointmentId, toast, formKey]);

  // Log formKey on every render
  console.log('useFormManagement formKey:', formKey);

  // Handle form data changes - FIX: Simplified to work for both cases
  const handleFormChange = (newFormData: any) => {
    setFormData(newFormData);
    console.log('handleFormChange setFormData called with:', newFormData);

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

  // Submit form data - FIX: Use current formData state
  const handleFormSubmit = async () => {
    if (!reportId || !appointmentId) {
      toast({
        title: 'Missing Information',
        description: 'Report ID or Appointment ID is missing',
        variant: 'destructive',
      });
      return;
    }

    // FIX: Use the current formData state, not a potentially stale closure
    const currentFormData = formData;

    if (!currentFormData) {
      toast({
        title: 'No Form Data',
        description: 'No form data to submit',
        variant: 'destructive',
      });
      return;
    }

    console.log('Submitting form data:', currentFormData);
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

      const input: any = {};
      input[formKey] = processData(formDataCopy);

      const variables = {
        appointmentId,
        input,
      };

      console.log('Submitting to API:', variables);
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
      console.log('handleFormReset setFormData called with: null');

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
    handleFormChange,
    handleFormSubmit,
    handleFormReset,
    setFormData,
  };
};
