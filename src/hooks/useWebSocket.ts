
import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketOptions {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onFormData?: (formData: any) => void;
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
  const { url, onOpen, onClose, onError, onFormData } = options;
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
      
      // Hardcoded WebSocket URL as requested
      const wsUrl = 'ws://localhost:8080/ws';
      console.log('Attempting to connect to WebSocket at:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        if (onOpen) onOpen();
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsConnecting(false);
        if (onClose) onClose();
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
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
            
            // Forward form data to parent component if callback is provided
            if (onFormData) {
              onFormData(formDataResponse);
            }
          }

          // Handle structured data format with suggestions
          if (data.payloadType === 'structured' && data.formData) {
            setFormData(data.formData);
            console.log('Structured form data received:', data.formData);
            
            // Forward form data to parent component if callback is provided
            if (onFormData) {
              onFormData(data.formData);
            }
            
            if (data.suggestions) {
              setSuggestions(data.suggestions);
              console.log('Suggestions received:', data.suggestions);
            }
          }
          
          // Set processing to false when we receive any response
          setIsProcessing(false);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
          setIsProcessing(false);
        }
      };
    } catch (e) {
      setIsConnecting(false);
      setError(e as any);
      console.error('WebSocket connection error:', e);
    }
  }, [url, isConnecting, onOpen, onClose, onError, onFormData]);

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
  
  const sendAudio = useCallback((base64Audio: string, currentFormData?: any) => {
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
    
    // Exactly matching the payload format from the HTML file
    const payload: WebSocketMessage = {
      payloadType: 'audio',
      audio: base64Audio,
      userId: finalUserId,
      appointmentId: finalAppointmentId,
      formKey: 'snc',  // Using 'snc' form key as in the original file
    };
    
    // If form data is provided, include it in the payload
    if (currentFormData) {
      payload.formData = currentFormData;
    }
    
    console.log('Sending audio with payload:', payload);
    return sendMessage(payload);
  }, [sendMessage]);

  const processTranscription = useCallback((transcriptionText: string, currentFormData?: any) => {
    // Get user ID and appointment ID from localStorage, matching the original implementation
    const selectedPatient = localStorage.getItem('selectedPatient');
    const userId = selectedPatient ? JSON.parse(selectedPatient)._id : '';
    
    const selectedAppointment = localStorage.getItem('selectedAppointment');
    const appointmentId = selectedAppointment ? JSON.parse(selectedAppointment)._id : '';
    
    // If not available in localStorage, use default values
    const finalUserId = userId || localStorage.getItem('userId') || '';
    const finalAppointmentId = appointmentId || localStorage.getItem('appointmentId') || '';
    
    // Using the original payload format that worked in the first version
    const payload: WebSocketMessage = {
      payloadType: 'text',
      text: transcriptionText,
      userId: finalUserId,
      appointmentId: finalAppointmentId,
      formKey: 'snc',
    };
    
    // Include any existing form data or passed current form data
    payload.formData = currentFormData || formData || {};
    
    console.log('Processing transcription with payload:', payload);
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
