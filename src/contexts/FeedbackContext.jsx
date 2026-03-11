/**
 * In-app beta feedback and support: openFeedback(screenName?), openSupport().
 * More and Account can open feedback or support modals.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import BetaFeedbackModal from '@/components/BetaFeedbackModal';
import BetaSupportModal from '@/components/BetaSupportModal';

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [initialScreenName, setInitialScreenName] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);

  const openFeedback = useCallback((screenName) => {
    setInitialScreenName(typeof screenName === 'string' ? screenName : '');
    setOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setOpen(false);
    setInitialScreenName('');
  }, []);

  const openSupport = useCallback(() => {
    setSupportOpen(true);
  }, []);

  const closeSupport = useCallback(() => {
    setSupportOpen(false);
  }, []);

  const value = { openFeedback, openSupport };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <BetaFeedbackModal
        open={open}
        onClose={closeFeedback}
        initialScreenName={initialScreenName}
      />
      <BetaSupportModal open={supportOpen} onClose={closeSupport} />
    </FeedbackContext.Provider>
  );
}

export function useFeedbackModal() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) return { openFeedback: () => {}, openSupport: () => {} };
  return ctx;
}
