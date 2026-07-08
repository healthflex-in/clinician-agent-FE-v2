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
  Mic,
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

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [centerId, setCenterId] = React.useState<string>('');
  const [formKey, setFormKey] = React.useState<string>('snc');
  const [patientId, setPatientId] = React.useState<string>('');
  const [patientName, setPatientName] = React.useState<string>('');
  const [patientSearch, setPatientSearch] = React.useState<string>('');

  const { centers, loadingCenters } = useCenters();
  const { patients, loadingPatients, searchPatients, clearPatients } =
    usePatients(centerId);
  const {
    appointments: events,
    appointmentId,
    loadingAppointments: loadingEvents,
    handleAppointmentChange,
    clearAppointments: clearEvents,
  } = useAppointments(patientId || '');

  React.useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    document.getElementsByTagName('head')[0].appendChild(meta);

    const statusBarMeta = document.createElement('meta');
    statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
    statusBarMeta.content = 'black-translucent';
    document.getElementsByTagName('head')[0].appendChild(statusBarMeta);

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

  React.useEffect(() => {
    const savedFormKey = localStorage.getItem('formKey');
    const savedPatientId = localStorage.getItem('userId');
    const savedCenterId = localStorage.getItem('centerId');
    const savedAppointmentId = localStorage.getItem('appointmentId');

    if (savedCenterId) setCenterId(savedCenterId);

    if (savedCenterId) {
      if (savedPatientId) {
        setPatientId(savedPatientId);
        const savedPatient = localStorage.getItem('selectedPatient');
        if (savedPatient) {
          const parsedPatient = JSON.parse(savedPatient);
          setPatientName(parsedPatient.name);
        }
      }

      if (savedPatientId && savedAppointmentId) {
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
      }, 500);

      return () => clearTimeout(delaySearch);
    }
  }, [centerId, patientSearch, searchPatients]);

  const selectPatient = (patient: Patient) => {
    setPatientId(patient._id);
    setPatientName(
      `${patient.profileData.firstName} ${patient.profileData.lastName}`
    );
    setPatientSearch('');
    clearPatients();
  };

  const handleCenterChange = (newCenterId: string) => {
    setCenterId(newCenterId);
    setPatientId('');
    setPatientName('');
    setPatientSearch('');
    clearPatients();
    clearEvents();
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!centerId) {
      toast({ title: 'Center Required', description: 'Please select a center first', variant: 'destructive' });
      return;
    }
    if (!patientId) {
      toast({ title: 'Patient Required', description: 'Please select a patient', variant: 'destructive' });
      return;
    }
    if (!appointmentId) {
      toast({ title: 'Appointment Required', description: 'Please select an appointment', variant: 'destructive' });
      return;
    }
    if (!formKey) {
      toast({ title: 'Form Selection Required', description: 'Please select a form type', variant: 'destructive' });
      return;
    }

    localStorage.setItem('userId', patientId);
    localStorage.setItem('appointmentId', appointmentId);
    localStorage.setItem('formKey', formKey);
    localStorage.setItem('centerId', centerId);
    localStorage.setItem('selectedPatient', JSON.stringify({ id: patientId, name: patientName }));

    navigate(`/${formKey}/${patientId}/${appointmentId}`);
  };

  const getProgressStep = () => {
    if (!centerId) return 1;
    if (!patientId) return 2;
    if (!appointmentId) return 3;
    return 4;
  };

  const steps = ['Center', 'Patient', 'Appointment', 'Form'];

  return (
    <div
      className="min-h-screen bg-stance-steel flex flex-col items-center justify-center px-4 py-8"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-stance-neon/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-stance-stone/10 rounded-full blur-[96px]" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-[20px] bg-stance-steel border border-white/10 flex items-center justify-center mx-auto shadow-[0_8px_32px_rgba(14,27,42,0.4)]">
            <Mic className="h-7 w-7 text-stance-neon" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35 font-sans">
              Stance Health · Clinician Agent
            </p>
            <h1 className="font-display text-2xl font-bold text-white mt-1">
              Start a Session
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Select center, patient and appointment to begin
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {steps.map((step, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === getProgressStep();
            const isDone = stepNum < getProgressStep();
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`h-1.5 w-full rounded-full transition-all ${isDone || isActive ? 'bg-stance-neon' : 'bg-white/10'}`} />
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isDone || isActive ? 'text-stance-neon' : 'text-white/25'}`}>
                    {step}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Form card */}
        <div className="bg-[#F0F3F8] rounded-[28px] p-6 shadow-[0_8px_48px_rgba(0,0,0,0.3)] space-y-5">
          <form onSubmit={handleFormSubmit} className="space-y-4">

            {/* Center Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="center" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stance-steel/60">
                <Building className="h-3.5 w-3.5" />
                Center
              </Label>
              <Select value={centerId} onValueChange={handleCenterChange}>
                <SelectTrigger className="h-11 bg-white border-stance-steel/10 rounded-xl text-stance-grey text-sm focus:ring-stance-steel/20">
                  <SelectValue placeholder="Select a center" />
                </SelectTrigger>
                <SelectContent>
                  {loadingCenters ? (
                    <div className="flex items-center justify-center p-3 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-stance-steel/40" />
                      <span className="text-sm text-stance-steel/50">Loading centers...</span>
                    </div>
                  ) : (
                    centers.map((center) => (
                      <SelectItem key={center._id} value={center._id} className="text-sm">
                        {center.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Patient Search */}
            <div className="space-y-1.5">
              <Label htmlFor="patientSearch" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stance-steel/60">
                <User className="h-3.5 w-3.5" />
                Patient
              </Label>
              <div className="relative">
                <Input
                  id="patientSearch"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name..."
                  disabled={!centerId}
                  className="h-11 bg-white border-stance-steel/10 rounded-xl text-stance-grey text-sm placeholder:text-stance-grey/30 focus-visible:ring-stance-steel/20"
                />
                {loadingPatients && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-stance-steel/30" />
                )}
              </div>

              {patients.length > 0 && (
                <div className="bg-white border border-stance-steel/10 rounded-xl mt-1 max-h-40 overflow-y-auto shadow-lg z-10">
                  {patients.map((patient) => (
                    <div
                      key={patient._id}
                      className="px-4 py-3 hover:bg-stance-steel/5 active:bg-stance-steel/10 cursor-pointer text-sm border-b border-stance-steel/5 last:border-0 flex items-center gap-2.5 transition-colors"
                      onClick={() => selectPatient(patient)}
                    >
                      <div className="h-6 w-6 rounded-full bg-stance-steel/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-3 w-3 text-stance-steel/50" />
                      </div>
                      <span className="text-stance-grey">
                        {patient.profileData.firstName} {patient.profileData.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {patientId && patientName && (
                <div className="mt-1 px-4 py-2.5 bg-stance-neon/10 border border-stance-neon/30 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-stance-steel" />
                    <span className="text-sm font-semibold text-stance-steel">{patientName}</span>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-stance-steel/50 hover:text-stance-steel transition-colors px-2 py-1 rounded-lg hover:bg-stance-steel/5"
                    onClick={() => { setPatientId(''); setPatientName(''); }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Appointment Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="appointmentId" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stance-steel/60">
                <Calendar className="h-3.5 w-3.5" />
                Appointment
                {loadingEvents && <Loader2 className="h-3 w-3 animate-spin text-stance-steel/30" />}
              </Label>
              <Select
                value={appointmentId}
                onValueChange={handleAppointmentChange}
                disabled={!patientId || loadingEvents}
              >
                <SelectTrigger className="h-11 bg-white border-stance-steel/10 rounded-xl text-stance-grey text-sm focus:ring-stance-steel/20">
                  <SelectValue placeholder={loadingEvents ? 'Loading appointments...' : 'Select an appointment'} />
                </SelectTrigger>
                <SelectContent>
                  {loadingEvents ? (
                    <div className="flex items-center justify-center p-3 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-stance-steel/40" />
                      <span className="text-sm text-stance-steel/50">Loading...</span>
                    </div>
                  ) : events.length > 0 ? (
                    events.map((event) => (
                      <SelectItem key={event._id} value={event.appointment?._id || event._id} className="text-sm">
                        {`#${event.appointment?.seqNo || 'N/A'} – ${new Date(event.appointment?.event?.startTime).toLocaleDateString()}`}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-stance-steel/40 text-center">No appointments found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Form Type Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="formKey" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stance-steel/60">
                <ClipboardList className="h-3.5 w-3.5" />
                Form Type
              </Label>
              <Select value={formKey} onValueChange={setFormKey} disabled={!appointmentId}>
                <SelectTrigger className="h-11 bg-white border-stance-steel/10 rounded-xl text-stance-grey text-sm focus:ring-stance-steel/20">
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

            <button
              type="submit"
              className="w-full h-12 mt-2 bg-stance-steel text-white font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-stance-steel/90 active:scale-[0.98] transition-all shadow-[0_4px_24px_rgba(14,27,42,0.2)] ring-2 ring-stance-neon ring-offset-2 ring-offset-[#F0F3F8]"
            >
              Start Session
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/25">
          Stance Health · Clinician Portal
        </p>
      </div>
    </div>
  );
};

export default Index;
