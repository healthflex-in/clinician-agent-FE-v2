import { describe, expect, it, vi } from 'vitest';
import { formReducer } from './form-renderer.reducer';

describe('nested row editing', () => {
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
