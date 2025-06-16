import React from 'react';

import { useToast } from "@/components/ui/use-toast";
import { fetchAppointments } from '@/utils/graphql-client';

export type Appointment = {
  _id: string;
  seqNo: string;
  createdAt: string;
}

export const useAppointments = (patientId: string) => {
  const { toast } = useToast();

  const isAutoSelectingRef = React.useRef(false);
  
  const [appointmentId, setAppointmentId] = React.useState<string>('');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = React.useState(false);
  const [lastLoadedPatientId, setLastLoadedPatientId] = React.useState<string>('');

  const clearAppointments = React.useCallback(() => {
    setAppointments([]);
    setAppointmentId('');
    setLastLoadedPatientId('');
    isAutoSelectingRef.current = false;
  }, []);

  const handleAppointmentChange = React.useCallback((newAppointmentId: string) => {
    // Only process if this is not an auto-selection
    if (!isAutoSelectingRef.current) {
      setAppointmentId(newAppointmentId);
    } else {
      // Reset the flag after auto-selection is processed
      isAutoSelectingRef.current = false;
    }
  }, []);

  // Load appointments when patient changes
  React.useEffect(() => {
    const loadAppointments = async (currentPatientId: string) => {
      // Prevent loading if already loading for the same patient
      if (loadingAppointments && lastLoadedPatientId === currentPatientId) {
        return;
      }

      try {
        setLoadingAppointments(true);
        setLastLoadedPatientId(currentPatientId);
        
        const filter = {patient: currentPatientId};

        const response = await fetchAppointments(filter);
        console.log('Appointments response:', response);

        if (response && response.appointments) {
          // Sort appointments by createdAt date (most recent first)
          const sortedAppointments = response.appointments.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setAppointments(sortedAppointments);

          // Check if we should restore from localStorage
          const savedAppointmentId = localStorage.getItem('appointmentId');
          const savedPatientId = localStorage.getItem('userId');
          
          if (savedPatientId === currentPatientId && savedAppointmentId) {
            // Restore from localStorage if the appointment exists in the list
            const appointmentExists = sortedAppointments.find(apt => apt._id === savedAppointmentId);
            if (appointmentExists) {
              console.log('@@ Restoring appointment from localStorage:', savedAppointmentId);
              isAutoSelectingRef.current = true;
              setAppointmentId(savedAppointmentId);
              return;
            }
          }

          // Auto-select the most recent appointment
          if (sortedAppointments.length > 0) {
            const mostRecentAppointment = sortedAppointments[0];
            console.log('@@ Auto-selecting most recent appointment:', mostRecentAppointment);
            isAutoSelectingRef.current = true;
            setAppointmentId(mostRecentAppointment._id);
          }
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        toast({
          title: 'Error',
          description: 'Failed to load appointments. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoadingAppointments(false);
      }
    };

    if (patientId && patientId !== lastLoadedPatientId) {
      loadAppointments(patientId);
    } else if (!patientId) {
      clearAppointments();
    }
  }, [patientId, lastLoadedPatientId, loadingAppointments, toast, clearAppointments]);

  return { 
    appointments,
    appointmentId,
    loadingAppointments, 
    handleAppointmentChange,
    clearAppointments 
  };
};
