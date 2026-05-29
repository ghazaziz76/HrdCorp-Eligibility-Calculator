// usePlanSeed(initialPlan, setters)
//   setters = { fieldKey: setterFn, ... } — one entry per useState the form owns.
// When initialPlan changes (and on mount), for each key present in both
// `initialPlan.inputs` and `setters`, calls setters[key](initialPlan.inputs[key]).
import { useEffect } from 'react';

export default function usePlanSeed(initialPlan, setters) {
  useEffect(() => {
    if (!initialPlan || !initialPlan.inputs) return;
    for (const k of Object.keys(setters)) {
      if (k in initialPlan.inputs) setters[k](initialPlan.inputs[k]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlan]);
}
