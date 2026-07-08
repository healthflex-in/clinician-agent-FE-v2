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
      className="h-[100dvh] bg-stance-steel flex flex-col overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header bar — stays in steel */}
      <header className="bg-stance-steel/80 backdrop-blur-md shrink-0">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex flex-col leading-none">
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-semibold">Stance Health</span>
            <span className="font-display text-base font-bold text-white mt-0.5">Clinician Agent</span>
          </div>
          <div className="h-8 w-8 rounded-xl bg-white/8 flex items-center justify-center">
            <Mic className="h-4 w-4 text-stance-neon" />
          </div>
        </div>

        {/* Step progress bar */}
        <div className="flex gap-1 px-5 pb-3">
          {steps.map((step, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === getProgressStep();
            const isDone = stepNum < getProgressStep();
            return (
              <div key={step} className="flex flex-col items-start gap-0.5 flex-1">
                <div className={`h-1 w-full rounded-full transition-all ${isDone || isActive ? 'bg-stance-neon' : 'bg-white/10'}`} />
                <span className={`text-[8px] font-bold uppercase tracking-wider ${isDone || isActive ? 'text-stance-neon/70' : 'text-white/20'}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Full-width #F0F3F8 card with rounded top corners only */}
      <div className="flex-1 min-h-0 bg-[#F0F3F8] rounded-t-[32px] md:rounded-t-[48px] mt-2 overflow-y-auto shadow-[0_-8px_32px_rgba(0,0,0,0.2)]">
        <div className="max-w-lg mx-auto px-6 py-8 space-y-5">
          {/* Page title */}
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold text-stance-steel">Start a Session</h1>
            <p className="text-stance-steel/40 text-sm">Select center, patient and appointment to begin</p>
          </div>

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

          <p className="text-center text-[11px] text-stance-steel/25 pb-8">
            Stance Health · Clinician Portal
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
