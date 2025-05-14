
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import formSchemas from '@/schemas/formSchemas';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formKey, setFormKey] = useState<string>('snc');
  const [patientId, setPatientId] = useState<string>('');
  const [appointmentId, setAppointmentId] = useState<string>('');
  
  // Get previous values from localStorage
  useEffect(() => {
    const savedPatientId = localStorage.getItem('userId');
    const savedAppointmentId = localStorage.getItem('appointmentId');
    
    if (savedPatientId) setPatientId(savedPatientId);
    if (savedAppointmentId) setAppointmentId(savedAppointmentId);
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate form
    if (!formKey) {
      toast({
        title: "Form Selection Required",
        description: "Please select a form type",
        variant: "destructive",
      });
      return;
    }
    
    // Generate random IDs if not provided
    const finalPatientId = patientId || `user-${Math.random().toString(36).substring(2, 9)}`;
    const finalAppointmentId = appointmentId || `apt-${Math.random().toString(36).substring(2, 9)}`;
    
    // Store in localStorage
    localStorage.setItem('userId', finalPatientId);
    localStorage.setItem('appointmentId', finalAppointmentId);
    
    // Navigate to form page
    navigate(`/${formKey}/${finalPatientId}/${finalAppointmentId}`);
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
            <div className="space-y-2">
              <Label htmlFor="formKey">Form Type</Label>
              <Select 
                value={formKey} 
                onValueChange={setFormKey}
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
            
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID (Optional)</Label>
              <Input
                id="patientId"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Enter patient ID or leave blank for demo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="appointmentId">Appointment ID (Optional)</Label>
              <Input
                id="appointmentId"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
                placeholder="Enter appointment ID or leave blank for demo"
              />
            </div>
            
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              Start Session
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex-col gap-2">
          <p className="text-sm text-muted-foreground text-center">
            Select a form type and optionally provide patient and appointment IDs.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Random IDs will be generated if not provided.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Index;
