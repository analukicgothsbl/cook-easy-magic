import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const GUEST_ID_KEY = 'guest_id';

function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useGuestMode() {
  const { user, session, isLoading: authLoading } = useAuth();
  const [guestId, setGuestId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize guest_id from localStorage or generate new one
    const storedGuestId = localStorage.getItem(GUEST_ID_KEY);
    
    if (storedGuestId) {
      setGuestId(storedGuestId);
    } else {
      const newGuestId = generateUUID();
      localStorage.setItem(GUEST_ID_KEY, newGuestId);
      setGuestId(newGuestId);
    }
    
    setIsInitialized(true);
  }, []);

  const isLoggedIn = !authLoading && !!session && !!user;

  return {
    guestId,
    isLoggedIn,
    isLoading: authLoading || !isInitialized,
  };
}
