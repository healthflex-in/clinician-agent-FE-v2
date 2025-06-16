import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { graphqlRequest } from '@/utils/graphql-client';

type UseFormManagementProps = {
  formKey: string;
  patientId: string;
  appointmentId: string;
}

type UseFormManagementReturn = {
  formData: any;
  patientName: string;
  isSubmitting: boolean;
  reportId: string | null;

  handleFormReset: () => void;
  setFormData: (data: any) => void;
  handleFormSubmit: () => Promise<void>;
  handleFormChange: (newFormData: any) => void;
}

export const useFormManagement = ({
  formKey,
  patientId,
  appointmentId,
}: UseFormManagementProps): UseFormManagementReturn => {
  const [formData, setFormData] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reportId, setReportId] = React.useState<string | null>(null);
  const [patientName, setPatientName] = React.useState<string>('Patient');
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
      if (!patientId || !appointmentId) return;

      try {
        const existingReport = localStorage.getItem('agentReport');
        if (existingReport) {
          try {
            const parsedReport = JSON.parse(existingReport);
            if (parsedReport._id) {
              setReportId(parsedReport._id);
              if (parsedReport[formKey]) {
                setFormData(parsedReport[formKey]);
              }
              return;
            }
          } catch (e) {
            console.error('Error parsing existing report:', e);
          }
        }

        const mutation = `
          mutation CreateAgentReport($input: CreateAgentReportInput!) {
            createAgentReport(input: $input) {
              _id
              createdAt
              updatedAt
              version
              isActive
            }
          }
        `;

        const centerId = localStorage.getItem('centerId') || '67fe35f25e42152fb5185a5e';

        const variables = {
          input: {
            patient: patientId,
            center: centerId,
            appointment: appointmentId,
          },
        };

        const result = await graphqlRequest(mutation, variables);

        if (result && result.createAgentReport && result.createAgentReport._id) {
          setReportId(result.createAgentReport._id);
          localStorage.setItem('agentReport', JSON.stringify(result.createAgentReport));

          toast({
            title: 'Report Created',
            description: 'New report initialized successfully',
          });

          if (result.createAgentReport[formKey]) {
            setFormData(result.createAgentReport[formKey]);
          }
        }
      } catch (error) {
        console.error('Error creating initial report:', error);
        toast({
          title: 'Failed to Create Report',
          description: 'Could not initialize the form data',
          variant: 'destructive',
        });
      }
    };

    fetchPatientName();
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

      const formDataCopy = JSON.parse(JSON.stringify(formData));

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
    handleFormChange,
    handleFormSubmit,
    handleFormReset,
    setFormData,
  };
};
