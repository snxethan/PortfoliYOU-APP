import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthCtx = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Centralized onAuthStateChanged - single source of truth for auth state
    const unsub = onAuthStateChanged(auth, (newUser) => {
      if (newUser) {
        console.log('Auth State Change - User Signed In:', {
          email: newUser.email,
          uid: newUser.uid,
          provider: newUser.providerData[0]?.providerId || 'unknown',
          emailVerified: newUser.emailVerified
        });
        // TODO: Analytics - Track active session
        // analytics.setUserId(newUser.uid);
        // analytics.setUserProperties({ provider: newUser.providerData[0]?.providerId });
      } else {
        console.log('Auth State Change - User Signed Out');
        // TODO: Analytics - Clear user context
        // analytics.setUserId(null);
      }
      setUser(newUser);
      setLoading(false);
    });
    return unsub;
  }, []);
  
  return <AuthCtx.Provider value={{ user, loading }}>{children}</AuthCtx.Provider>;
}
