import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { firebaseDb } from '../lib/firebase';
import { fetchCallLogs } from '../services/callLogsService';

export function useCallLogs() {
  const { user } = useAuth();

  return useQuery({
    enabled: Boolean(user && firebaseDb),
    queryKey: ['callLogs', user?.uid],
    queryFn: () => fetchCallLogs(user.uid),
    staleTime: 1000 * 30
  });
}
