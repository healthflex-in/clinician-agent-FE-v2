import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { WebSocketMessage, ServerResponse } from '@/types/form';

interface WebSocketOptions {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onFormData?: (formData: any) => void;
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
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 20;

  // Heartbeat refs
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastServerPingRef = useRef<number>(0);
  const pingInterval = 30000; // 30 seconds
  const pingTimeout = 10000; // 10 seconds

  // Clear heartbeat timer
  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat monitoring
  const startHeartbeat = useCallback(() => {
    clearHeartbeatTimer();
    lastServerPingRef.current = Date.now();

    // Monitor for server pings and check connection health
    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastPing = now - lastServerPingRef.current;

      // If we haven't received a server ping within the expected interval + timeout
      if (timeSinceLastPing > pingInterval + pingTimeout) {
        console.warn('Connection appears stale - no server ping received');

        // Try to reconnect
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
    }, pingInterval);
  }, [clearHeartbeatTimer, pingInterval, pingTimeout]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) return;

    try {
      setIsConnecting(true);

      const wsUrl = url;
      console.log('Attempting to connect to WebSocket at:', wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Start heartbeat monitoring
        startHeartbeat();

        if (onOpen) onOpen();

        // Send initial authentication message
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              payloadType: 'authentication',
              apiKey:
                '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20',
            })
          );

          // Send initial ping to test connectivity
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'ping',
                  timestamp: Date.now(),
                })
              );
            }
          }, 1000);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsConnecting(false);
        clearHeartbeatTimer();

        // Attempt to reconnect if not max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(
            1000 * Math.pow(1.5, reconnectAttemptsRef.current),
            10000
          );
          setTimeout(() => connect(), delay);
        } else {
          console.log('Max reconnect attempts reached');
        }

        if (onClose) onClose();
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError(event);
        setIsConnecting(false);
        clearHeartbeatTimer();
        if (onError) onError(event);
      };

      wsRef.current.onmessage = (event) => {
        try {
          console.log('Message received:', event.data);
          const data = JSON.parse(event.data);
          console.log('WebSocket data:', data);

          // Handle heartbeat messages first
          if (data.type === 'pong') {
            console.debug('Received application pong');
            return;
          }

          if (data.type === 'server_ping') {
            console.debug('Received server ping:', data);
            // Update last ping time
            lastServerPingRef.current = Date.now();

            // Respond with server_pong
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'server_pong',
                  timestamp: Date.now(),
                  ping_number: data.ping_number,
                })
              );
            }
            return;
          }

          // Handle regular server responses - cast back to ServerResponse
          const serverResponse = data as ServerResponse;

          // Handle different response types
          if (serverResponse.error) {
            console.error('Server error:', serverResponse.error);
            toast({
              title: 'Error from server',
              description: serverResponse.error,
              variant: 'destructive',
            });
            setIsProcessing(false);
            return;
          }

          if (serverResponse.transcription !== undefined) {
            setTranscription(serverResponse.transcription);
            setIsProcessing(false);
          }

          if (serverResponse.form_data || serverResponse.formData) {
            const formDataResponse =
              serverResponse.form_data || serverResponse.formData;
            setFormData(formDataResponse);
            console.log('Form data received:', formDataResponse);

            // Forward form data to parent component if callback is provided
            if (onFormData) {
              onFormData(formDataResponse);
            }

            toast({
              title: 'Form Updated',
              description: 'Form data has been processed and updated',
            });
          }

          // Handle structured data format with suggestions
          if (serverResponse.payloadType === 'structured') {
            if (serverResponse.formData) {
              setFormData(serverResponse.formData);
              console.log(
                'Structured form data received:',
                serverResponse.formData
              );

              // Forward form data to parent component if callback is provided
              if (onFormData) {
                onFormData(serverResponse.formData);
              }

              toast({
                title: 'Form Updated',
                description: 'Form data has been processed and updated',
              });
            }

            if (serverResponse.suggestions) {
              setSuggestions(serverResponse.suggestions);
              console.log('Suggestions received:', serverResponse.suggestions);
            }

            if (serverResponse.realTimeRecommendations) {
              setRecommendations(serverResponse.realTimeRecommendations);
              console.log(
                'Recommendations received:',
                serverResponse.realTimeRecommendations
              );
            }
          }

          // Set processing to false when we receive any response
          setIsProcessing(false);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
          setIsProcessing(false);
          toast({
            title: 'Processing Error',
            description: 'Failed to parse server response',
            variant: 'destructive',
          });
        }
      };
    } catch (e) {
      setIsConnecting(false);
      setError(e as any);
      console.error('WebSocket connection error:', e);
      toast({
        title: 'Connection Error',
        description: 'Failed to establish WebSocket connection',
        variant: 'destructive',
      });
    }
  }, [
    url,
    isConnecting,
    onOpen,
    onClose,
    onError,
    onFormData,
    toast,
    startHeartbeat,
    clearHeartbeatTimer,
  ]);

  const disconnect = useCallback(() => {
    clearHeartbeatTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearHeartbeatTimer]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      console.log('Sending message:', message);

      // Add API key to every message
      const messageWithAuth = {
        ...message,
        apiKey:
          '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20',
      };

      wsRef.current.send(JSON.stringify(messageWithAuth));
      return true;
    }
    return false;
  }, []);

  const sendAudio = useCallback(
    (base64Audio: string, currentFormData?: any) => {
      // Get user ID and appointment ID from localStorage or route params
      const userId = localStorage.getItem('userId') || '';
      const appointmentId = localStorage.getItem('appointmentId') || '';
      const formKey = localStorage.getItem('formKey') || 'physio';

      // Make sure the audio is in the correct format (data URL)
      let audioData = base64Audio;
      if (!audioData.startsWith('data:')) {
        audioData = `data:audio/wav;base64,${
          audioData.split(',')[1] || audioData
        }`;
      }

      // Format for audio payload
      const payload: WebSocketMessage = {
        payloadType: 'audio',
        audio: audioData,
        userId,
        appointmentId,
        formKey,
        formIndex: 0, // Default to first form
        storeInChat: true,
      };

      // If form data is provided, include it
      if (currentFormData) {
        payload.formData = currentFormData;
      }

      console.log('Sending audio payload:', payload);
      return sendMessage(payload);
    },
    [sendMessage]
  );

  const processTranscription = useCallback(
    (transcriptionText: string, currentFormData?: any) => {
      // Get user ID and appointment ID from localStorage or route params
      const userId = localStorage.getItem('userId') || '';
      const appointmentId = localStorage.getItem('appointmentId') || '';
      const formKey = localStorage.getItem('formKey') || 'physio';

      // Payload for text + form data
      const payload: WebSocketMessage = {
        payloadType: 'text',
        text: transcriptionText,
        userId,
        appointmentId,
        formKey,
        formIndex: 0, // Default to first form
      };

      // Include form data if available
      if (currentFormData) {
        payload.formData = currentFormData;
      }

      console.log('Processing transcription with payload:', payload);
      return sendMessage(payload);
    },
    [sendMessage]
  );

  useEffect(() => {
    return () => {
      clearHeartbeatTimer();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearHeartbeatTimer]);

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
    setRecommendations,
  };
}
