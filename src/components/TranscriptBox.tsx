
import React, { useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface TranscriptBoxProps {
  value: string;
  onChange: (value: string) => void;
  isProcessing: boolean;
  className?: string;
}

const TranscriptBox: React.FC<TranscriptBoxProps> = ({
  value,
  onChange,
  isProcessing,
  className
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className={`relative w-full ${className}`}>
      <Textarea
        ref={textareaRef}
        placeholder={isProcessing ? "Processing audio..." : "Transcription will appear here..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[120px] w-full p-4 bg-white border-parrot-300 focus:border-parrot-500 
                   rounded-lg shadow-sm resize-none transition-all duration-200 ease-in-out
                   ${isProcessing ? 'bg-secondary/50' : ''}`}
      />
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 rounded-lg backdrop-blur-[1px]">
          <div className="flex flex-col items-center">
            <div className="h-6 w-6 border-4 border-t-parrot-500 border-r-parrot-300 border-b-parrot-300 border-l-parrot-300 rounded-full animate-spin"></div>
            <span className="mt-2 font-medium text-sm text-parrot-700">Processing audio...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptBox;
