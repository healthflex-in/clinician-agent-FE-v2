import React, { useRef, useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Loader } from 'lucide-react';

interface TranscriptBoxProps {
  value: string;
  onChange: (value: string) => void;
  isProcessing: boolean;
  className?: string;
  autoProcess?: () => void;
  autoProcessDelay?: number;
}

const TranscriptBox: React.FC<TranscriptBoxProps> = ({
  value,
  onChange,
  isProcessing,
  className,
  autoProcess,
  autoProcessDelay = 5000, // Default to 5 seconds of inactivity
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const autoProcessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<string>(value);

  // Handle auto-resizing of textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Handle auto-processing after inactivity
  useEffect(() => {
    // Clear existing timeout if value changes
    if (autoProcessTimeoutRef.current) {
      clearTimeout(autoProcessTimeoutRef.current);
      autoProcessTimeoutRef.current = null;
    }

    // Only set timeout if there is text and it's different from before
    if (
      value &&
      value.trim() !== '' &&
      autoProcess &&
      !isProcessing &&
      value !== lastValueRef.current
    ) {
      lastValueRef.current = value;

      // Set new timeout - only process after inactivity period
      autoProcessTimeoutRef.current = setTimeout(() => {
        if (!isProcessing) {
          setIsAutoProcessing(true);

          // Perform auto-processing
          autoProcess();

          // Reset auto-processing state after a short delay
          setTimeout(() => {
            setIsAutoProcessing(false);
          }, 1000);
        }
      }, autoProcessDelay);
    }

    // Clean up timeout on unmount
    return () => {
      if (autoProcessTimeoutRef.current) {
        clearTimeout(autoProcessTimeoutRef.current);
      }
    };
  }, [value, autoProcess, isProcessing, autoProcessDelay]);

  // Custom onChange handler that updates the value and resets timeout
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <div className={`relative w-full ${className}`}>
      <label
        htmlFor="transcription"
        className="block text-sm font-medium text-[#7a7a7a] mb-1"
      >
        Transcription {isAutoProcessing && '(Auto-processing...)'}
      </label>
      <Textarea
        id="transcription"
        ref={textareaRef}
        placeholder={
          isProcessing
            ? 'Processing audio...'
            : 'Transcription will appear here...'
        }
        value={value}
        onChange={handleInputChange}
        className={`min-h-[120px] w-full p-4 bg-white border-[#7a7a7a]/30 focus:border-[#DDFE71] 
                   rounded-lg shadow-sm resize-none transition-all duration-200 ease-in-out
                   ${
                     isProcessing || isAutoProcessing ? 'bg-secondary/50' : ''
                   }`}
      />
      {(isProcessing || isAutoProcessing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 rounded-lg backdrop-blur-[1px] mt-7">
          <div className="flex flex-col items-center">
            <Loader className="h-6 w-6 text-[#DDFE71] animate-spin" />
            <span className="mt-2 font-medium text-sm text-[#DDFE71]">
              {isAutoProcessing ? 'Auto-processing...' : 'Processing audio...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptBox;
