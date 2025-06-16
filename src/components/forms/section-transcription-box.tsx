import React, { useRef, useEffect, useState } from 'react';
import { Loader } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface SectionTranscriptionBoxProps {
  value: string;
  label?: string;
  sectionId: string;
  className?: string;
  placeholder?: string;
  isProcessing: boolean;
  autoProcess?: boolean;
  autoProcessDelay?: number;
  onProcess: () => void;
  onChange: (value: string) => void;
}

const SectionTranscriptionBox: React.FC<SectionTranscriptionBoxProps> = ({
  value,
  onChange,
  isProcessing,
  onProcess,
  sectionId,
  className = '',
  autoProcess = true,
  label = 'Transcription',
  autoProcessDelay = 5000,
  placeholder = 'Section transcription will appear here...',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [userEditing, setUserEditing] = useState(false);
  const lastEditTimestamp = useRef<number>(0);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle auto-resizing of textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Track user activity and auto-process after inactivity
  useEffect(() => {
    // When value changes, note it as a potential edit
    if (value) {
      lastEditTimestamp.current = Date.now();

      // Clear any existing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }

      // Set a new timeout to check for inactivity
      if (autoProcess && !isProcessing && !isAutoProcessing) {
        processingTimeoutRef.current = setTimeout(() => {
          // If no edits in the delay period, process transcription
          const timeSinceLastEdit = Date.now() - lastEditTimestamp.current;
          if (timeSinceLastEdit >= autoProcessDelay && value.trim() !== '') {
            setIsAutoProcessing(true);
            onProcess();
            setUserEditing(false);

            setTimeout(() => {
              setIsAutoProcessing(false);
            }, 800);
          }
        }, autoProcessDelay);
      }
    }

    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, [
    value,
    autoProcess,
    isProcessing,
    isAutoProcessing,
    autoProcessDelay,
    onProcess,
  ]);

  // Handle user interaction with the textarea
  const handleUserInteraction = () => {
    setUserEditing(true);
    lastEditTimestamp.current = Date.now();
  };

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label
          htmlFor={`section-transcription-${sectionId}`}
          className="block text-sm font-medium text-text-dark mb-1"
        >
          {label} {isAutoProcessing && '(Auto-processing...)'}
        </label>
      )}
      <Textarea
        id={`section-transcription-${sectionId}`}
        ref={textareaRef}
        placeholder={isProcessing ? 'Processing audio...' : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleUserInteraction}
        onMouseDown={handleUserInteraction}
        className={`min-h-[100px] w-full p-3 bg-white border-primary/30 focus:border-primary 
                   rounded-lg shadow-sm resize-none transition-all duration-200 ease-in-out
                   ${isProcessing || isAutoProcessing ? 'bg-secondary/5' : ''}`}
      />
      {(isProcessing || isAutoProcessing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 rounded-lg backdrop-blur-[1px] mt-7">
          <div className="flex flex-col items-center">
            <Loader className="h-5 w-5 text-primary animate-spin" />
            <span className="mt-2 font-medium text-xs text-text-dark">
              {isAutoProcessing ? 'Auto-processing...' : 'Processing audio...'}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-2">
        <Button
          onClick={onProcess}
          size="sm"
          variant="secondary"
          disabled={isProcessing || !value.trim()}
        >
          Process
        </Button>
      </div>
    </div>
  );
};

export default SectionTranscriptionBox;
