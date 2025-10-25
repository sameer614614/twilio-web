import { useEffect } from 'react';
import { Activity } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useTwilioClient } from '../context/TwilioClientContext';

export function EventLogsPage() {
  const { events, initializeClient, resetEvents } = useTwilioClient();

  useEffect(() => {
    initializeClient().catch(console.error);
  }, [initializeClient]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Event Logs</h2>
        <p className="text-sm text-slate-400">Inspect Twilio WebRTC socket activity and signaling events.</p>
      </header>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Real-time WebRTC Events</CardTitle>
            <CardDescription>Live feed of Twilio socket messages. Useful for troubleshooting.</CardDescription>
          </div>
          <button className="text-sm font-medium text-brand hover:text-brand-light" onClick={resetEvents}>
            Clear
          </button>
        </CardHeader>
        <div className="max-h-[480px] overflow-y-auto px-6 py-4">
          <ul className="space-y-3 text-xs font-mono text-slate-300">
            {events.length === 0 ? <li>No events captured yet.</li> : null}
            {events.map((event, index) => (
              <li key={`${event}-${index}`} className="flex items-start gap-3">
                <span className="mt-0.5 text-brand">
                  <Activity className="h-3 w-3" />
                </span>
                <span>{event}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}


function formatTimestamp(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
