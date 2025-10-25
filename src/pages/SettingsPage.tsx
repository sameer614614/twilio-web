import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { createZodResolver } from '../utils/createZodResolver';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Name is required')
});

const emailSchema = z.object({
  newEmail: z.string().email('Enter a valid email'),
  currentPassword: z.string().min(6, 'Enter your current password')
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Enter your current password'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm your new password')
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword']
  });

export function SettingsPage() {
  const {
    user,
    updateDisplayName,
    updateEmailAddress,
    updateUserPassword,
    sendVerificationEmail,
    verifying,
    refreshUser,
    determineProvider
  } = useAuth();
  const [profileMessage, setProfileMessage] = useState(null);
  const [emailMessage, setEmailMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [error, setError] = useState(null);
  const provider = determineProvider();
  const usesPassword = provider === 'password' || user?.providerData?.some((p) => p.providerId === 'password');
  const isGoogleOnly = provider === 'google' && !usesPassword;

  const profileForm = useForm({
    resolver: createZodResolver(profileSchema),
    defaultValues: { displayName: user?.displayName ?? '' }
  });

  const emailForm = useForm({
    resolver: createZodResolver(emailSchema),
    defaultValues: { newEmail: user?.email ?? '', currentPassword: '' }
  });

  const passwordForm = useForm({
    resolver: createZodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });

  useEffect(() => {
    profileForm.reset({ displayName: user?.displayName ?? '' });
    emailForm.reset({ newEmail: user?.email ?? '', currentPassword: '' });
  }, [emailForm, profileForm, user?.displayName, user?.email]);

  const handleProfileSubmit = profileForm.handleSubmit(async (values) => {
    setProfileMessage(null);
    setError(null);
    try {
      await updateDisplayName(values.displayName.trim());
      await refreshUser();
      setProfileMessage('Display name updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile');
    }
  });

  const handleEmailSubmit = emailForm.handleSubmit(async (values) => {
    setEmailMessage(null);
    setError(null);
    if (!usesPassword) {
      setError('Email updates are managed through your Google account settings.');
      return;
    }
    try {
      await updateEmailAddress({ currentPassword: values.currentPassword, newEmail: values.newEmail.trim() });
      await refreshUser();
      setEmailMessage('Email address updated. Please verify the new address if prompted by email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update email');
    }
  });

  const handlePasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordMessage(null);
    setError(null);
    if (!usesPassword) {
      setError('Password changes are unavailable for Google-linked accounts.');
      return;
    }
    try {
      await updateUserPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setPasswordMessage('Password updated successfully.');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    }
  });

  const onResendVerification = async () => {
    setError(null);
    setEmailMessage(null);
    try {
      await sendVerificationEmail();
      setEmailMessage('Verification email sent. Please check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification email');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">User Settings</h2>
        <p className="text-sm text-slate-400">Manage how you appear to customers and keep your credentials secure.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update the display name shown to other Twilio operators.</CardDescription>
        </CardHeader>
        <form className="space-y-5 px-6 pb-6" onSubmit={handleProfileSubmit}>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...profileForm.register('displayName')} />
            {profileForm.formState.errors.displayName ? (
              <p className="text-xs text-red-400">{profileForm.formState.errors.displayName.message}</p>
            ) : null}
          </div>
          {profileMessage ? <p className="text-sm text-emerald-400">{profileMessage}</p> : null}
          <Button type="submit" disabled={profileForm.formState.isSubmitting}>
            {profileForm.formState.isSubmitting ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Email & Verification</CardTitle>
          <CardDescription>
            Current email: <span className="font-medium">{user?.email}</span> –{' '}
            <span className={user?.emailVerified ? 'text-emerald-400' : 'text-amber-300'}>
              {user?.emailVerified ? 'Verified' : 'Unverified'}
            </span>
          </CardDescription>
        </CardHeader>
        <form className="space-y-5 px-6 pb-6" onSubmit={handleEmailSubmit}>
          <div className="space-y-2">
            <Label htmlFor="newEmail">New email</Label>
            <Input
              id="newEmail"
              type="email"
              autoComplete="email"
              disabled={!usesPassword}
              {...emailForm.register('newEmail')}
            />
            {emailForm.formState.errors.newEmail ? (
              <p className="text-xs text-red-400">{emailForm.formState.errors.newEmail.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentPasswordEmail">Current password</Label>
            <Input
              id="currentPasswordEmail"
              type="password"
              autoComplete="current-password"
              disabled={!usesPassword}
              {...emailForm.register('currentPassword')}
            />
            {emailForm.formState.errors.currentPassword ? (
              <p className="text-xs text-red-400">{emailForm.formState.errors.currentPassword.message}</p>
            ) : null}
          </div>
          {emailMessage ? <p className="text-sm text-emerald-400">{emailMessage}</p> : null}
          {isGoogleOnly ? (
            <p className="text-xs text-slate-400">
              This profile is linked to Google sign-in. Update your primary email from your Google account.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="flex-1" disabled={!usesPassword || emailForm.formState.isSubmitting}>
              {emailForm.formState.isSubmitting ? 'Updating…' : 'Update email'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={verifying || emailForm.formState.isSubmitting}
              onClick={() => void onResendVerification()}
            >
              {verifying ? 'Sending…' : 'Resend verification email'}
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your password regularly to protect Twilio accounts.</CardDescription>
        </CardHeader>
        <form className="space-y-5 px-6 pb-6" onSubmit={handlePasswordSubmit}>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              disabled={!usesPassword}
              {...passwordForm.register('currentPassword')}
            />
            {passwordForm.formState.errors.currentPassword ? (
              <p className="text-xs text-red-400">{passwordForm.formState.errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={!usesPassword}
              {...passwordForm.register('newPassword')}
            />
            {passwordForm.formState.errors.newPassword ? (
              <p className="text-xs text-red-400">{passwordForm.formState.errors.newPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={!usesPassword}
              {...passwordForm.register('confirmPassword')}
            />
            {passwordForm.formState.errors.confirmPassword ? (
              <p className="text-xs text-red-400">{passwordForm.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>
          {passwordMessage ? <p className="text-sm text-emerald-400">{passwordMessage}</p> : null}
          {isGoogleOnly ? (
            <p className="text-xs text-slate-400">
              Password resets are managed through Google. Use Google security settings to update it.
            </p>
          ) : null}
          <Button type="submit" disabled={!usesPassword || passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

