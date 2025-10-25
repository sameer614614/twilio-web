import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseDb } from './firebase';

export type VoiceProfile = {
  allowOutbound: boolean;
  allowInbound: boolean;
  recordCalls: boolean;
  callerId: string;
  identityAlias: string;
  updatedAt?: unknown;
};

const DEFAULT_PROFILE: VoiceProfile = {
  allowOutbound: true,
  allowInbound: true,
  recordCalls: true,
  callerId: '',
  identityAlias: ''
};

export async function getVoiceProfile(userId: string) {
  if (!firebaseDb) {
    throw new Error('Firebase is not configured');
  }

  const ref = doc(firebaseDb, 'voiceProfiles', userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return {
      profile: DEFAULT_PROFILE,
      ref
    };
  }

  const data = snapshot.data() ?? {};

  return {
    profile: {
      allowOutbound: Boolean(data.allowOutbound ?? data.allow_outbound ?? true),
      allowInbound: Boolean(data.allowInbound ?? data.allow_inbound ?? true),
      recordCalls: Boolean(data.recordCalls ?? data.record_calls ?? true),
      callerId: typeof data.callerId === 'string' ? data.callerId : typeof data.caller_id === 'string' ? data.caller_id : '',
      identityAlias:
        typeof data.identityAlias === 'string'
          ? data.identityAlias
          : typeof data.identity_alias === 'string'
          ? data.identity_alias
          : '',
      updatedAt: data.updatedAt
    } as VoiceProfile,
    ref
  };
}

export async function saveVoiceProfile(userId: string, payload: VoiceProfile) {
  if (!firebaseDb) {
    throw new Error('Firebase is not configured');
  }

  const ref = doc(firebaseDb, 'voiceProfiles', userId);

  await setDoc(
    ref,
    {
      allowOutbound: Boolean(payload.allowOutbound),
      allowInbound: Boolean(payload.allowInbound),
      recordCalls: Boolean(payload.recordCalls),
      callerId: payload.callerId.trim(),
      identityAlias: payload.identityAlias.trim(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
