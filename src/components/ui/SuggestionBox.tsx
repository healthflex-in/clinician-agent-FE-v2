
import React, { useEffect, useState, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SuggestionBoxProps {
  suggestions: string | null;
  onClose?: () => void;
  autoHideTime?: number; // in milliseconds
}

const SuggestionBox: React.FC<SuggestionBoxProps> = ({
  suggestions,
  onClose,
  autoHideTime = 7000
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Process suggestions to extract the first two if they're in JSON format
  const processedSuggestions = () => {
    if (!suggestions) return [];
    
    try {
      // Check if suggestions contains JSON array
      if (typeof suggestions === 'string' && suggestions.includes('[')) {
        const jsonStart = suggestions.indexOf('[');
        const jsonEnd = suggestions.lastIndexOf(']') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonContent = suggestions.substring(jsonStart, jsonEnd);
          const parsedSuggestions = JSON.parse(jsonContent);
          // Only take the first two suggestions
          return parsedSuggestions.slice(0, 2);
        }
      }
      // If it's already an array, return first two items
      if (Array.isArray(suggestions)) {
        return suggestions.slice(0, 2);
      }
      // If it's just a string, return it as a single item array
      return [suggestions];
    } catch (e) {
      console.error('Error parsing suggestions:', e);
      // Return original suggestions as text if parsing fails
      return [suggestions];
    }
  };

  // Handle auto-hiding
  useEffect(() => {
    if (suggestions && isVisible) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Set new timer
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, autoHideTime);
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [suggestions, isVisible, autoHideTime, onClose]);

  if (!suggestions || !isVisible) return null;

  const suggestionsArray = processedSuggestions();

  return (
    <Alert 
      variant="default" 
      className="mb-6 bg-slate-900 text-white border-slate-800 relative animate-fade-in"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-primary-light">Suggestions</AlertTitle>
      <AlertDescription>
        <div className="text-sm whitespace-pre-wrap max-h-20 overflow-y-auto pr-6">
          {Array.isArray(suggestionsArray) && suggestionsArray.length > 0 ? (
            <ul className="list-disc pl-5 mb-0">
              {suggestionsArray.map((suggestion, index) => (
                <li key={index} className="mb-1 last:mb-0">{suggestion}</li>
              ))}
            </ul>
          ) : (
            <p>{suggestions}</p>
          )}
        </div>
      </AlertDescription>
      <button
        onClick={() => {
          setIsVisible(false);
          if (onClose) onClose();
        }}
        className="absolute right-2 top-2 text-white/70 hover:text-white transition-colors"
        aria-label="Close suggestions"
      >
        <X size={16} />
      </button>
    </Alert>
  );
};

export default SuggestionBox;
