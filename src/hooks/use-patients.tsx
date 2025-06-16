import React from 'react';

import { searchUsers } from '@/utils/graphql-client';
import { useToast } from '@/components/ui/use-toast';

export type Patient = {
  _id: string;
  profileData: {
    firstName: string;
    lastName: string;
  };
}

export const usePatients = (centerId: string) => {
  const { toast } = useToast();
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = React.useState(false);

  const searchPatients = React.useCallback(async (searchTerm: string) => {
    if (!centerId) {
      toast({
        title: 'Center Required',
        description: 'Please select a center first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoadingPatients(true);
      const response = await searchUsers('PATIENT', [centerId], searchTerm);
      console.log('Patient search response:', response);

      if (response && response.users) {
        setPatients(response.users);
      }
    } catch (error) {
      console.error('Error searching patients:', error);
      toast({
        title: 'Error',
        description: 'Failed to search patients. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPatients(false);
    }
  }, [centerId, toast]);

  const clearPatients = React.useCallback(() => {
    setPatients([]);
  }, []);

  return { patients, loadingPatients, searchPatients, clearPatients };
};
