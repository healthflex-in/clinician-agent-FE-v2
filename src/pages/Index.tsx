import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Loader2,
  Calendar,
  Building,
  ArrowRight,
  CheckCircle,
  ClipboardList,
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import formSchemas from '@/schemas/form-schemas';
import { Patient, useAppointments, useCenters, usePatients } from '@/hooks';
import {
  Select,
  SelectItem,
  SelectValue,
  SelectContent,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Card,
  CardTitle,
  CardHeader,
  CardFooter,
  CardContent,
} from '@/components/ui/card';

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [centerId, setCenterId] = React.useState<string>('');
  const [formKey, setFormKey] = React.useState<string>('snc');
  const [patientId, setPatientId] = React.useState<string>('');
  const [patientName, setPatientName] = React.useState<string>('');
  const [patientSearch, setPatientSearch] = React.useState<string>('');

  const { centers, loadingCenters } = useCenters();
  const { patients, loadingPatients, searchPatients, clearPatients } = usePatients(centerId);
  const { appointments, appointmentId, loadingAppointments, handleAppointmentChange, clearAppointments } = useAppointments(patientId);

  // Set viewport for mobile
  React.useEffect(() => {
    // Set viewport meta tag for mobile
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    document.getElementsByTagName('head')[0].appendChild(meta);

    // Status bar color for PWA
    const statusBarMeta = document.createElement('meta');
    statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
    statusBarMeta.content = 'black-translucent';
    document.getElementsByTagName('head')[0].appendChild(statusBarMeta);

    // Set web app capable
    const webAppMeta = document.createElement('meta');
    webAppMeta.name = 'apple-mobile-web-app-capable';
    webAppMeta.content = 'yes';
    document.getElementsByTagName('head')[0].appendChild(webAppMeta);

    return () => {
      document.getElementsByTagName('head')[0].removeChild(meta);
      document.getElementsByTagName('head')[0].removeChild(webAppMeta);
      document.getElementsByTagName('head')[0].removeChild(statusBarMeta);
    };
  }, []);

  // Get previous values from localStorage
  React.useEffect(() => {
    const savedFormKey = localStorage.getItem('formKey');
    const savedPatientId = localStorage.getItem('userId');
    const savedCenterId = localStorage.getItem('centerId');
    const savedAppointmentId = localStorage.getItem('appointmentId');

    if (savedCenterId) setCenterId(savedCenterId);

    // Only restore these values if centerId exists
    if (savedCenterId) {
      if (savedPatientId) {
        setPatientId(savedPatientId);

        // Restore patient name from localStorage if available
        const savedPatient = localStorage.getItem('selectedPatient');
        if (savedPatient) {
          const parsedPatient = JSON.parse(savedPatient);
          setPatientName(parsedPatient.name);
        }
      }

      // Only restore appointmentId if patientId exists
      if (savedPatientId && savedAppointmentId) {
        // Note: appointmentId will be handled by the useAppointments hook
        // We'll need to update the hook to handle localStorage restoration

        // Only restore formKey if appointmentId exists
        if (savedAppointmentId && savedFormKey) {
          setFormKey(savedFormKey);
        }
      }
    }
  }, []);

  React.useEffect(() => {
    if (centerId && patientSearch) {
      const delaySearch = setTimeout(() => {
        searchPatients(patientSearch);
      }, 500); // Debounce search

      return () => clearTimeout(delaySearch);
    }
  }, [centerId, patientSearch, searchPatients]);

  // Select a patient from search results
  const selectPatient = (patient: Patient) => {
    setPatientId(patient._id);
    setPatientName(
      `${patient.profileData.firstName} ${patient.profileData.lastName}`
    );
    setPatientSearch('');
    clearPatients(); // Use hook function instead of setPatients([])
  };

  // Handle center change
  const handleCenterChange = (newCenterId: string) => {
    setCenterId(newCenterId);

    // Clear downstream selections
    setPatientId('');
    setPatientName('');
    setPatientSearch('');
    clearPatients(); // Use hook function
    clearAppointments(); // Use hook function
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
    localStorage.setItem(
      'selectedPatient',
      JSON.stringify({ id: patientId, name: patientName })
    );

    // Navigate to form page
    navigate(`/${formKey}/${patientId}/${appointmentId}`);
  };

  // Get progress step count
  const getProgressStep = () => {
    if (!centerId) return 1;
    if (!patientId) return 2;
    if (!appointmentId) return 3;
    return 4;
  };

  // console.log('@@ appoitments:', appointments);
  // console.log('@@ selected patient:', {
  //   id: patientId,
  //   name: patientName,
  // });
  console.log('@@ selected appointment:', appointmentId);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/10 to-background px-4 py-6 safe-area-top safe-area-bottom">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-xl font-bold">
            Stance AI Agent
          </CardTitle>

          {/* Progress indicator for mobile */}
          <div className="flex justify-center mt-2">
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full ${step <= getProgressStep() ? 'bg-primary' : 'bg-gray-200'
                    }`}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Center Selection */}
            <div className="space-y-1.5">
              <Label
                htmlFor="center"
                className="flex items-center text-sm font-medium"
              >
                <Building className="h-4 w-4 mr-1.5 text-black" />
                Select Center
              </Label>
              <Select value={centerId} onValueChange={handleCenterChange}>
                <SelectTrigger className="w-full h-10 text-sm">
                  <SelectValue placeholder="Select a center" />
                </SelectTrigger>
                <SelectContent>
                  {loadingCenters ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">Loading centers...</span>
                    </div>
                  ) : (
                    centers.map((center) => (
                      <SelectItem
                        key={center._id}
                        value={center._id}
                        className="text-sm"
                      >
                        {center.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Patient Search */}
            <div className="space-y-1.5">
              <Label
                htmlFor="patientSearch"
                className="flex items-center text-sm font-medium"
              >
                <User className="h-4 w-4 mr-1.5 text-black" />
                Patient
              </Label>
              <div className="relative">
                <Input
                  id="patientSearch"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patients by name"
                  disabled={!centerId}
                  className="h-10 text-sm"
                />
                {loadingPatients && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />
                )}
              </div>

              {/* Patient Search Results */}
              {patients.length > 0 && (
                <div className="bg-white border rounded-md mt-1 max-h-40 overflow-y-auto shadow-md z-10">
                  {patients.map((patient) => (
                    <div
                      key={patient._id}
                      className="px-3 py-2.5 hover:bg-gray-100 active:bg-gray-200 cursor-pointer text-sm border-b last:border-0 flex items-center touch-manipulation transition-colors"
                      onClick={() => selectPatient(patient)}
                    >
                      <User className="h-3.5 w-3.5 mr-2 text-black" />
                      {patient.profileData.firstName}{' '}
                      {patient.profileData.lastName}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Patient Display */}
              {patientId && patientName && (
                <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md flex justify-between items-center">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                    <span className="text-sm font-medium">{patientName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setPatientId('');
                      setPatientName('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            {/* Appointment Selection */}
            <div className="space-y-1.5">
              <Label
                htmlFor="appointmentId"
                className="flex items-center text-sm font-medium"
              >
                <Calendar className="h-4 w-4 mr-1.5 text-black" />
                Appointment
                {loadingAppointments && (
                  <Loader2 className="h-3 w-3 animate-spin ml-2 text-gray-500" />
                )}
              </Label>
              <Select
                value={appointmentId}
                onValueChange={handleAppointmentChange}
                disabled={!patientId || loadingAppointments}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder={loadingAppointments ? "Loading appointments..." : "Select an appointment"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingAppointments ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">Loading appointments...</span>
                    </div>
                  ) : appointments.length > 0 ? (
                    appointments.map((appointment) => (
                      <SelectItem
                        key={appointment._id}
                        value={appointment._id}
                        className="text-sm"
                      >
                        {`#${appointment.seqNo} (${new Date(
                          appointment.createdAt
                        ).toLocaleDateString()})`}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      No appointments found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Form Type Selection */}
            <div className="space-y-1.5">
              <Label
                htmlFor="formKey"
                className="flex items-center text-sm font-medium"
              >
                <ClipboardList className="h-4 w-4 mr-1.5 text-black" />
                Form Type
              </Label>
              <Select
                value={formKey}
                onValueChange={setFormKey}
                disabled={!appointmentId}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select a form type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(formSchemas).map((key) => (
                    <SelectItem key={key} value={key} className="text-sm">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-4 bg-primary border border-black hover:bg-primary/90 text-black font-medium flex items-center justify-center touch-manipulation active:scale-[0.98] transition-transform"
            >
              Start Session
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-1 pt-0 pb-4">
          <p className="text-xs text-muted-foreground text-center">
            Select a center, patient, appointment and form type to continue.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Index;
