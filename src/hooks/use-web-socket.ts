import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { WebSocketMessage } from '@/types/form';

const WS_API_KEY = import.meta.env.VITE_WS_API_KEY || '';

interface WebSocketOptions {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onFormData?: (formData: any) => void | boolean;
}

export function useWebSocket(options: WebSocketOptions) {
  const { toast } = useToast();
  const callbacks = React.useRef(options);
  callbacks.current = options;
  const [formData, setFormData] = React.useState<any>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<Event | null>(null);
  const [transcription, setTranscription] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<any>(null);
  const [recommendations, setRecommendations] = React.useState<any>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const intentionalClose = React.useRef(false);
  const reconnectAttempts = React.useRef(0);
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const requestTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = React.useRef(0);
  const sequence = React.useRef(0);
  const lastRequestId = React.useRef<string | null>(null);
  const pending = React.useRef<{ id: string; expectsForm: boolean } | null>(null);
  const connectRef = React.useRef<() => void>(() => {});

  const finishRequest = React.useCallback(() => {
    if (requestTimer.current !== null) clearTimeout(requestTimer.current);
    requestTimer.current = null;
    pending.current = null;
    setIsProcessing(false);
  }, []);

  const clearConnectionTimers = React.useCallback(() => {
    if (heartbeatTimer.current !== null) clearInterval(heartbeatTimer.current);
    if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    heartbeatTimer.current = null;
    reconnectTimer.current = null;
  }, []);

  const disconnect = React.useCallback(() => {
    intentionalClose.current = true;
    clearConnectionTimers();
    finishRequest();
    lastRequestId.current = null;
    const socket = wsRef.current;
    wsRef.current = null;
    // Detached handlers prevent a deliberate close/unmount from reconnecting.
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, [clearConnectionTimers, finishRequest]);

  const connect = React.useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;
    intentionalClose.current = false;
    clearConnectionTimers();
    setIsConnecting(true);
    try {
      const socket = new WebSocket(options.url);
      wsRef.current = socket;
      socket.onopen = () => {
        if (wsRef.current !== socket || intentionalClose.current) return;
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttempts.current = 0;
        lastActivity.current = Date.now();
        socket.send(JSON.stringify({ payloadType: 'authentication', apiKey: WS_API_KEY }));
        heartbeatTimer.current = setInterval(() => {
          if (Date.now() - lastActivity.current > 90000) socket.close();
        }, 15000);
        callbacks.current.onOpen?.();
      };
      socket.onclose = () => {
        if (wsRef.current !== socket) return;
        wsRef.current = null;
        clearConnectionTimers();
        finishRequest();
        lastRequestId.current = null;
        setIsConnected(false);
        setIsConnecting(false);
        if (!intentionalClose.current && reconnectAttempts.current < 20) {
          const delay = Math.min(1000 * Math.pow(1.5, ++reconnectAttempts.current), 10000);
          reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
        } else callbacks.current.onClose?.();
      };
      socket.onerror = (event) => {
        if (wsRef.current !== socket) return;
        setError(event);
        callbacks.current.onError?.(event);
        socket.close();
      };
      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return;
        lastActivity.current = Date.now();
        try {
          const data = JSON.parse(event.data);
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
          if (data.type === 'server_ping') {
            socket.send(JSON.stringify({ type: 'server_pong', ping_number: data.ping_number }));
            return;
          }
          if (data.type === 'pong' || data.type === 'authenticated') return;
          // New servers echo IDs. Untagged responses remain supported during rollout.
          if (data.requestId && data.requestId !== lastRequestId.current) return;
          if (data.error) {
            finishRequest();
            toast({ title: 'Error from server', description: data.error, variant: 'destructive' });
            return;
          }
          if (data.transcription !== undefined) {
            setTranscription(data.transcription);
            if (!pending.current?.expectsForm || data.processingComplete) finishRequest();
          }
          const receivedForm = data.formData ?? data.form_data;
          if (receivedForm) {
            setFormData(receivedForm);
            setTranscription('');
            finishRequest();
            // Exactly one normalized callback, including for older snake-case responses.
            const applied = callbacks.current.onFormData?.({ ...data, payloadType: 'structured', formData: receivedForm });
            if (applied !== false) toast({ title: 'Form Updated', description: 'Form data has been processed and updated' });
          }
          if (data.suggestions !== undefined) setSuggestions(data.suggestions);
          if (data.realTimeRecommendations !== undefined) setRecommendations(data.realTimeRecommendations);
        } catch {
          finishRequest();
          toast({ title: 'Processing Error', description: 'Failed to parse server response', variant: 'destructive' });
        }
      };
    } catch {
      setIsConnecting(false);
      toast({ title: 'Connection Error', description: 'Failed to connect to transcription service', variant: 'destructive' });
    }
  }, [options.url, clearConnectionTimers, finishRequest, toast]);
  connectRef.current = connect;

  React.useEffect(() => () => disconnect(), [disconnect, options.url]);

  const sendMessage = React.useCallback((message: WebSocketMessage) => {
    const socket = wsRef.current;
    if (socket?.readyState !== WebSocket.OPEN || pending.current) return false;
    const id = `${Date.now()}-${++sequence.current}`;
    const expectsForm = !!(message.formData || message.form_data) &&
      (!!message.text || message.mode !== 'transcribe_only');
    pending.current = { id, expectsForm };
    lastRequestId.current = id;
    setIsProcessing(true);
    setSuggestions(null);
    setRecommendations(null);
    try {
      socket.send(JSON.stringify({ ...message, requestId: id, apiKey: WS_API_KEY }));
      requestTimer.current = setTimeout(() => {
        finishRequest();
        lastRequestId.current = null;
        toast({ title: 'Processing timed out', description: 'Please reconnect and try again.', variant: 'destructive' });
        socket.close();
      }, 180000);
      return true;
    } catch {
      finishRequest();
      socket.close();
      return false;
    }
  }, [finishRequest, toast]);

  const identity = () => ({
    userId: localStorage.getItem('userId') || '',
    AppointmentId: localStorage.getItem('appointmentId') || '',
    formKey: localStorage.getItem('formKey') || 'assessment',
  });
  const sendAudio = React.useCallback((base64Audio: string, currentFormData?: any) => {
    const context = identity();
    const form = currentFormData
      ? transformFormDataForAPI(currentFormData.formData || currentFormData, context.formKey)
      : undefined;
    return sendMessage({
      ...context,
      payloadType: 'audio',
      mode: form ? 'form_fill' : 'transcribe_only',
      audio: base64Audio.startsWith('data:') ? base64Audio : `data:audio/wav;base64,${base64Audio}`,
      formData: form,
    });
  }, [sendMessage]);
  const processTranscription = React.useCallback((text: string, currentFormData?: any) => {
    if (!text.trim() || !currentFormData) return false;
    const context = identity();
    return sendMessage({
      ...context,
      payloadType: 'text',
      mode: 'form_fill',
      text,
      formData: transformFormDataForAPI(currentFormData.formData || currentFormData, context.formKey),
    });
  }, [sendMessage]);

  return {
    isConnected, isConnecting, isProcessing, error, connect, disconnect,
    sendMessage, sendAudio, processTranscription, transcription, formData,
    suggestions, recommendations, setTranscription, setSuggestions, setRecommendations,
  };
}

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
