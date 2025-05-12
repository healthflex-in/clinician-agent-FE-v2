
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
  [key: string]: any;
}

interface ServerResponse {
  transcription?: string;
  form_data?: any;
  formData?: any;
  [key: string]: any;
}

export function useWebSocket(options: WebSocketOptions) {
  const { url, onOpen, onClose, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [formData, setFormData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) return;
    
    try {
      setIsConnecting(true);
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
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
          const data = JSON.parse(event.data) as ServerResponse;
          
          if (data.transcription) {
            setTranscription(data.transcription);
            setIsProcessing(false);
          }
          
          if (data.form_data || data.formData) {
            const formDataResponse = data.form_data || data.formData;
            setFormData(formDataResponse);
            console.log('Form data received:', formDataResponse);
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
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  const sendAudio = useCallback((base64Audio: string) => {
    const userId = localStorage.getItem('userId') || 'default-user';
    const appointmentId = localStorage.getItem('appointmentId') || 'default-appointment';
    
    const payload: WebSocketMessage = {
      payloadType: 'audio',
      audio: base64Audio,
      userId,
      appointmentId,
      formKey: 'physio',
      operation_mode: 'transcribe and fill',
    };
    
    return sendMessage(payload);
  }, [sendMessage]);

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
    transcription,
    formData,
    setTranscription,
  };
}
