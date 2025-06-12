import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SuggestionBoxProps {
  suggestions: string;
  onClose: () => void;
}

export const SuggestionBox: React.FC<SuggestionBoxProps> = ({
  suggestions,
  onClose,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Try to parse suggestions if they look like JSON
  const parsedSuggestions = (() => {
    try {
      // Check if the suggestions contain what looks like a JSON array
      if (
        typeof suggestions === 'string' &&
        suggestions.includes('[') &&
        suggestions.includes(']')
      ) {
        // Extract the JSON array part
        const jsonText = suggestions.substring(
          suggestions.indexOf('['),
          suggestions.lastIndexOf(']') + 1
        );

        return JSON.parse(jsonText);
      }
      return null;
    } catch (e) {
      return null;
    }
  })();

  return (
    <Alert
      variant="default"
      className="relative bg-primary-100 border-primary-300 text-primary-900 rounded-lg shadow-md"
    >
      <AlertCircle className="h-4 w-4 text-primary-700" />
      <AlertTitle className="text-sm font-semibold">AI Suggestions</AlertTitle>

      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full hover:bg-primary-200 touch-manipulation"
        onClick={onClose}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Close</span>
      </Button>

      <AlertDescription className="mt-1">
        {parsedSuggestions ? (
          <div className="text-xs">
            <ul className="list-disc pl-5 space-y-1">
              {/* Show first 2 suggestions if not expanded, all if expanded */}
              {parsedSuggestions
                .slice(0, isExpanded ? undefined : 2)
                .map((suggestion: string, index: number) => (
                  <li key={index} className="text-primary-800">
                    {suggestion}
                  </li>
                ))}
            </ul>

            {parsedSuggestions.length > 2 && (
              <Button
                variant="link"
                size="sm"
                className="text-xs text-primary-700 p-0 mt-1 h-auto touch-manipulation"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded
                  ? 'Show less'
                  : `Show ${parsedSuggestions.length - 2} more`}
              </Button>
            )}
          </div>
        ) : (
          <div className="text-xs whitespace-pre-wrap">{suggestions}</div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default SuggestionBox;
