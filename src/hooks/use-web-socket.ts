import React from 'react';
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
  const { toast } = useToast();
  const { url, onOpen, onClose, onError, onFormData } = options;

  const maxReconnectAttempts = 20;
  const PING_INTERVAL = 300000; // 300 seconds
  const CONNECTION_TIMEOUT = 80000; // 80 seconds

  const [formData, setFormData] = React.useState<any>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<Event | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [transcription, setTranscription] = React.useState<string>('');
  const [suggestions, setSuggestions] = React.useState<string | null>(null);
  const [recommendations, setRecommendations] = React.useState<string | null>(
    null
  );

  const wsRef = React.useRef<WebSocket | null>(null);
  const lastServerPingRef = React.useRef<number>(0);
  const reconnectAttemptsRef = React.useRef<number>(0);
  const heartbeatIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear heartbeat timer
  const clearHeartbeatTimer = React.useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat monitoring
  const startHeartbeat = React.useCallback(() => {
    clearHeartbeatTimer();
    lastServerPingRef.current = Date.now();

    // Monitor for server pings and check connection health
    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastPing = now - lastServerPingRef.current;

      // If we haven't received a server ping within the expected interval + timeout
      if (timeSinceLastPing > CONNECTION_TIMEOUT) {
        console.warn('Connection appears stale - no server ping received');

        // Try to reconnect
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
    }, PING_INTERVAL);
  }, [clearHeartbeatTimer, PING_INTERVAL, CONNECTION_TIMEOUT]);

  const connect = React.useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) return;

    try {
      setIsConnecting(true);

      const wsUrl = url;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
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
        } else if (onClose) onClose();
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
          const data = JSON.parse(event.data);

          // Handle heartbeat messages first
          if (data.type === 'pong') {
            console.debug('Received application pong');
            return;
          }

          // Handle server ping (already implemented correctly)
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

              // Forward form data to parent component if callback is provided
              if (onFormData) {
                onFormData(serverResponse);
              }

              toast({
                title: 'Form Updated',
                description: 'Form data has been processed and updated',
              });
            }

            if (serverResponse.suggestions) {
              setSuggestions(serverResponse.suggestions);
            }

            if (serverResponse.realTimeRecommendations) {
              setRecommendations(serverResponse.realTimeRecommendations);
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

  const disconnect = React.useCallback(() => {
    clearHeartbeatTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearHeartbeatTimer]);

  const sendMessage = React.useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);

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

  const sendAudio = React.useCallback(
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

      return sendMessage(payload);
    },
    [sendMessage]
  );

  const processTranscription = React.useCallback(
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

      return sendMessage(payload);
    },
    [sendMessage]
  );

  React.useEffect(() => {
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
