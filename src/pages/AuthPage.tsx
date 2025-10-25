import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { createZodResolver } from '../utils/createZodResolver';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const signUpSchema = z
  .object({
    name: z.string().min(2, 'Enter your name'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm your password')
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword']
  });

const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email')
});

const schemaMap = {
  'sign-in': signInSchema,
  'sign-up': signUpSchema,
  forgot: forgotPasswordSchema
};

const defaultsMap = {
  'sign-in': { email: '', password: '' },
  'sign-up': { name: '', email: '', password: '', confirmPassword: '' },
  forgot: { email: '' }
};

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    registerWithGoogle,
    sendPasswordReset,
    sendVerificationEmail,
    verifying
  } = useAuth();
  const [mode, setMode] = useState('sign-in');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(location.state?.message ?? null);
  const [success, setSuccess] = useState(null);

  const schema = useMemo(() => schemaMap[mode], [mode]);
  const defaults = useMemo(() => defaultsMap[mode], [mode]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: createZodResolver(schema),
    defaultValues: defaults
  });

  useEffect(() => {
    reset(defaultsMap[mode]);
    setError(null);
    setInfo(location.state?.message ?? null);
    setSuccess(null);
  }, [mode, reset, location.state]);

  const redirectPath = location.state?.from?.pathname ?? '/dashboard';

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectPath, { replace: true });
    }
  }, [loading, navigate, redirectPath, user]);

  const handleAuthMode = (nextMode) => {
    setMode(nextMode);
  };

  const onSubmit = async (values) => {
    setError(null);
    setInfo(null);
    setSuccess(null);

    try {
      if (mode === 'sign-in') {
        await signIn(values.email, values.password);
        navigate(redirectPath, { replace: true });
        return;
      }

      if (mode === 'sign-up') {
        await signUp({ email: values.email, password: values.password, displayName: values.name });
        setSuccess('Account created successfully. A verification email is on the way.');
        navigate(redirectPath, { replace: true });
        return;
      }

      if (mode === 'forgot') {
        await sendPasswordReset(values.email);
        setSuccess('Password reset instructions have been emailed to you.');
        setMode('sign-in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const onGoogleAction = async () => {
    setError(null);
    setInfo(null);
    setSuccess(null);
    try {
      if (mode === 'sign-up') {
        await registerWithGoogle();
        setSuccess('Google account linked. You are now signed in.');
        navigate(redirectPath, { replace: true });
        return;
      }

      const authenticated = await signInWithGoogle();
      if (authenticated) {
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const onResendVerification = async () => {
    setError(null);
    setSuccess(null);
    try {
      await sendVerificationEmail();
      setInfo('Verification email resent. Please check your inbox.');
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes('No authenticated user')
          ? 'Sign in with your email and password before resending the verification link.'
          : err instanceof Error
          ? err.message
          : 'Unable to send verification email';
      setError(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand">Twilio Voice Dialer</h1>
          <p className="text-sm text-slate-400">Access the Twilio-powered browser dialer and workspace controls.</p>
        </div>
        <div className="mb-6 flex justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => handleAuthMode('sign-in')}
            className={`rounded-full px-4 py-1 font-medium transition ${
              mode === 'sign-in' ? 'bg-brand text-slate-950' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => handleAuthMode('sign-up')}
            className={`rounded-full px-4 py-1 font-medium transition ${
              mode === 'sign-up' ? 'bg-brand text-slate-950' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => handleAuthMode('forgot')}
            className={`rounded-full px-4 py-1 font-medium transition ${
              mode === 'forgot' ? 'bg-brand text-slate-950' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Forgot password
          </button>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {mode === 'sign-up' ? (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Your name" autoComplete="name" {...register('name')} />
              {errors.name ? <p className="text-xs text-red-400">{errors.name.message}</p> : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="text-xs text-red-400">{errors.email.message}</p> : null}
          </div>
          {mode !== 'forgot' ? (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                {...register('password')}
              />
              {errors.password ? <p className="text-xs text-red-400">{errors.password.message}</p> : null}
            </div>
          ) : null}
          {mode === 'sign-up' ? (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword ? <p className="text-xs text-red-400">{errors.confirmPassword.message}</p> : null}
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {info ? <p className="text-sm text-amber-300">{info}</p> : null}
          {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting || verifying}>
            {isSubmitting
              ? 'Please wait…'
              : mode === 'sign-in'
              ? 'Sign in'
              : mode === 'sign-up'
              ? 'Create account'
              : 'Send reset link'}
          </Button>
        </form>
        {mode !== 'forgot' ? (
          <div className="mt-6 space-y-4">
            <Button type="button" variant="outline" className="w-full" onClick={() => void onGoogleAction()}>
              {mode === 'sign-up' ? 'Register with Google' : 'Sign in with Google'}
            </Button>
            {mode === 'sign-in' ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm text-slate-400 hover:text-slate-100"
                disabled={verifying || isSubmitting}
                onClick={() => void onResendVerification()}
              >
                Resend verification email
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

