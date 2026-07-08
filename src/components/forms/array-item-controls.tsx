import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Copy, PlusCircle, MinusCircle } from 'lucide-react';

interface ArrayItemControlsProps {
  itemPath: string;
  arrayPath: string;
  canRemove: boolean;
  onAdd: (arrayPath: string) => void;
  onRemove: (itemPath: string) => void;
  onDuplicate?: (itemPath: string) => void;
  showDuplicate?: boolean;
  addButtonText?: string;
  removeButtonText?: string;
  className?: string;
  showOnlyAdd?: boolean;
  showOnlyRemove?: boolean;
  variant?: 'default' | 'compact';
}

export const ArrayItemControls: React.FC<ArrayItemControlsProps> = ({
  itemPath,
  arrayPath,
  canRemove,
  onAdd,
  onRemove,
  onDuplicate,
  showDuplicate = false,
  addButtonText = 'Add',
  removeButtonText = 'Remove',
  className = '',
  showOnlyAdd = false,
  showOnlyRemove = false,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Add Button - only show if not showOnlyRemove */}
      {!showOnlyRemove && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd(arrayPath)}
          className={`flex items-center gap-1 h-8 text-xs font-semibold border-stance-steel/15 text-stance-steel/60 hover:text-stance-steel hover:border-stance-steel/30 hover:bg-stance-steel/5 rounded-xl touch-manipulation`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{addButtonText}</span>
        </Button>
      )}

      {/* Remove Button - only show if not showOnlyAdd */}
      {!showOnlyAdd && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(itemPath)}
          disabled={!canRemove}
          className="h-7 w-7 p-0 rounded-full text-stance-steel/25 hover:text-red-400 hover:bg-red-50 touch-manipulation disabled:opacity-30"
          title={!canRemove ? 'At least one item is required' : removeButtonText}
        >
          <Minus className="w-3.5 h-3.5" />
          <span className="sr-only">{removeButtonText}</span>
        </Button>
      )}

      {/* Duplicate Button (optional) */}
      {showDuplicate && onDuplicate && !showOnlyAdd && !showOnlyRemove && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDuplicate(itemPath)}
          className="flex items-center gap-1 h-8 touch-manipulation"
        >
          <Copy className="w-4 h-4" />
          <span>Duplicate</span>
        </Button>
      )}
    </div>
  );
};
