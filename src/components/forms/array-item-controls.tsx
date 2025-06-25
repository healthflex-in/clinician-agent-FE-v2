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
          size={isCompact ? 'sm' : 'sm'}
          onClick={() => onAdd(arrayPath)}
          className={`flex items-center gap-1 ${
            isCompact ? 'h-8 text-xs' : 'h-8'
          } touch-manipulation`}
        >
          {isCompact ? (
            <PlusCircle className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>{addButtonText}</span>
        </Button>
      )}

      {/* Remove Button - only show if not showOnlyAdd */}
      {!showOnlyAdd && (
        <Button
          type="button"
          variant={isCompact ? 'ghost' : 'outline'}
          size="sm"
          onClick={() => onRemove(itemPath)}
          disabled={!canRemove}
          className={`flex items-center gap-1 ${
            isCompact ? 'h-8 w-8 p-0' : 'h-8'
          } touch-manipulation`}
          title={
            !canRemove ? 'At least one item is required' : removeButtonText
          }
        >
          {isCompact ? (
            <MinusCircle className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
          {!isCompact && <span>{removeButtonText}</span>}
          {isCompact && <span className="sr-only">{removeButtonText}</span>}
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
