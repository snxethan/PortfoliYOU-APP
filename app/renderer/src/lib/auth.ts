import {
  GoogleAuthProvider, signInWithPopup, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, signOut
} from "firebase/auth";

import { auth } from "./firebase";

export const signInGoogle = async () => {
  const provider = new GoogleAuthProvider();
  // Force account selection every time - allows switching between Google accounts
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  try {
    // Always use popup, even in Electron production
    // The main process is configured to allow Google auth popups
    const result = await signInWithPopup(auth, provider);
    console.log('✅ Google Sign-In Success:', {
      email: result.user.email,
      uid: result.user.uid,
      provider: 'google.com'
    });
    // TODO: Analytics - Track sign-in event with provider
    // analytics.logEvent('login', { method: 'google' });
    return result.user;
  } catch (error: unknown) {
    console.error('❌ Google Sign-In Error:', error);
    // TODO: Analytics - Track sign-in failure
    // analytics.logEvent('login_failed', { method: 'google', error: error.code });
    throw error;
  }
};

// Check for redirect result after OAuth redirect (for Electron production)
export const checkRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('✅ Google Sign-In Success (redirect):', {
        email: result.user.email,
        uid: result.user.uid,
        provider: 'google.com'
      });
      return result.user;
    }
    return null;
  } catch (error: unknown) {
    console.error('❌ Redirect Result Error:', error);
    throw error;
  }
};

export async function emailSignUp(email: string, password: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (cred.user && !cred.user.emailVerified) await sendEmailVerification(cred.user);
    console.log('✅ Email Sign-Up Success:', {
      email: cred.user.email,
      uid: cred.user.uid,
      provider: 'email',
      emailVerified: cred.user.emailVerified
    });
    // TODO: Analytics - Track sign-up event
    // analytics.logEvent('sign_up', { method: 'email' });
    return cred.user;
  } catch (error: unknown) {
    console.error('❌ Email Sign-Up Error:', error);
    // TODO: Analytics - Track sign-up failure
    // analytics.logEvent('sign_up_failed', { method: 'email', error: error.code });
    throw error;
  }
}

export const emailSignIn = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Email Sign-In Success:', {
      email: result.user.email,
      uid: result.user.uid,
      provider: 'email',
      emailVerified: result.user.emailVerified
    });
    // TODO: Analytics - Track sign-in event
    // analytics.logEvent('login', { method: 'email' });
    return result;
  } catch (error: unknown) {
    console.error('❌ Email Sign-In Error:', error);
    // TODO: Analytics - Track sign-in failure
    // analytics.logEvent('login_failed', { method: 'email', error: error.code });
    throw error;
  }
};

export const logout = async () => {
  try {
    const user = auth.currentUser;
    console.log('🚪 Sign-Out:', {
      email: user?.email,
      uid: user?.uid,
      provider: user?.providerData[0]?.providerId || 'unknown'
    });
    // TODO: Analytics - Track sign-out event
    // analytics.logEvent('logout');
    await signOut(auth);
    console.log('✅ Sign-Out Success');
  } catch (error: unknown) {
    console.error('❌ Sign-Out Error:', error);
    throw error;
  }
};
