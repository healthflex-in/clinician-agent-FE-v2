
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { X, MessageSquare } from 'lucide-react';
import { themeColors } from '@/styles/theme';
import { motion, AnimatePresence } from 'framer-motion';

interface SuggestionBoxProps {
  suggestions: string;
  onClose: () => void;
  autoCloseDelay?: number;
  maxLines?: number;
}

const SuggestionBox: React.FC<SuggestionBoxProps> = ({ 
  suggestions, 
  onClose, 
  autoCloseDelay = 7000,
  maxLines = 2
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [parsedSuggestions, setParsedSuggestions] = useState<string[]>([]);

  // Parse the suggestions when they change
  useEffect(() => {
    if (typeof suggestions === 'string') {
      try {
        // Try to extract JSON array if it's in markdown code format
        if (suggestions.includes('[') && suggestions.includes(']')) {
          const jsonStart = suggestions.indexOf('[');
          const jsonEnd = suggestions.lastIndexOf(']') + 1;
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonContent = suggestions.substring(jsonStart, jsonEnd);
            const parsed = JSON.parse(jsonContent);
            if (Array.isArray(parsed)) {
              // Limit to the first two suggestions
              setParsedSuggestions(parsed.slice(0, 2));
              return;
            }
          }
        }
        // If not parseable as JSON array, use the raw string
        setParsedSuggestions([suggestions]);
      } catch (e) {
        console.error('Error parsing suggestions:', e);
        setParsedSuggestions([suggestions]);
      }
    } else {
      setParsedSuggestions([]);
    }
  }, [suggestions]);

  // Auto-close after delay
  useEffect(() => {
    if (autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoCloseDelay, onClose]);

  // Handle manual close
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <Card className="bg-slate-800 text-white border-slate-700 shadow-lg p-4 relative">
            <div className="flex items-start">
              <MessageSquare className="h-5 w-5 mr-2 mt-0.5 text-primary" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1 text-primary-light">AI Suggestions</h4>
                <div 
                  className="text-sm overflow-y-auto text-slate-200"
                  style={{ 
                    maxHeight: `${1.5 * maxLines}rem`,  // Set max height based on line-height and max lines
                    lineHeight: '1.5rem'
                  }}
                >
                  {parsedSuggestions.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {parsedSuggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No suggestions available</p>
                  )}
                </div>
              </div>
              <button 
                onClick={handleClose}
                className="ml-2 p-1 hover:bg-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-light"
                aria-label="Close suggestions"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuggestionBox;
