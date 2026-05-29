// Holds a transient "open this plan next" intent for hand-off from the
// My Plans tab to the Calculator tab. One-shot: consumeOpen() clears it.
import React, { createContext, useContext, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function SavedPlansProvider({ children }) {
  const [pendingOpen, setPendingOpen] = useState(null);
  const requestOpen = useCallback((plan) => setPendingOpen(plan), []);
  const consumeOpen = useCallback(() => {
    const p = pendingOpen;
    setPendingOpen(null);
    return p;
  }, [pendingOpen]);
  return <Ctx.Provider value={{ pendingOpen, requestOpen, consumeOpen }}>{children}</Ctx.Provider>;
}

export function useSavedPlans() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSavedPlans must be used inside <SavedPlansProvider>');
  return v;
}
