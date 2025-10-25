import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';

import { firebaseDb } from './firebase';

export function normalizeSipProfileData(raw = {}) {
  const data = typeof raw === 'object' && raw !== null ? raw : {};

  const normalizedUser =
    typeof data.sipUser === 'string'
      ? data.sipUser
      : typeof data.sip_username === 'string'
      ? data.sip_username
      : typeof data.login === 'string'
      ? data.login
      : typeof data.login_token === 'string'
      ? data.login_token
      : typeof data.username === 'string'
      ? data.username
      : '';
  const normalizedPassword =
    typeof data.sipPassword === 'string'
      ? data.sipPassword
      : typeof data.sip_password === 'string'
      ? data.sip_password
      : typeof data.password === 'string'
      ? data.password
      : '';
  const normalizedWebsocket =
    typeof data.websocketUrl === 'string'
      ? data.websocketUrl
      : typeof data.websocket_url === 'string'
      ? data.websocket_url
      : typeof data.ws_url === 'string'
      ? data.ws_url
      : typeof data.domain === 'string'
      ? data.domain
      : 'wss://rtc.telnyx.com';
  const normalizedAutoReconnect =
    typeof data.autoReconnect === 'boolean'
      ? data.autoReconnect
      : typeof data.auto_reconnect === 'boolean'
      ? data.auto_reconnect
      : true;
  const normalizedRingtone =
    typeof data.ringtone === 'string'
      ? data.ringtone
      : typeof data.ringtoneFile === 'string'
      ? data.ringtoneFile
      : '';
  const normalizedOwnerId =
    typeof data.ownerId === 'string'
      ? data.ownerId
      : typeof data.owner_id === 'string'
      ? data.owner_id
      : null;

  return {
    sipUser: normalizedUser,
    sipPassword: normalizedPassword,
    websocketUrl: normalizedWebsocket,
    autoReconnect: normalizedAutoReconnect,
    ringtone: normalizedRingtone,
    ownerId: normalizedOwnerId,
    updatedAt: data.updatedAt ?? null
  };
}

export async function getTelnyxClientConfig(userId) {
  if (!firebaseDb) throw new Error('Firebase is not configured');

  const primaryRef = doc(firebaseDb, 'sipProfiles', userId);
  let snapshot = await getDoc(primaryRef);

  if (!snapshot.exists()) {
    const matches = await getDocs(
      query(collection(firebaseDb, 'sipProfiles'), where('ownerId', '==', userId), limit(1))
    );
    snapshot = matches.docs[0];
  }

  if (!snapshot || !snapshot.exists()) {
    throw new Error('No Telnyx SIP profile is saved. Add one in the SIP Profile page.');
  }

  const data = snapshot.data() || {};
  const profile = normalizeSipProfileData(data);

  if (!profile.sipUser || !profile.sipPassword) {
    throw new Error('The saved SIP profile is missing a username or password.');
  }

  return {
    profile,
    profileId: snapshot.id,
    clientConfig: {
      login: profile.sipUser,
      password: profile.sipPassword,
      websocket_url: profile.websocketUrl,
      autoReconnect: profile.autoReconnect,
      ringtoneFile: profile.ringtone || undefined
    }
  };
}
