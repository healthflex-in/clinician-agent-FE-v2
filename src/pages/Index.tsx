import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import formSchemas from '@/schemas/formSchemas';
import {
  fetchCenters,
  searchUsers,
  fetchAppointments,
} from '@/utils/graphqlClient';

// Define interfaces for API data
interface Center {
  _id: string;
  name: string;
}

interface Patient {
  _id: string;
  profileData: {
    firstName: string;
    lastName: string;
  };
}

interface Appointment {
  _id: string;
  seqNo: string;
  createdAt: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [formKey, setFormKey] = useState<string>('snc');
  const [patientId, setPatientId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [appointmentId, setAppointmentId] = useState<string>('');
  const [centerId, setCenterId] = useState<string>('');

  // Data from APIs
  const [centers, setCenters] = useState<Center[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Loading states
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Get previous values from localStorage
  useEffect(() => {
    const savedPatientId = localStorage.getItem('userId');
    const savedAppointmentId = localStorage.getItem('appointmentId');
    const savedFormKey = localStorage.getItem('formKey');
    const savedCenterId = localStorage.getItem('centerId');

    if (savedCenterId) setCenterId(savedCenterId);

    // Only restore these values if centerId exists
    if (savedCenterId) {
      if (savedPatientId) setPatientId(savedPatientId);

      // Only restore appointmentId if patientId exists
      if (savedPatientId && savedAppointmentId) {
        setAppointmentId(savedAppointmentId);

        // Only restore formKey if appointmentId exists
        if (savedAppointmentId && savedFormKey) {
          setFormKey(savedFormKey);
        }
      }
    }

    // Load centers on component mount
    loadCenters();
  }, []);

  // Fetch list of centers
  const loadCenters = async () => {
    try {
      setLoadingCenters(true);
      const response = await fetchCenters();
      console.log('Centers response:', response);
      if (response && response.centers) {
        setCenters(response.centers);
      }
    } catch (error) {
      console.error('Error fetching centers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load centers. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCenters(false);
    }
  };

  // Search for patients when center is selected and search term changes
  useEffect(() => {
    if (centerId && patientSearch) {
      const delaySearch = setTimeout(() => {
        searchPatients(patientSearch);
      }, 500); // Debounce search

      return () => clearTimeout(delaySearch);
    }
  }, [centerId, patientSearch]);

  // Fetch patients based on search term
  const searchPatients = async (searchTerm: string) => {
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
  };

  // Load appointments when patient is selected
  useEffect(() => {
    if (patientId) {
      loadAppointments(patientId);
    } else {
      // Clear appointment selection if patient is deselected
      setAppointmentId('');
      setAppointments([]);
    }
  }, [patientId]);

  // Fetch appointments for selected patient
  const loadAppointments = async (patientId: string) => {
    try {
      setLoadingAppointments(true);
      const filter = {
        patient: patientId,
      };

      const response = await fetchAppointments(filter);
      console.log('Appointments response:', response);

      if (response && response.appointments) {
        setAppointments(response.appointments);
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

  // Select a patient from search results
  const selectPatient = (patient: Patient) => {
    setPatientId(patient._id);
    setPatientName(
      `${patient.profileData.firstName} ${patient.profileData.lastName}`
    );
    setPatientSearch('');
    setPatients([]); // Clear search results after selection

    // Clear downstream selections
    setAppointmentId('');
  };

  // Handle center change
  const handleCenterChange = (newCenterId: string) => {
    setCenterId(newCenterId);

    // Clear downstream selections
    setPatientId('');
    setPatientName('');
    setPatientSearch('');
    setAppointmentId('');
    setPatients([]);
    setAppointments([]);
  };

  // Handle appointment change
  const handleAppointmentChange = (newAppointmentId: string) => {
    setAppointmentId(newAppointmentId);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate entire flow
    if (!centerId) {
      toast({
        title: 'Center Required',
        description: 'Please select a center first',
        variant: 'destructive',
      });
      return;
    }

    if (!patientId) {
      toast({
        title: 'Patient Required',
        description: 'Please select a patient',
        variant: 'destructive',
      });
      return;
    }

    if (!appointmentId) {
      toast({
        title: 'Appointment Required',
        description: 'Please select an appointment',
        variant: 'destructive',
      });
      return;
    }

    if (!formKey) {
      toast({
        title: 'Form Selection Required',
        description: 'Please select a form type',
        variant: 'destructive',
      });
      return;
    }

    // Store in localStorage
    localStorage.setItem('userId', patientId);
    localStorage.setItem('appointmentId', appointmentId);
    localStorage.setItem('formKey', formKey);
    localStorage.setItem('centerId', centerId);

    // Navigate to form page
    navigate(`/${formKey}/${patientId}/${appointmentId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-primary/10 to-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            Audio Transcription App
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Center Selection */}
            <div className="space-y-2">
              <Label htmlFor="center">Select Center</Label>
              <Select value={centerId} onValueChange={handleCenterChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a center" />
                </SelectTrigger>
                <SelectContent>
                  {loadingCenters ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Loading centers...</span>
                    </div>
                  ) : (
                    centers.map((center) => (
                      <SelectItem key={center._id} value={center._id}>
                        {center.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Patient Search */}
            <div className="space-y-2">
              <Label htmlFor="patientSearch">Patient Search</Label>
              <div className="relative">
                <Input
                  id="patientSearch"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patients by name"
                  disabled={!centerId}
                />
                {loadingPatients && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
                )}
              </div>

              {/* Patient Search Results */}
              {patients.length > 0 && (
                <div className="bg-white border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {patients.map((patient) => (
                    <div
                      key={patient._id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => selectPatient(patient)}
                    >
                      {patient.profileData.firstName}{' '}
                      {patient.profileData.lastName}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Patient Display */}
              {patientId && patientName && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex justify-between items-center">
                  <span>{patientName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPatientId('');
                      setPatientName('');
                      setAppointmentId(''); // Clear appointment when patient is changed
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            {/* Appointment Selection */}
            <div className="space-y-2">
              <Label htmlFor="appointmentId">Appointment</Label>
              <Select
                value={appointmentId}
                onValueChange={handleAppointmentChange}
                disabled={!patientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an appointment" />
                </SelectTrigger>
                <SelectContent>
                  {loadingAppointments ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Loading appointments...</span>
                    </div>
                  ) : (
                    appointments.map((appointment) => (
                      <SelectItem key={appointment._id} value={appointment._id}>
                        {`Appointment #${appointment.seqNo} (${new Date(
                          appointment.createdAt
                        ).toLocaleDateString()})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Form Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="formKey">Form Type</Label>
              <Select
                value={formKey}
                onValueChange={setFormKey}
                disabled={!appointmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a form type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(formSchemas).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#DDFE71] hover:bg-[#DDFE71]/90 text-black"
            >
              Start Session
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <p className="text-sm text-muted-foreground text-center">
            Select a center, patient, appointment and form type to continue.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Items must be selected in order: center → patient → appointment →
            form.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Index;
