
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SuggestionBoxProps {
  suggestions: string | string[] | null;
  onClose?: () => void;
}

const SuggestionBox: React.FC<SuggestionBoxProps> = ({ suggestions, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide after 7 seconds
  useEffect(() => {
    if (suggestions) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, [suggestions, onClose]);

  if (!suggestions || !isVisible) return null;

  // Process suggestions
  const processedSuggestions = (() => {
    if (typeof suggestions === 'string' && suggestions.includes('[') && suggestions.includes(']')) {
      try {
        // Try to parse as JSON if it looks like JSON
        const suggestionsText = suggestions.substring(
          suggestions.indexOf('['),
          suggestions.lastIndexOf(']') + 1
        );
        const parsedSuggestions = JSON.parse(suggestionsText);
        // Show only the first two suggestions
        return parsedSuggestions.slice(0, 2);
      } catch (e) {
        // If parsing fails, show as regular text
        return [suggestions];
      }
    } else if (Array.isArray(suggestions)) {
      // Already an array, take first two
      return suggestions.slice(0, 2);
    } else {
      // Regular string
      return [suggestions];
    }
  })();

  return (
    <Alert variant="default" className="mb-6 bg-slate-900 text-white border-slate-800 relative">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-white font-semibold">Suggestions</AlertTitle>
      <AlertDescription>
        <div className="text-sm whitespace-pre-wrap max-h-16 overflow-y-auto">
          {Array.isArray(processedSuggestions) ? (
            <ul className="list-disc pl-5">
              {processedSuggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          ) : (
            processedSuggestions
          )}
        </div>
      </AlertDescription>
      <button 
        onClick={() => {
          setIsVisible(false);
          if (onClose) onClose();
        }}
        className="absolute top-2 right-2 text-gray-400 hover:text-white"
      >
        ✕
      </button>
    </Alert>
  );
};

export default SuggestionBox;
