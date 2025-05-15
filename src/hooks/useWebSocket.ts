
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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
  realTimeRecommendations?: string;
  error?: string;
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
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  
  const wsRef = useRef<WebSocket | null>(null);
  const autoProcessTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) return;
    
    try {
      setIsConnecting(true);
      
      // Use hardcoded WebSocket URL
      const wsUrl = 'ws://localhost:8080/ws';
      console.log('Attempting to connect to WebSocket at:', wsUrl);
      
      // Add the API key as a header if possible
      // Note: Custom headers aren't directly supported in native WebSocket
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        if (onOpen) onOpen();
        
        // Send an initial message with the API key
        // This is a workaround since headers can't be sent directly
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            payloadType: 'authentication',
            apiKey: '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20'
          }));
        }
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
          
          // Handle different response types
          if (data.error) {
            console.error('Server error:', data.error);
            toast({
              title: "Error from server",
              description: data.error,
              variant: "destructive",
            });
            setIsProcessing(false);
            return;
          }
          
          if (data.transcription !== undefined) {
            setTranscription(data.transcription);
            
            // We'll let the component handle auto-processing, not here
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
            
            toast({
              title: "Form Updated",
              description: "Form data has been processed and updated",
            });
          }

          // Handle structured data format with suggestions
          if (data.payloadType === 'structured') {
            if (data.formData) {
              setFormData(data.formData);
              console.log('Structured form data received:', data.formData);
              
              // Forward form data to parent component if callback is provided
              if (onFormData) {
                onFormData(data.formData);
              }
              
              toast({
                title: "Form Updated",
                description: "Form data has been processed and updated",
              });
            }
            
            if (data.suggestions) {
              setSuggestions(data.suggestions);
              console.log('Suggestions received:', data.suggestions);
            }
            
            if (data.realTimeRecommendations) {
              setRecommendations(data.realTimeRecommendations);
              console.log('Recommendations received:', data.realTimeRecommendations);
            }
          }
          
          // Set processing to false when we receive any response
          setIsProcessing(false);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
          setIsProcessing(false);
          toast({
            title: "Processing Error",
            description: "Failed to parse server response",
            variant: "destructive",
          });
        }
      };
    } catch (e) {
      setIsConnecting(false);
      setError(e as any);
      console.error('WebSocket connection error:', e);
      toast({
        title: "Connection Error",
        description: "Failed to establish WebSocket connection",
        variant: "destructive",
      });
    }
  }, [url, isConnecting, onOpen, onClose, onError, onFormData, toast]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (autoProcessTimeoutRef.current) {
      clearTimeout(autoProcessTimeoutRef.current);
      autoProcessTimeoutRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      console.log('Sending message:', message);
      
      // Add API key to every message
      const messageWithAuth = {
        ...message,
        apiKey: '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20'
      };
      
      wsRef.current.send(JSON.stringify(messageWithAuth));
      return true;
    }
    return false;
  }, []);
  
  const sendAudio = useCallback((base64Audio: string, currentFormData?: any) => {
    // Get user ID and appointment ID from localStorage or route params
    const userId = localStorage.getItem('userId') || '';
    const appointmentId = localStorage.getItem('appointmentId') || '';
    const formKey = localStorage.getItem('formKey') || 'snc';
    
    // Make sure the audio is in the correct format (data URL)
    let audioData = base64Audio;
    if (!audioData.startsWith('data:')) {
      audioData = `data:audio/wav;base64,${audioData.split(',')[1] || audioData}`;
    }
    
    // Format for audio payload
    const payload: WebSocketMessage = {
      payloadType: 'audio',
      audio: audioData,
      userId,
      appointmentId,
      formKey,
      formIndex: 0, // Default to first form
      storeInChat: true
    };
    
    // If form data is provided, include it
    if (currentFormData) {
      // Format form data according to formKey
      const formDataObj: any = {};
      
      if (formKey === 'physio') {
        // For physio form, we need to structure it with assessment keys
        const assessmentData = Array.isArray(currentFormData) ? 
          currentFormData.reduce((acc, item, index) => {
            acc[`assessment${index + 1}`] = {
              Test_Name: item.testName || '',
              Unit_Name: item.unitName || '',
              Value: item.value || '',
              Right_Value: item.rightValue || '',
              Left_Value: item.leftValue || '',
              comments: item.comments || '',
            };
            return acc;
          }, {}) : 
          { assessment1: currentFormData };
          
        payload.formData = assessmentData;
        
        // Also include form_data for backward compatibility
        if (Array.isArray(currentFormData) && currentFormData[0]) {
          payload.form_data = {
            Test_Name: currentFormData[0].testName || '',
            Unit_Name: currentFormData[0].unitName || '',
            Value: currentFormData[0].value || '',
            Right_Value: currentFormData[0].rightValue || '',
            Left_Value: currentFormData[0].leftValue || '',
            comments: currentFormData[0].comments || '',
          };
        }
      } else {
        // For other form types
        payload.formData = currentFormData;
      }
    }
    
    console.log('Sending audio payload:', payload);
    return sendMessage(payload);
  }, [sendMessage]);

  const processTranscription = useCallback((transcriptionText: string, currentFormData?: any) => {
    // Get user ID and appointment ID from localStorage or route params
    const userId = localStorage.getItem('userId') || '';
    const appointmentId = localStorage.getItem('appointmentId') || '';
    const formKey = localStorage.getItem('formKey') || 'snc';
    
    // Payload for text + form data
    const payload: WebSocketMessage = {
      payloadType: 'text',
      text: transcriptionText,
      userId,
      appointmentId,
      formKey,
      formIndex: 0 // Default to first form
    };
    
    // Include form data if available
    if (currentFormData) {
      // Format form data according to formKey
      if (formKey === 'physio') {
        // For physio form, we need to structure it with assessment keys
        const assessmentData = Array.isArray(currentFormData) ? 
          currentFormData.reduce((acc, item, index) => {
            acc[`assessment${index + 1}`] = {
              Test_Name: item.testName || '',
              Unit_Name: item.unitName || '',
              Value: item.value || '',
              Right_Value: item.rightValue || '',
              Left_Value: item.leftValue || '',
              comments: item.comments || '',
            };
            return acc;
          }, {}) : 
          { assessment1: currentFormData };
          
        payload.formData = assessmentData;
        
        // Also include form_data for backward compatibility
        if (Array.isArray(currentFormData) && currentFormData[0]) {
          payload.form_data = {
            Test_Name: currentFormData[0].testName || '',
            Unit_Name: currentFormData[0].unitName || '',
            Value: currentFormData[0].value || '',
            Right_Value: currentFormData[0].rightValue || '',
            Left_Value: currentFormData[0].leftValue || '',
            comments: currentFormData[0].comments || '',
          };
        }
      } else {
        // For other form types
        payload.formData = currentFormData;
      }
    }
    
    console.log('Processing transcription with payload:', payload);
    return sendMessage(payload);
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (autoProcessTimeoutRef.current) {
        clearTimeout(autoProcessTimeoutRef.current);
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
    recommendations,
    setTranscription,
    setSuggestions,
    setRecommendations
  };
}
