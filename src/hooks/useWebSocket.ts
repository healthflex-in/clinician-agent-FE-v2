
import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketOptions {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

interface WebSocketMessage {
  payloadType: string;
  audio?: string;
  userId?: string;
  appointmentId?: string;
  formKey?: string;
  operation_mode?: string;
  text?: string;
  formData?: any;
  form_data?: any;
  [key: string]: any;
}

interface ServerResponse {
  transcription?: string;
  form_data?: any;
  formData?: any;
  payloadType?: string;
  suggestions?: string;
  [key: string]: any;
}

export function useWebSocket(options: WebSocketOptions) {
  const { url, onOpen, onClose, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [formData, setFormData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) return;
    
    try {
      setIsConnecting(true);
      // Use the same WebSocket URL pattern as the original file
      const wsUrl = url || `${window.location.origin.replace(/^http/, 'ws')}/ws`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        if (onOpen) onOpen();
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        if (onClose) onClose();
      };

      wsRef.current.onerror = (event) => {
        setError(event);
        setIsConnecting(false);
        if (onError) onError(event);
      };

      wsRef.current.onmessage = (event) => {
        try {
          console.log('Message received:', event.data);
          const data = JSON.parse(event.data) as ServerResponse;
          console.log('data--> ', data);
          
          if (data.transcription !== undefined) {
            setTranscription(data.transcription);
            setIsProcessing(false);
          }
          
          if (data.form_data || data.formData) {
            const formDataResponse = data.form_data || data.formData;
            setFormData(formDataResponse);
            console.log('Form data received:', formDataResponse);
          }

          // Handle structured data format with suggestions
          if (data.payloadType === 'structured' && data.formData) {
            setFormData(data.formData);
            console.log('Structured form data received:', data.formData);
            
            if (data.suggestions) {
              setSuggestions(data.suggestions);
              console.log('Suggestions received:', data.suggestions);
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
    } catch (e) {
      setIsConnecting(false);
      setError(e as any);
      console.error('WebSocket connection error:', e);
    }
  }, [url, isConnecting, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      console.log('Sending message:', message);
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  const sendAudio = useCallback((base64Audio: string) => {
    // Get user ID and appointment ID from localStorage, matching the original implementation
    const selectedPatient = localStorage.getItem('selectedPatient');
    const userId = selectedPatient ? JSON.parse(selectedPatient)._id : '';
    
    const selectedAppointment = localStorage.getItem('selectedAppointment');
    const appointmentId = selectedAppointment ? JSON.parse(selectedAppointment)._id : '';
    
    // If not available in localStorage, use default values
    const finalUserId = userId || localStorage.getItem('userId') || `user-${Math.random().toString(36).substring(2, 9)}`;
    const finalAppointmentId = appointmentId || localStorage.getItem('appointmentId') || `apt-${Math.random().toString(36).substring(2, 9)}`;
    
    // Save defaults if not already stored
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', finalUserId);
    }
    if (!localStorage.getItem('appointmentId')) {
      localStorage.setItem('appointmentId', finalAppointmentId);
    }
    
    const payload: WebSocketMessage = {
      payloadType: 'audio',
      audio: base64Audio,
      userId: finalUserId,
      appointmentId: finalAppointmentId,
      formKey: 'snc',  // Using 'snc' form key as in the original file
    };
    
    return sendMessage(payload);
  }, [sendMessage]);

  const processTranscription = useCallback((transcriptionText: string) => {
    // Get user ID and appointment ID from localStorage, matching the original implementation
    const selectedPatient = localStorage.getItem('selectedPatient');
    const userId = selectedPatient ? JSON.parse(selectedPatient)._id : '';
    
    const selectedAppointment = localStorage.getItem('selectedAppointment');
    const appointmentId = selectedAppointment ? JSON.parse(selectedAppointment)._id : '';
    
    // If not available in localStorage, use default values
    const finalUserId = userId || localStorage.getItem('userId') || '';
    const finalAppointmentId = appointmentId || localStorage.getItem('appointmentId') || '';
    
    // Prepare form data in the expected format
    const payload: WebSocketMessage = {
      payloadType: 'text',
      text: transcriptionText,
      userId: finalUserId,
      appointmentId: finalAppointmentId,
      formKey: 'snc',
      // Include any existing form data
      formData: formData || {},
    };
    
    return sendMessage(payload);
  }, [sendMessage, formData]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    isProcessing,
    error,
    connect,
    disconnect,
    sendMessage,
    sendAudio,
    processTranscription,
    transcription,
    formData,
    suggestions,
    setTranscription,
    setSuggestions,
  };
}
