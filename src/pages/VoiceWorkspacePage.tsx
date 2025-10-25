import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { useAuth } from '../context/AuthContext';
import { useTwilioClient } from '../context/TwilioClientContext';
import { getVoiceProfile, saveVoiceProfile, type VoiceProfile } from '../lib/twilioVoiceProfile';
import { createZodResolver } from '../utils/createZodResolver';

const profileSchema = z.object({
  callerId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ''),
  identityAlias: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ''),
  allowOutbound: z.boolean(),
  allowInbound: z.boolean(),
  recordCalls: z.boolean()
});

export function VoiceWorkspacePage() {
  const { user } = useAuth();
  const { connectionStatus } = useTwilioClient();

  const [initialProfile, setInitialProfile] = useState<VoiceProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: createZodResolver(profileSchema),
    defaultValues: {
      callerId: '',
      identityAlias: '',
      allowOutbound: true,
      allowInbound: true,
      recordCalls: true
    }
  });

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = setTimeout(() => setSaveMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [saveMessage]);

  useEffect(() => {
    if (!user) {
      setIsLoadingProfile(false);
      setInitialProfile(null);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const { profile } = await getVoiceProfile(user.uid);
        if (cancelled) return;
        setInitialProfile(profile);
        form.reset({
          callerId: profile.callerId ?? '',
          identityAlias: profile.identityAlias ?? '',
          allowOutbound: profile.allowOutbound,
          allowInbound: profile.allowInbound,
          recordCalls: profile.recordCalls
        });
        setProfileError(null);
      } catch (err) {
        if (cancelled) return;
        setProfileError(err instanceof Error ? err.message : 'Unable to load voice workspace configuration.');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [form, user]);

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return;
    setProfileError(null);
    try {
      await saveVoiceProfile(user.uid, {
        allowOutbound: values.allowOutbound,
        allowInbound: values.allowInbound,
        recordCalls: values.recordCalls,
        callerId: values.callerId ?? '',
        identityAlias: values.identityAlias ?? ''
      });
      setSaveMessage('Voice workspace updated.');
      setInitialProfile({
        allowOutbound: values.allowOutbound,
        allowInbound: values.allowInbound,
        recordCalls: values.recordCalls,
        callerId: values.callerId ?? '',
        identityAlias: values.identityAlias ?? ''
      });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to save voice workspace settings.');
    }
  };

  const connectionTone = useMemo(() => {
    if (connectionStatus.state === 'registered') return 'text-emerald-400';
    if (connectionStatus.state === 'error') return 'text-red-400';
    if (connectionStatus.state === 'disconnected') return 'text-amber-400';
    if (connectionStatus.state === 'initialising') return 'text-amber-300';
    return 'text-slate-300';
  }, [connectionStatus.state]);

  const lastUpdatedLabel = useMemo(() => {
    const timestamp = (initialProfile as any)?.updatedAt;
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleString();
    }
    return null;
  }, [initialProfile]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch
  } = form;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Voice Workspace</h2>
        <p className="text-sm text-slate-400">
          Control Twilio Programmable Voice access for this operator. Update caller ID, allowed call directions, and recording policy.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
            <CardDescription>Live connection state for the browser dialer.</CardDescription>
          </CardHeader>
          <div className="space-y-4 px-6 pb-6 text-sm text-slate-300">
            {isLoadingProfile ? <p>Loading voice workspace…</p> : null}
            {profileError ? <p className="text-red-400">{profileError}</p> : null}
            {!isLoadingProfile && !profileError && initialProfile ? (
              <div className="space-y-3">
                <ProfileRow label="Caller ID" value={initialProfile.callerId || 'Not set'} />
                <ProfileRow label="Identity Alias" value={initialProfile.identityAlias || 'Auto generated'} />
                <ProfileRow label="Outbound Calls" value={initialProfile.allowOutbound ? 'Allowed' : 'Blocked'} />
                <ProfileRow label="Inbound Calls" value={initialProfile.allowInbound ? 'Allowed' : 'Blocked'} />
                <ProfileRow label="Recording" value={initialProfile.recordCalls ? 'Enabled' : 'Disabled'} />
                {lastUpdatedLabel ? <ProfileRow label="Last updated" value={lastUpdatedLabel} /> : null}
              </div>
            ) : null}
            <div className={`rounded-lg bg-slate-900/60 px-4 py-3 ${connectionTone}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Twilio Registration</p>
              <p className="text-sm text-slate-200">{connectionStatus.message}</p>
            </div>
            {saveMessage ? <p className="text-xs text-emerald-400">{saveMessage}</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Voice Access Controls</CardTitle>
            <CardDescription>Changes apply immediately after saving.</CardDescription>
          </CardHeader>
          <form className="space-y-5 px-6 pb-6" onSubmit={handleSubmit(onSubmit)}>
            <Field label="Caller ID" error={errors.callerId?.message}>
              <Input placeholder="+12025550123" {...register('callerId')} />
              <p className="mt-1 text-xs text-slate-500">Number presented to customers on outbound calls.</p>
            </Field>
            <Field label="Identity Alias" error={errors.identityAlias?.message}>
              <Input placeholder="support-team" {...register('identityAlias')} />
              <p className="mt-1 text-xs text-slate-500">
                Override the default Twilio client identity (defaults to the agent email).
              </p>
            </Field>
            <div className="space-y-4">
              <ToggleRow
                label="Allow outbound calls"
                description="Permit this agent to initiate outbound PSTN calls."
                checked={watch('allowOutbound')}
                onCheckedChange={(value) => setValue('allowOutbound', Boolean(value))}
              />
              <ToggleRow
                label="Allow inbound calls"
                description="Enable ringing when Twilio routes inbound calls to this agent."
                checked={watch('allowInbound')}
                onCheckedChange={(value) => setValue('allowInbound', Boolean(value))}
              />
              <ToggleRow
                label="Record calls automatically"
                description="Start dual-channel recordings when the call connects."
                checked={watch('recordCalls')}
                onCheckedChange={(value) => setValue('recordCalls', Boolean(value))}
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save voice settings'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-200">{label}</p>
      {children}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="pr-4">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value || '-'}</p>
    </div>
  );
}


