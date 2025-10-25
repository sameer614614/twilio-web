import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { firebaseDb } from '../lib/firebase';

export async function fetchCallLogs(userId) {
  if (!firebaseDb) throw new Error('Firebase is not configured');
  const collectionRef = collection(firebaseDb, 'users', userId, 'callLogs');
  const snapshot = await getDocs(query(collectionRef, orderBy('startedAt', 'desc')));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}
