import React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { fetchAppointments } from '@/utils/graphql-client';

export type Appointment = {
  _id: string;
  startTime: string;
  attendees: Array<{
    profileData: {
      firstName: string;
      lastName: string;
    };
  }>;
  appointment: {
    _id: string;
    seqNo: string;
  };
};

export const useAppointments = (patientId: string) => {
  const { toast } = useToast();

  const isAutoSelectingRef = React.useRef(false);

  const [appointmentId, setAppointmentId] = React.useState<string>('');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = React.useState<
    Appointment[]
  >([]);
  const [loadingAppointments, setLoadingAppointments] = React.useState(false);
  const [lastLoadedPatientId, setLastLoadedPatientId] =
    React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  const clearAppointments = React.useCallback(() => {
    setAppointments([]);
    setFilteredAppointments([]);
    setAppointmentId('');
    setLastLoadedPatientId('');
    setSearchTerm('');
    isAutoSelectingRef.current = false;
  }, []);

  const handleAppointmentChange = React.useCallback(
    (newAppointmentId: string) => {
      // Only process if this is not an auto-selection
      if (!isAutoSelectingRef.current) {
        setAppointmentId(newAppointmentId);
      } else {
        // Reset the flag after auto-selection is processed
        isAutoSelectingRef.current = false;
      }
    },
    []
  );

  // Search functionality - now makes API call with search term
  const handleSearch = React.useCallback(
    async (term: string) => {
      if (!patientId) return;

      // Don't set loading if it's just clearing search or same term
      const shouldSetLoading = term.trim() !== searchTerm.trim();

      try {
        if (shouldSetLoading) {
          setLoadingAppointments(true);
        }

        const filter = {
          eventType: 'APPOINTMENT',
          attendees: [patientId],
        };

        // Make API call with search term
        const response = await fetchAppointments(
          filter,
          term.trim() || undefined
        );

        if (response && response.events) {
          // Sort appointments by startTime (most recent first) with safety checks
          const sortedAppointments = response.events
            .filter((event) => event && event._id && event.startTime) // Filter out invalid events
            .sort(
              (a, b) =>
                new Date(b.startTime).getTime() -
                new Date(a.startTime).getTime()
            );

          if (!term.trim()) {
            // If no search term, update both main and filtered appointments
            setAppointments(sortedAppointments);
            setFilteredAppointments(sortedAppointments);
          } else {
            // If searching, keep main appointments unchanged, update filtered
            setFilteredAppointments(sortedAppointments);
          }
        }
      } catch (error) {
        console.error('Error searching appointments:', error);
        toast({
          title: 'Error',
          description: 'Failed to search appointments. Please try again.',
          variant: 'destructive',
        });
      } finally {
        if (shouldSetLoading) {
          setLoadingAppointments(false);
        }
      }
    },
    [patientId, searchTerm, toast]
  );

  // Add a separate function to update search term without API call
  const updateSearchTerm = React.useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Clear search - reloads appointments without search
  const clearSearch = React.useCallback(async () => {
    setSearchTerm('');

    if (!patientId) return;

    try {
      setLoadingAppointments(true);

      const filter = {
        eventType: 'APPOINTMENT',
        attendees: [patientId],
      };

      // Reload appointments without search
      const response = await fetchAppointments(filter);

      if (response && response.events) {
        const sortedAppointments = response.events
          .filter((event) => event && event._id && event.startTime)
          .sort(
            (a, b) =>
              new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
        setAppointments(sortedAppointments);
        setFilteredAppointments(sortedAppointments);
      }
    } catch (error) {
      console.error('Error clearing search:', error);
    } finally {
      setLoadingAppointments(false);
    }
  }, [patientId]);

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

        // Updated filter structure for event API
        const filter = {
          eventType: 'APPOINTMENT',
          attendees: [currentPatientId],
        };

        const response = await fetchAppointments(filter);

        if (response && response.events) {
          // Sort appointments by startTime (most recent first) with safety checks
          const sortedAppointments = response.events
            .filter((event) => event && event._id && event.startTime) // Filter out invalid events
            .sort(
              (a, b) =>
                new Date(b.startTime).getTime() -
                new Date(a.startTime).getTime()
            );
          setAppointments(sortedAppointments);
          setFilteredAppointments(sortedAppointments); // Initialize filtered list

          // Check if we should restore from localStorage
          const savedAppointmentId = localStorage.getItem('appointmentId');
          const savedPatientId = localStorage.getItem('userId');

          if (savedPatientId === currentPatientId && savedAppointmentId) {
            // Restore from localStorage if the appointment exists in the list
            const appointmentExists = sortedAppointments.find(
              (apt) => apt.appointment._id === savedAppointmentId
            );
            if (appointmentExists) {
              isAutoSelectingRef.current = true;
              setAppointmentId(savedAppointmentId);
              return;
            }
          }

          // Auto-select the most recent appointment
          if (sortedAppointments.length > 0) {
            const mostRecentAppointment = sortedAppointments[0];
            console.log('@@ mostRecentAppointment: ', mostRecentAppointment);
            isAutoSelectingRef.current = true;
            setAppointmentId(mostRecentAppointment.appointment._id);
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
  }, [
    patientId,
    lastLoadedPatientId,
    loadingAppointments,
    toast,
    clearAppointments,
  ]);

  // Update filtered appointments when main appointments change
  React.useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAppointments(appointments);
    } else {
      handleSearch(searchTerm);
    }
  }, [appointments, searchTerm, handleSearch]);

  return {
    appointments: filteredAppointments, // Return filtered appointments for display
    allAppointments: appointments, // Return all appointments if needed
    appointmentId,
    loadingAppointments,
    handleAppointmentChange,
    clearAppointments,
    // New search functionality
    searchTerm,
    updateSearchTerm,
    handleSearch,
    clearSearch,
  };
};
