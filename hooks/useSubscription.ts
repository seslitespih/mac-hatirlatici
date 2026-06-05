import { useState, useEffect, useCallback } from 'react';
import { isSubscribed, needsPaywall } from '../services/subscriptionService';

export function useSubscription() {
  const [subscribed,  setSubscribed]  = useState(true);   // default true → yüklenene kadar kapat
  const [showPaywall, setShowPaywall] = useState(false);
  const [loading,     setLoading]     = useState(true);

  const check = useCallback(async () => {
    try {
      const [sub, paywall] = await Promise.all([isSubscribed(), needsPaywall()]);
      setSubscribed(sub);
      setShowPaywall(paywall);
    } catch {
      // Hata → erişime izin ver (offline vb.)
      setSubscribed(true);
      setShowPaywall(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  return { subscribed, showPaywall, loading, recheck: check };
}
