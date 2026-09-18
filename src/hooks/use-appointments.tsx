import React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { fetchAppointments } from '@/utils/graphql-client';

export type Appointment = {
  _id: string;
  appointment: {
    _id: string;
    seqNo: string;
    visitType?: string;
    event: {
      startTime: string;
      endTime: string;
    };
  };
};

export const useAppointments = (patientId: string) => {
  const { toast } = useToast();

  const [appointmentId, setAppointmentId] = React.useState<string>('');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = React.useState(false);
  const requestVersion = React.useRef(0);

  const clearAppointments = React.useCallback(() => {
    requestVersion.current += 1;
    setAppointments([]);
    setAppointmentId('');
    setLoadingAppointments(false);
  }, []);

  // A user selection must always replace the automatic default.
  const handleAppointmentChange = React.useCallback((id: string) => {
    setAppointmentId(id);
  }, []);

  React.useEffect(() => {
    const version = ++requestVersion.current;
    let active = true;
    const isCurrent = () => active && requestVersion.current === version;
    setAppointments([]);
    setAppointmentId('');
    setLoadingAppointments(Boolean(patientId?.trim()));
    if (!patientId?.trim()) return;

    const load = async () => {
      try {
        const response = await fetchAppointments(patientId);
        if (!isCurrent()) return;
        const sorted: Appointment[] = (response?.reports ?? [])
          .filter((report: Appointment) => report?._id && report.appointment?._id && report.appointment?.event?.startTime)
          .sort((a: Appointment, b: Appointment) =>
            new Date(b.appointment.event.startTime).getTime() - new Date(a.appointment.event.startTime).getTime());
        setAppointments(sorted);
        // Default to the latest scheduled date, regardless of a previous session.
        setAppointmentId(sorted[0]?.appointment._id ?? '');
      } catch (error) {
        if (!isCurrent()) return;
        toast({ title: 'Error', description: 'Failed to load appointments. Please try again.', variant: 'destructive' });
      } finally {
        if (isCurrent()) setLoadingAppointments(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [patientId, toast]);

  return {
    appointments,
    appointmentId,
    loadingAppointments,
    handleAppointmentChange,
    clearAppointments,
  };
};
