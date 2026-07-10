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
  const connectRef = React.useRef<() => void>(() => {});

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
      console.log('WebSocket Connecting to:', wsUrl); // ADDED LOG

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket Connected'); // ADDED LOG
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
        console.log('WebSocket Disconnected'); // ADDED LOG
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
          // Use ref so we always call the latest connect (avoids stale closure)
          setTimeout(() => connectRef.current(), delay);
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
          console.log('WebSocket Response:', JSON.stringify(data, null, 2)); // ADDED LOG

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

              // Clear transcription so the auto-process timer doesn't fire a
              // duplicate form-fill request (form was already filled by the backend
              // in the single audio+form pipeline)
              setTranscription('');

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
    console.log('WebSocket Disconnecting'); // ADDED LOG
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

      console.log(
        'WebSocket Payload:',
        JSON.stringify(messageWithAuth, null, 2)
      ); // ADDED LOG
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

      const transformedFormData = currentFormData
        ? transformFormDataForAPI(
            currentFormData.formData || currentFormData,
            formKey
          )
        : undefined;

      // If we have form data, use 'form_fill' mode so the backend transcribes
      // AND fills the form in a single pipeline — eliminates the 5-second
      // auto-process timer round-trip and cuts total latency in half.
      const payload = {
        userId,
        AppointmentId: appointmentId,
        formKey,
        mode: transformedFormData ? 'form_fill' : 'transcribe_only',
        audio: audioData,
        formData: transformedFormData,
        apiKey:
          '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20',
      };

      console.log('WebSocket Payload:', JSON.stringify(payload, null, 2));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        setIsProcessing(true);
        wsRef.current.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    []
  );

  const processTranscription = React.useCallback(
    (transcriptionText: string, currentFormData?: any) => {
      // Get user ID and appointment ID from localStorage or route params
      const userId = localStorage.getItem('userId') || '';
      const appointmentId = localStorage.getItem('appointmentId') || '';
      const formKey = localStorage.getItem('formKey') || 'physio';

      // FIXED: Use actual form data from currentFormData parameter
      const payload = {
        userId,
        AppointmentId: appointmentId, // Note: Capital 'A'
        formKey,
        mode: 'transcribe_only',
        text: transcriptionText,
        formData: currentFormData
          ? transformFormDataForAPI(
              currentFormData.formData || currentFormData,
              formKey
            )
          : undefined, // Only send if we have actual form data
        apiKey:
          '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20',
      };

      console.log('WebSocket Payload:', JSON.stringify(payload, null, 2));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        setIsProcessing(true);
        wsRef.current.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    []
  );

  // FIXED: transformFormDataForAPI function to send prefilled values when they exist, defaults when they don't
  const transformFormDataForAPI = (formData: any, formKey: string) => {
    if (formKey === 'assessment') {
      // Check if form has actual data vs empty/default state
      const hasAdvice =
        formData?.plan?.advice && formData.plan.advice.trim() !== '';
      const hasPlans =
        formData?.plan?.plans?.length > 0 &&
        formData.plan.plans.some(
          (plan: any) =>
            (plan.exercise && plan.exercise.trim() !== '') ||
            (plan.comments && plan.comments.trim() !== '') ||
            (plan.set?.length > 0 &&
              plan.set.some(
                (set: any) =>
                  set.repetitions > 0 ||
                  (set.load && set.load.trim() !== '') ||
                  (set.unit && set.unit.trim() !== '')
              )) ||
            plan.duration?.value > 0 ||
            (plan.duration?.unit && plan.duration.unit.trim() !== '')
        );
      const hasObjectiveTests =
        formData?.objectiveAssessment?.tests?.length > 0 &&
        formData.objectiveAssessment.tests.some(
          (test: any) =>
            (test.testName && test.testName.trim() !== '') ||
            (test.unitName && test.unitName.trim() !== '') ||
            test.value > 0 ||
            test.left > 0 ||
            test.right > 0 ||
            (test.comments && test.comments.trim() !== '')
        );
      const hasSubjectiveAssessment =
        formData?.subjectiveAssessment?.assessment &&
        formData.subjectiveAssessment.assessment.trim() !== '';
      const hasRPE = formData?.rpe?.value && formData.rpe.value > 0;

      const transformed = {
        plan: {
          advice: hasAdvice ? formData.plan.advice : '', // Send prefilled or empty
          plans: hasPlans
            ? formData.plan.plans.map((plan: any) => ({
                exercise: plan.exercise || '',
                set:
                  plan.set?.length > 0
                    ? plan.set.map((set: any) => ({
                        repetitions: parseInt(set.repetitions) || 0,
                        load: String(set.load || ''),
                        unit: String(set.unit || ''),
                      }))
                    : [{ repetitions: 0, load: '', unit: '' }], // Default single set if no set
                duration: {
                  value: parseInt(plan.duration?.value) || 0,
                  unit: String(plan.duration?.unit || ''),
                },
                comments: plan.comments || '',
              }))
            : [
                {
                  // Send default plan structure if no actual plans
                  exercise: '',
                  set: [{ repetitions: 0, load: '', unit: '' }],
                  duration: { value: 0, unit: '' },
                  comments: '',
                },
              ],
        },
        objectiveAssessment: hasObjectiveTests
          ? formData.objectiveAssessment.tests.map((test: any) => ({
              testName: test.testName || '',
              unitName: test.unitName || '',
              value: parseFloat(test.value) || 0,
              left: parseFloat(test.left) || 0,
              right: parseFloat(test.right) || 0,
              comments: test.comments || '',
            }))
          : [
              {
                // Send default test structure if no actual tests
                testName: '',
                unitName: '',
                value: 0,
                left: 0,
                right: 0,
                comments: '',
              },
            ],
        subjectiveAssessments: hasSubjectiveAssessment
          ? formData.subjectiveAssessment.assessment
          : '', // Send prefilled or empty
        rpe: hasRPE ? parseInt(formData.rpe.value) : 0, // Send prefilled or 0
      };
      return transformed;
    }

    if (formKey === 'snc') {
      // Check if form has actual data vs empty/default state
      const hasAdvice = formData?.advice && formData.advice.trim() !== '';
      const hasPlans =
        formData?.plans?.length > 0 &&
        formData.plans.some(
          (plan: any) =>
            (plan.exercise && plan.exercise.trim() !== '') ||
            (plan.comments && plan.comments.trim() !== '') ||
            (plan.set?.length > 0 &&
              plan.set.some(
                (set: any) =>
                  set.repetitions > 0 ||
                  (set.load && set.load.trim() !== '') ||
                  (set.unit && set.unit.trim() !== '')
              )) ||
            plan.duration?.value > 0 ||
            (plan.duration?.unit && plan.duration.unit.trim() !== '')
        );

      const transformed = {
        advice: hasAdvice ? formData.advice : '', // Send prefilled or empty
        plans: hasPlans
          ? formData.plans.map((plan: any) => ({
              exercise: plan.exercise || '',
              set:
                plan.set?.length > 0
                  ? plan.set.map((set: any) => ({
                      repetitions: parseInt(set.repetitions) || 0,
                      load: String(set.load || ''),
                      unit: String(set.unit || ''),
                    }))
                  : [{ repetitions: 0, load: '', unit: '' }], // Default single set if no set
              duration: {
                value: parseInt(plan.duration?.value) || 0,
                unit: String(plan.duration?.unit || ''),
              },
              comments: plan.comments || '',
            }))
          : [
              {
                // Send default plan structure if no actual plans
                exercise: '',
                set: [{ repetitions: 0, load: '', unit: '' }],
                duration: { value: 0, unit: '' },
                comments: '',
              },
            ],
      };
      return transformed;
    }

    // For other form types, return actual data or empty object
    return formData || {};
  };

  // ADDED: Transform API response format to form format
  const transformAPIResponseToFormFormat = (apiData: any) => {
    // Transform API response structure to match form expectations
    const transformed = {
      plan: {
        advice: apiData.plan?.advice || '',
        plans:
          apiData.plan?.plans?.map((plan: any) => ({
            exercise: plan.exercise || '',
            comments: plan.comments || '',
            // Transform API 'set' array to form 'set' array
            set: Array.isArray(plan.set)
              ? plan.set.map((set: any) => ({
                  repetitions: set.repetitions || 0,
                  load: set.load || '',
                  unit: set.unit || '',
                }))
              : [{ repetitions: 0, load: '', unit: '' }],
            duration: {
              value: plan.duration?.value || 0,
              unit: plan.duration?.unit || '',
            },
          })) || [],
      },
      subjectiveAssessment: {
        // Transform API 'subjectiveAssessments' string to form object
        assessment: apiData.subjectiveAssessments || '',
      },
      objectiveAssessment: {
        // Transform API 'objectiveAssessment' array to form structure
        tests: Array.isArray(apiData.objectiveAssessment)
          ? apiData.objectiveAssessment.map((test: any) => ({
              testName: test.testName || '',
              unitName: test.unitName || '',
              value: test.value || 0,
              left: test.left || 0,
              right: test.right || 0,
              comments: test.comments || '',
            }))
          : [],
      },
      rpe: {
        // Transform API 'rpe' number to form object
        value: apiData.rpe || 0,
      },
    };

    return transformed;
  };

  // Keep ref pointing to latest connect so setTimeout callbacks are never stale
  React.useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

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
