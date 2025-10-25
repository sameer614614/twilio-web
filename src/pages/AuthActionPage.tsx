import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { firebaseAuth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { createZodResolver } from '../utils/createZodResolver';

const resetSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    confirmPassword: z.string().min(6, 'Confirm your new password')
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword']
  });

export function AuthActionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  const continueUrl = searchParams.get('continueUrl');
  const [status, setStatus] = useState('loading');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    reset
  } = useForm({
    resolver: createZodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });

  useEffect(() => {
    if (!firebaseAuth) {
      setError('Firebase is not configured for this environment.');
      setStatus('error');
      return;
    }
    if (!mode || !oobCode) {
      setError('Invalid or missing action parameters.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    setError('');

    let cancelled = false;

    const resolveAction = async () => {
      try {
        switch (mode) {
          case 'verifyEmail': {
            await applyActionCode(firebaseAuth, oobCode);
            if (!cancelled) {
              setStatus('verifyEmailComplete');
              setMessage('Your email has been verified successfully. You can now sign in.');
            }
            break;
          }
          case 'resetPassword': {
            const accountEmail = await verifyPasswordResetCode(firebaseAuth, oobCode);
            if (!cancelled) {
              setEmail(accountEmail ?? '');
              setStatus('resetReady');
            }
            break;
          }
          case 'recoverEmail': {
            const info = await checkActionCode(firebaseAuth, oobCode);
            await applyActionCode(firebaseAuth, oobCode);
            if (!cancelled) {
              const restoredEmail = info?.data?.email ?? '';
              setEmail(restoredEmail);
              setStatus('recoverEmailComplete');
              setMessage('Your email address has been restored.');
            }
            break;
          }
          case 'verifyAndChangeEmail': {
            await applyActionCode(firebaseAuth, oobCode);
            if (!cancelled) {
              setStatus('verifyEmailComplete');
              setMessage('Your email change has been confirmed. Please sign in with the updated address.');
            }
            break;
          }
          default: {
            if (!cancelled) {
              setStatus('unsupported');
              setMessage('This action link is not supported.');
            }
          }
        }
      } catch (actionError) {
        console.error('Failed to resolve auth action', actionError);
        if (!cancelled) {
          const description =
            actionError instanceof Error && actionError.message
              ? actionError.message
              : 'The link is invalid or has already been used.';
          setError(description);
          setStatus('error');
        }
      }
    };

    resolveAction();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode, firebaseAuth]);

  const onSubmit = async (values) => {
    if (!firebaseAuth || !oobCode) return;
    setError('');
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, values.password);
      setStatus('resetComplete');
      setMessage('Password updated. You can now sign in with your new credentials.');
      reset();
    } catch (submitError) {
      const description =
        submitError instanceof Error && submitError.message
          ? submitError.message
          : 'Unable to update your password. Try requesting a new reset email.';
      setError(description);
    }
  };

  const heading = useMemo(() => {
    switch (mode) {
      case 'verifyEmail':
      case 'verifyAndChangeEmail':
        return 'Confirm your email';
      case 'resetPassword':
        return 'Reset your password';
      case 'recoverEmail':
        return 'Restore your email';
      default:
        return 'Account action';
    }
  }, [mode]);

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="space-y-2 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="text-sm text-slate-400">Validating your request…</p>
        </div>
      );
    }

    if (status === 'resetReady') {
      return (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1 text-left">
            <p className="text-xs uppercase tracking-wide text-slate-500">Account</p>
            <p className="text-sm text-slate-300">{email}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password ? <p className="text-xs text-red-400">{errors.password.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword ? (
              <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Save new password'}
          </Button>
        </form>
      );
    }

    if (status === 'resetComplete' || status === 'verifyEmailComplete' || status === 'recoverEmailComplete') {
      return (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-300">{message}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate('/auth', { replace: true })}>Return to sign in</Button>
            {continueUrl ? (
              <Button variant="outline" asChild>
                <a href={continueUrl}>Continue to original page</a>
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    if (status === 'unsupported') {
      return (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-300">{message}</p>
          <Button onClick={() => navigate('/auth', { replace: true })}>Go to sign in</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-400">{error || 'Something went wrong with this request.'}</p>
        <Button onClick={() => navigate('/auth', { replace: true })}>Return to sign in</Button>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-brand">Twilio Voice Dialer</h1>
          <p className="text-sm text-slate-400">{heading}</p>
        </div>
        {status === 'loading' ? (
          <div className="space-y-2 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            <p className="text-sm text-slate-400">Validating your request…</p>
          </div>
        ) : (
          renderContent()
        )}
        <div className="mt-6 text-center text-xs text-slate-500">
          Need help? Contact <Link to="/contact" className="text-brand hover:underline">Twilio support</Link>.
        </div>
      </div>
    </div>
  );
}
