import { describe, expect, it, vi } from 'vitest';
import { formReducer } from './form-renderer.reducer';
import { findProvidedDifferences } from '@/utils/schema-utils';

describe('nested row editing', () => {
  it('highlights only fields supplied and changed by the latest AI response', () => {
    const before = { plan: { advice: 'old' }, rpe: { value: 4 }, untouched: 'keep' };
    expect(findProvidedDifferences(before, { plan: { advice: 'new' }, rpe: { value: 4 } }))
      .toEqual(['plan.advice']);
  });
  it('merges AI data without invoking render-time notifications or setters', () => {
    const toast = vi.fn();
    const setter = vi.fn();
    expect(formReducer({ value: 1 }, toast, {}, {
      type: 'MERGE_LLM_DATA', source: 'llm', data: { value: 2 },
    }, setter)).toEqual({ value: 2 });
    expect(toast).not.toHaveBeenCalled();
    expect(setter).not.toHaveBeenCalled();
  });
  it('adds and removes nested sets without mutating the previous form', () => {
    const initial = { plan: { plans: [{ set: [{ repetitions: 10 }] }] } };
    const added = formReducer(initial, vi.fn(), {}, {
      type: 'ADD_ARRAY_ITEM', arrayPath: 'plan.plans.0.set', item: { repetitions: 12 },
    }, vi.fn());
    expect(added.plan.plans[0].set).toEqual([{ repetitions: 10 }, { repetitions: 12 }]);
    expect(initial.plan.plans[0].set).toEqual([{ repetitions: 10 }]);
    const removed = formReducer(added, vi.fn(), {}, {
      type: 'REMOVE_ARRAY_ITEM', arrayPath: 'plan.plans.0.set', itemIndex: 0,
    }, vi.fn());
    expect(removed.plan.plans[0].set).toEqual([{ repetitions: 12 }]);
    expect(added.plan.plans[0].set).toHaveLength(2);
  });
});
