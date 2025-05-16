
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ThemeProvider } from '@/styles/theme-provider';

// Define the FirstAssessment page parameters
type FirstAssessmentParams = {
  patientId: string;
  appointmentId: string;
};

const FirstAssessmentPage = () => {
  const { patientId, appointmentId } = useParams<FirstAssessmentParams>();
  const [patientName, setPatientName] = useState<string>('Patient');
  const { toast } = useToast();

  // Fetch patient name on component mount
  useEffect(() => {
    // Try to get patient name from localStorage
    const fetchPatientName = () => {
      if (!patientId) return;
      
      try {
        const storedPatient = localStorage.getItem('selectedPatient');
        if (storedPatient) {
          const patientData = JSON.parse(storedPatient);
          if (patientData && patientData.name) {
            setPatientName(patientData.name);
          }
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
      }
    };

    fetchPatientName();
    
    // Log for debugging
    console.log('FirstAssessmentPage loaded with params:', { patientId, appointmentId });
  }, [patientId, appointmentId]);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col items-center p-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="w-full max-w-4xl space-y-6 pb-16">
          {/* Header with patient info */}
          <Card className="w-full bg-card">
            <CardHeader>
              <CardTitle className="text-center text-2xl font-bold">
                First Assessment - {patientName}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Placeholder content */}
          <Card className="w-full shadow-md">
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                First Assessment form will be implemented here.
                <br />
                Patient ID: {patientId}
                <br />
                Appointment ID: {appointmentId}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default FirstAssessmentPage;
