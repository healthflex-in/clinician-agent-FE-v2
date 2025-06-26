import React from 'react';
import { Loader } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface TranscriptionBoxProps {
  value: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  isProcessing?: boolean;
  autoProcessDelay?: number;

  autoProcess?: () => void;
  onChange: (value: string) => void;
}

export const TranscriptionBox: React.FC<TranscriptionBoxProps> = ({
  value,
  onChange,
  autoProcess,
  className = '',
  disabled = false,
  isProcessing = false,
  autoProcessDelay = 10000,
  placeholder = 'Type your transcription here...',
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Simple auto-processing
  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.trim() && autoProcess && !isProcessing) {
      timeoutRef.current = setTimeout(() => {
        autoProcess();
      }, autoProcessDelay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, autoProcess, autoProcessDelay, isProcessing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const isDisabled = disabled || isProcessing;

  return (
    <div className={`relative w-full ${className}`}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        disabled={isDisabled}
        placeholder={placeholder}
        className={`
          min-h-[120px] w-full p-4 
          bg-white border-gray-300 
          focus:border-primary focus:ring-1 focus:ring-primary
          rounded-lg shadow-sm resize-none 
          transition-all duration-200 ease-in-out
          ${isProcessing ? 'bg-gray-50' : ''}
          ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}
        `}
      />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader className="h-5 w-5 text-primary animate-spin" />
            <span className="text-sm font-medium text-gray-700">
              Processing...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionBox;
