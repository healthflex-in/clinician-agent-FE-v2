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
  autoProcessDelay = 800,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);

  // Handle auto-resizing of textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Handle auto-processing of transcriptions
  useEffect(() => {
    if (
      value &&
      value.trim() !== '' &&
      autoProcess &&
      !isAutoProcessing &&
      !isProcessing
    ) {
      setIsAutoProcessing(true);

      // Small delay to allow the user to see the transcription before auto-processing
      const timer = setTimeout(() => {
        autoProcess();
        setIsAutoProcessing(false);
      }, autoProcessDelay);

      return () => clearTimeout(timer);
    }
  }, [value, autoProcess, isAutoProcessing, isProcessing, autoProcessDelay]);

  return (
    <div className={`relative w-full ${className}`}>
      <label
        htmlFor="transcription"
        className="block text-sm font-medium text-[#DDFE71] mb-1"
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
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[120px] w-full p-4 bg-white border-[#DDFE71]/30 focus:border-[#DDFE71] 
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
