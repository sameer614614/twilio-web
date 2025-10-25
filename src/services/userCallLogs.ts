import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

import { firebaseDb } from '../lib/firebase';

export async function createUserCallLog(userId, payload) {
  if (!firebaseDb) throw new Error('Firebase is not configured');
  const collectionRef = collection(firebaseDb, 'users', userId, 'callLogs');
  const docRef = await addDoc(collectionRef, {
    direction: 'outbound',
    status: 'connecting',
    durationSeconds: 0,
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    ...payload
  });
  return docRef.id;
}

export async function finalizeUserCallLog(userId, logId, updates) {
  if (!firebaseDb) throw new Error('Firebase is not configured');
  const docRef = doc(firebaseDb, 'users', userId, 'callLogs', logId);
  const note = typeof updates.note === 'string' ? updates.note.trim() : '';

  const payload = {
    ...updates,
    note: note.length > 0 ? note : deleteField(),
    endedAt: serverTimestamp()
  };

  await updateDoc(docRef, payload);
}
