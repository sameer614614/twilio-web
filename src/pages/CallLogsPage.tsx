import { useMemo } from 'react';
import { PhoneCall } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useCallLogs } from '../hooks/useCallLogs';

const mockLogs = [
  {
    id: '1',
    direction: 'outbound',
    counterparty: '+1 202 555 0113',
    status: 'completed',
    startedAt: '2024-05-12 09:24 UTC',
    duration: '04:12'
  },
  {
    id: '2',
    direction: 'inbound',
    counterparty: 'Acme HQ',
    status: 'voicemail',
    startedAt: '2024-05-12 08:02 UTC',
    duration: '01:06'
  },
  {
    id: '3',
    direction: 'outbound',
    counterparty: '+44 20 7946 0012',
    status: 'failed',
    startedAt: '2024-05-11 20:13 UTC',
    duration: '00:00'
  }
];

function normalizeStatus(status) {
  const value = typeof status === 'string' ? status.toLowerCase() : '';
  if (['cancelled', 'canceled'].includes(value)) {
    return 'cancelled';
  }
  if (['failed', 'error', 'busy'].includes(value)) {
    return 'failed';
  }
  if (['completed', 'complete', 'ended'].includes(value)) {
    return 'completed';
  }
  return value || 'completed';
}

export function CallLogsPage() {
  const { data, error, isLoading, isFetching } = useCallLogs();
  const logs = useMemo(() => {
    if (!data || data.length === 0) {
      return mockLogs;
    }

    return data.map((log) => {
      const startedAtTimestamp = log.startedAt?.toDate ? log.startedAt.toDate() : log.startedAt;
      const endedAtTimestamp = log.endedAt?.toDate ? log.endedAt.toDate() : log.endedAt;
      const startedAt = startedAtTimestamp ? new Date(startedAtTimestamp) : null;
      const durationSeconds = typeof log.durationSeconds === 'number' ? log.durationSeconds : 0;
      const note = typeof log.note === 'string' ? log.note.trim() : '';
      const status = normalizeStatus(log.status);

      return {
        id: log.id,
        direction: log.direction || 'outbound',
        counterparty: log.counterparty || 'Unknown',
        status,
        startedAt: startedAt ? startedAt.toUTCString() : 'N/A',
        duration:
          durationSeconds > 0
            ? new Date(durationSeconds * 1000).toISOString().substring(14, 19)
            : endedAtTimestamp
            ? '00:00'
            : '—',
        note: note.length > 0 ? note : null
      };
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Call Logs</h2>
        <p className="text-sm text-slate-400">Track interactions handled through your Twilio-powered dialer.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>
            Real-time logs sync from Firestore. When none exist yet, sample entries remain for reference.
          </CardDescription>
        </CardHeader>
        {error ? (
          <div className="px-6 py-3 text-xs text-red-400">
            Failed to load remote logs. Showing local mock data instead.
          </div>
        ) : null}
        <div className="px-6 pb-4 text-xs text-slate-500">
          {isLoading ? 'Loading call history…' : isFetching ? 'Refreshing call history…' : null}
        </div>
        <div className="divide-y divide-slate-800">
          {logs.map((log) => (
            <div key={log.id} className="space-y-2 px-6 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-900/60 p-2">
                    <PhoneCall className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">{log.counterparty}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{log.direction}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs text-slate-400 sm:text-sm">
                  <span>{log.startedAt}</span>
                  <span>{log.duration}</span>
                  <span className="capitalize text-brand-light">{log.status}</span>
                </div>
              </div>
              {log.note ? (
                <div className="rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-brand-light">
                  <p className="font-semibold uppercase tracking-wide">Call Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-100">{log.note}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

