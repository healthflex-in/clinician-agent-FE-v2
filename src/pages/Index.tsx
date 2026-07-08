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
      {/* Subtle background glow accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 left-1/3 w-[500px] h-[500px] bg-stance-neon/6 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-stance-stone/8 rounded-full blur-[100px]" />
      </div>

      {/* Top nav — brand only, no progress */}
      <header className="relative shrink-0 px-6 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-white.png" alt="Stance Health" className="h-8 w-auto" />
          <div className="w-px h-5 bg-white/15" />
          <span className="font-display text-sm font-bold text-white/70">Clinician Agent</span>
        </div>
      </header>

      {/* Step progress bar — thin strip just below nav */}
      <div className="relative flex gap-1 px-6 pb-4">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === getProgressStep();
          const isDone = stepNum < getProgressStep();
          return (
            <div key={step} className="flex flex-col items-start gap-1 flex-1">
              <div className={`h-[3px] w-full rounded-full transition-all duration-500 ${isDone ? 'bg-stance-neon' : isActive ? 'bg-stance-neon/60' : 'bg-white/10'}`} />
              <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${isDone || isActive ? 'text-stance-neon/60' : 'text-white/18'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Full-width light card — rounded top corners only */}
      <div className="relative flex-1 min-h-0 bg-[#F0F3F8] rounded-t-[32px] md:rounded-t-[48px] shadow-[0_-8px_40px_rgba(0,0,0,0.25)] overflow-y-auto">
        <div className="max-w-md mx-auto px-6 py-8 flex flex-col gap-6">

          {/* Page heading */}
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-semibold text-stance-steel tracking-tight">
              Start a Session
            </h1>
            <p className="text-[14px] text-stance-steel/45 leading-relaxed">
              Select center, patient and appointment to begin
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">

            {/* Center */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-stance-steel/50">
                <Building className="h-3 w-3" /> Center
              </label>
              <Select value={centerId} onValueChange={handleCenterChange}>
                <SelectTrigger className="h-12 bg-white border border-stance-steel/10 rounded-2xl text-stance-steel/80 text-sm shadow-sm focus:ring-1 focus:ring-stance-steel/20">
                  <SelectValue placeholder="Select a center" />
                </SelectTrigger>
                <SelectContent>
                  {loadingCenters ? (
                    <div className="flex items-center gap-2 p-3">
                      <Loader2 className="h-4 w-4 animate-spin text-stance-steel/40" />
                      <span className="text-sm text-stance-steel/50">Loading centers...</span>
                    </div>
                  ) : (
                    centers.map((center) => (
                      <SelectItem key={center._id} value={center._id} className="text-sm">{center.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Patient */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-stance-steel/50">
                <User className="h-3 w-3" /> Patient
              </label>
              <div className="relative">
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name..."
                  disabled={!centerId}
                  className="h-12 bg-white border border-stance-steel/10 rounded-2xl text-stance-steel/80 text-sm placeholder:text-stance-steel/25 shadow-sm focus-visible:ring-1 focus-visible:ring-stance-steel/20 disabled:opacity-40"
                />
                {loadingPatients && <Loader2 className="absolute right-4 top-3.5 h-4 w-4 animate-spin text-stance-steel/30" />}
              </div>
              {patients.length > 0 && (
                <div className="bg-white border border-stance-steel/10 rounded-2xl overflow-hidden max-h-44 overflow-y-auto shadow-lg">
                  {patients.map((patient) => (
                    <div
                      key={patient._id}
                      onClick={() => selectPatient(patient)}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-stance-steel/5 cursor-pointer text-sm border-b border-stance-steel/5 last:border-0 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-stance-neon/15 border border-stance-neon/20 flex items-center justify-center flex-shrink-0">
                        <User className="h-3.5 w-3.5 text-stance-steel/60" />
                      </div>
                      <span className="text-stance-steel/80 font-medium">
                        {patient.profileData.firstName} {patient.profileData.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {patientId && patientName && (
                <div className="px-4 py-3 bg-stance-neon/8 border border-stance-neon/25 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-stance-steel/70" />
                    <span className="text-sm font-semibold text-stance-steel">{patientName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPatientId(''); setPatientName(''); }}
                    className="text-[11px] font-semibold text-stance-steel/40 hover:text-stance-steel/70 transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Appointment */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-stance-steel/50">
                <Calendar className="h-3 w-3" /> Appointment
                {loadingEvents && <Loader2 className="h-3 w-3 animate-spin text-stance-steel/30" />}
              </label>
              <Select value={appointmentId} onValueChange={handleAppointmentChange} disabled={!patientId || loadingEvents}>
                <SelectTrigger className="h-12 bg-white border border-stance-steel/10 rounded-2xl text-stance-steel/80 text-sm shadow-sm focus:ring-1 focus:ring-stance-steel/20 disabled:opacity-40">
                  <SelectValue placeholder={loadingEvents ? 'Loading...' : 'Select an appointment'} />
                </SelectTrigger>
                <SelectContent>
                  {loadingEvents ? (
                    <div className="flex items-center gap-2 p-3">
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

            {/* Form Type */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-stance-steel/50">
                <ClipboardList className="h-3 w-3" /> Form Type
              </label>
              <Select value={formKey} onValueChange={setFormKey} disabled={!appointmentId}>
                <SelectTrigger className="h-12 bg-white border border-stance-steel/10 rounded-2xl text-stance-steel/80 text-sm shadow-sm focus:ring-1 focus:ring-stance-steel/20 disabled:opacity-40">
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

            {/* CTA — neon background, steel text, matching customer-agent-fe */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-stance-neon text-stance-steel font-semibold text-[14px] rounded-2xl py-4 px-6 hover:bg-stance-neon/90 active:scale-[0.98] transition-all duration-150 shadow-[0_4px_24px_rgba(221,254,113,0.25)] mt-2"
            >
              Start Session
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </button>

          </form>

          <p className="text-center text-[11px] text-stance-steel/25 pb-4">
            Stance Health · Clinician Portal
          </p>

        </div>
      </div>
    </div>
  );
};

export default Index;
