import { ToastAction } from '@/components/ui/toast';
import formSchemas from '@/schemas/form-schemas';
import { defaultStateFromSchema } from '@/utils/schema-utils';
import { firstAssessmentToForm } from '@/utils/first-assessment';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitFormData } from '@/utils/form-submission';
import {
  createAgentReport,
  fetchUserById,
  fetchFirstAssessmentReport,
  fetchReportByAppointment,
} from '../utils/api';
import { mapRecordsToForm } from '@/utils/records-to-form';
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

  handleFormReset: () => boolean;
  resetVersion: number;
  setFormData: (data: any) => void;
  handleFormSubmit: () => Promise<void>;
  handleFormChange: (newFormData: any) => void;
};

export const useFormManagement = ({
  formKey,
  patientId,
  appointmentId,
}: UseFormManagementProps): UseFormManagementReturn => {
  const resetEpoch = React.useRef(0);
  const [resetVersion, setResetVersion] = React.useState(0);
  const [formData, setFormData] = React.useState<any>(null);
  const latestDraft = React.useRef(formData);
  latestDraft.current = formData;
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

  // Fetch patient name using patientId
  React.useEffect(() => {
    const fetchPatientName = async () => {
      if (!patientId) return;
      
      try {
        const result = await fetchUserById(patientId);
        if (result?.user?.profileData) {
          const { firstName, lastName } = result.user.profileData;
          const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Patient';
          setPatientName(fullName);
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
        setPatientName('Patient');
      }
    };
    
    fetchPatientName();
  }, [patientId]);

  // MAIN: Create initial report (only API call we need to wait for)
  React.useEffect(() => {
    let active = true;
    const epoch = ++resetEpoch.current;
    setIsInitialLoadComplete(false);
    setReportId(null);
    setFormData(null);
    const createInitialReport = async () => {
      if (!patientId || !appointmentId) {
        setFormData(null); // null means use schema defaults
        setIsInitialLoadComplete(true);
        return;
      }

      try {
        console.log('Starting createAgentReport API call...');
        const startTime = Date.now();

        if (formKey === 'firstAssessment') {
          const existing = await fetchFirstAssessmentReport(patientId, appointmentId);
          if (!active || epoch !== resetEpoch.current) return;
          if (existing?._id) {
            const restored = firstAssessmentToForm(existing.firstAssessment);
            setReportId(existing._id);
            setFormData(restored);
            return;
          }
        }

        const centerId =
          localStorage.getItem('centerId') || '67fe35f25e42152fb5185a5e';
        const variables = {
          patient: patientId,
          center: centerId,
          appointment: appointmentId,
        };

        const result = await createAgentReport(variables, formKey);
        if (!active || epoch !== resetEpoch.current) return;
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

          // PRIMARY populate path: the clinician's real data lives in
          // Report.records (createAgentReport returns an empty working copy).
          // Fetch the records for this appointment and map them into the form
          // schema. This works for every patient because it reads that
          // patient's own report. Only assessment/firstAssessment forms have a
          // records mapping; other form types fall through to the legacy logic.
          let recordsPopulated = false;
          if (formKey === 'assessment' || formKey === 'firstAssessment') {
            try {
              const report = await fetchReportByAppointment(
                patientId,
                appointmentId
              );
              if (report && report.records) {
                const mapped = mapRecordsToForm(formKey, report.records);
                console.log(
                  `Populated ${formKey} form from Report.records:`,
                  mapped
                );
                setFormData(mapped);
                recordsPopulated = true;
              } else {
                console.log(
                  'No Report.records found for this appointment; using defaults/legacy path'
                );
              }
            } catch (recErr) {
              console.error('Error fetching Report.records:', recErr);
            }
          }

          // Handle SNC form data transformation
          if (recordsPopulated) {
            // Already populated from records; nothing further to do.
          } else if (
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
                        set: [
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
            setFormData(formKey === "firstAssessment"
              ? firstAssessmentToForm(result.createAgentReport[formKey])
              : result.createAgentReport[formKey]);
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
        if (!active || epoch !== resetEpoch.current) return;
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
        if (active && epoch === resetEpoch.current) setIsInitialLoadComplete(true);
      }
    };

    createInitialReport();
    return () => { active = false; };
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

    await submitFormData({
      state: currentFormData, appointmentId, formKey, toast, setIsSubmitting,
    });
  };

  // Reset form
  const handleFormReset = () => {
    {
      const previous = formData;
      const resetAt = resetEpoch.current + 1;
      resetEpoch.current += 1;
      const blank = defaultStateFromSchema(formSchemas[formKey as keyof typeof formSchemas] || formSchemas.assessment);
      setFormData(blank);
      setResetVersion(version => version + 1);
      setIsInitialLoadComplete(true);

      try {
        const savedReport = localStorage.getItem('agentReport');
        if (savedReport) {
          const reportData = JSON.parse(savedReport);
          reportData[formKey] = blank;
          localStorage.setItem('agentReport', JSON.stringify(reportData));
        }
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }

      toast({
        title: 'Form Reset',
        description: 'All fields cleared. Save to keep this change after refresh.',
        action: <ToastAction altText="Undo clearing the form" onClick={() => {
          // An old toast must not overwrite edits or a later reset.
          if (resetEpoch.current !== resetAt || JSON.stringify(latestDraft.current) !== JSON.stringify(blank)) return;
          resetEpoch.current += 1;
          setFormData(previous);
          setResetVersion(version => version + 1);
        }}>Undo</ToastAction>,
      });
      return true;
    }
  };

  return {
    formData,
    resetVersion,
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
