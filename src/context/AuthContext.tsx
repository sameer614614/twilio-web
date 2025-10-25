import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '../lib/firebase';
import { hashEmail } from '../utils/hashEmail';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const persistUserProfile = useCallback(async (firebaseUser, providerHint) => {
    if (!firebaseDb || !firebaseUser?.uid || !firebaseUser.email) {
      return;
    }

    const normalizedEmail = firebaseUser.email.trim().toLowerCase();
    const directoryId = await hashEmail(normalizedEmail);
    const provider = providerHint ?? deriveProvider(firebaseUser);
    const payload = {
      userId: firebaseUser.uid,
      email: normalizedEmail,
      emailVerified: !!firebaseUser.emailVerified,
      provider,
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(
        doc(firebaseDb, 'users', firebaseUser.uid),
        {
          ...payload,
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? null
        },
        { merge: true }
      );

      if (directoryId) {
        await setDoc(doc(firebaseDb, 'userDirectory', directoryId), payload, { merge: true });
      }
    } catch (error) {
      console.error('Failed to persist user profile', error);
    }
  }, []);

  const getDirectoryRecord = useCallback(async (email) => {
    if (!firebaseDb || typeof email !== 'string') return null;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return null;
    const directoryId = await hashEmail(normalizedEmail);
    if (!directoryId) return null;

    try {
      const snapshot = await getDoc(doc(firebaseDb, 'userDirectory', directoryId));
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
      console.error('Failed to fetch directory record', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    setPersistence(firebaseAuth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        await persistUserProfile(firebaseUser);
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [persistUserProfile]);

  const value = useMemo(
    () => ({
      user,
      loading,
      verifying,
      signIn: async (email, password) => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        const normalizedEmail = email.trim().toLowerCase();
        const methods = await fetchSignInMethodsForEmail(firebaseAuth, normalizedEmail);
        if (methods.includes('google.com') && !methods.includes('password')) {
          throw new Error('This email is linked to Google sign-in. Use "Sign in with Google".');
        }

        const credential = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        await persistUserProfile(credential.user, 'password');
        setUser(credential.user);
        return credential.user;
      },
      signInWithGoogle: async () => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await signInWithPopup(firebaseAuth, provider);
        const isNewUser = credential?._tokenResponse?.isNewUser;
        if (isNewUser) {
          try {
            await deleteUser(credential.user);
          } catch (error) {
            console.error('Failed to delete unexpected Google registration', error);
          }
          await signOut(firebaseAuth);
          setUser(null);
          throw new Error('No account exists for this Google user. Register with Google before signing in.');
        }

        await persistUserProfile(credential.user, 'google');
        setUser(credential.user);
        return credential.user;
      },
      registerWithGoogle: async () => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await signInWithPopup(firebaseAuth, provider);
        const isNewUser = credential?._tokenResponse?.isNewUser;
        if (!isNewUser) {
          await signOut(firebaseAuth);
          setUser(null);
          throw new Error('This Google account is already registered. Use "Sign in with Google".');
        }

        await persistUserProfile(credential.user, 'google');
        setUser(credential.user);
        return credential.user;
      },
      signUp: async ({ email, password, displayName }) => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        const normalizedEmail = email.trim().toLowerCase();
        const methods = await fetchSignInMethodsForEmail(firebaseAuth, normalizedEmail);
        if (methods.includes('google.com') && !methods.includes('password')) {
          throw new Error('This email is registered with Google. Use "Register with Google".');
        }
        if (methods.includes('password')) {
          throw new Error('An account with this email already exists. Try signing in instead.');
        }

        const credential = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        await sendEmailVerification(credential.user);
        await persistUserProfile(credential.user, 'password');
        setUser(credential.user);
        return credential.user;
      },
      signOutUser: async () => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        await signOut(firebaseAuth);
        setUser(null);
      },
      sendPasswordReset: async (email) => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        const normalizedEmail = email.trim().toLowerCase();
        const [methods, directoryRecord] = await Promise.all([
          fetchSignInMethodsForEmail(firebaseAuth, normalizedEmail),
          getDirectoryRecord(normalizedEmail)
        ]);

        const directoryProvider = directoryRecord?.provider;
        const isGoogleOnly =
          methods.includes('google.com') || directoryProvider === 'google';
        const hasPasswordProvider =
          methods.includes('password') || directoryProvider === 'password';

        if (!hasPasswordProvider) {
          if (isGoogleOnly) {
            throw new Error('This email is linked to Google sign-in. Use the Google option to access your account.');
          }
          throw new Error('No password-based account exists for this email.');
        }

        if (directoryRecord && directoryRecord.emailVerified === false) {
          throw new Error('Verify your email from the onboarding message before requesting a password reset.');
        }

        await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
      },
      sendVerificationEmail: async () => {
        if (!firebaseAuth) throw new Error('Firebase is not configured');
        if (!firebaseAuth.currentUser) throw new Error('No authenticated user');
        if (firebaseAuth.currentUser.emailVerified) return;
        setVerifying(true);
        try {
          await sendEmailVerification(firebaseAuth.currentUser);
          await reload(firebaseAuth.currentUser);
          await persistUserProfile(firebaseAuth.currentUser);
          setUser({ ...firebaseAuth.currentUser });
        } finally {
          setVerifying(false);
        }
      },
      refreshUser: async () => {
        if (!firebaseAuth?.currentUser) return;
        await reload(firebaseAuth.currentUser);
        await persistUserProfile(firebaseAuth.currentUser);
        setUser({ ...firebaseAuth.currentUser });
      },
      updateDisplayName: async (displayName) => {
        if (!firebaseAuth?.currentUser) throw new Error('No authenticated user');
        await updateProfile(firebaseAuth.currentUser, { displayName });
        await reload(firebaseAuth.currentUser);
        await persistUserProfile(firebaseAuth.currentUser);
        setUser({ ...firebaseAuth.currentUser });
      },
      updateEmailAddress: async ({ currentPassword, newEmail }) => {
        if (!firebaseAuth?.currentUser || !firebaseAuth.currentUser.email) {
          throw new Error('No authenticated user');
        }
        const credential = EmailAuthProvider.credential(firebaseAuth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseAuth.currentUser, credential);
        await updateEmail(firebaseAuth.currentUser, newEmail.trim().toLowerCase());
        await reload(firebaseAuth.currentUser);
        await persistUserProfile(firebaseAuth.currentUser);
        setUser({ ...firebaseAuth.currentUser });
      },
      updateUserPassword: async ({ currentPassword, newPassword }) => {
        if (!firebaseAuth?.currentUser || !firebaseAuth.currentUser.email) {
          throw new Error('No authenticated user');
        }
        const credential = EmailAuthProvider.credential(firebaseAuth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseAuth.currentUser, credential);
        await updatePassword(firebaseAuth.currentUser, newPassword);
        await reload(firebaseAuth.currentUser);
        await persistUserProfile(firebaseAuth.currentUser);
        setUser({ ...firebaseAuth.currentUser });
      },
      determineProvider: () => deriveProvider(user)
    }),
    [getDirectoryRecord, loading, persistUserProfile, user, verifying]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function deriveProvider(firebaseUser) {
  if (!firebaseUser) return 'unknown';
  const providers = firebaseUser.providerData?.map((provider) => provider.providerId) ?? [];
  if (providers.includes('google.com') && !providers.includes('password')) {
    return 'google';
  }
  if (providers.includes('password')) {
    return 'password';
  }
  return providers[0] ?? 'unknown';
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
