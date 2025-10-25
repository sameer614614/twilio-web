import { Activity, PhoneIncoming, PhoneOutgoing, ServerCog } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const metrics = [
  {
    title: 'Active Call State',
    description: 'Monitor the current Twilio call status and connection health.',
    icon: <Activity className="h-5 w-5 text-brand" />
  },
  {
    title: 'Inbound Calls',
    description: 'Track the number of inbound calls handled by your team.',
    icon: <PhoneIncoming className="h-5 w-5 text-brand" />
  },
  {
    title: 'Outbound Calls',
    description: 'Review outbound call volume and completion success rates.',
    icon: <PhoneOutgoing className="h-5 w-5 text-brand" />
  },
  {
    title: 'Infrastructure Health',
    description: 'Quickly verify SIP connectivity, WebRTC registration, and network reachability.',
    icon: <ServerCog className="h-5 w-5 text-brand" />
  }
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-slate-400">
            Real-time operational overview of your Twilio Web Dialer workspace.
          </p>
        </div>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="space-y-3">
            <CardHeader className="flex items-center gap-3">
              {metric.icon}
              <div>
                <CardTitle className="text-base">{metric.title}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Important events across SIP registration, call flows, and automation.</CardDescription>
          </CardHeader>
          <ul className="space-y-3 text-sm text-slate-300">
            <li>• TwiML application updated with latest routing logic.</li>
            <li>• WebRTC client registered via secure WSS transport.</li>
            <li>• Automated outbound campaign scheduled by marketing team.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Suggested tasks to finish configuring your workspace.</CardDescription>
          </CardHeader>
          <ul className="space-y-3 text-sm text-slate-300">
            <li>• Upload organization logo for caller ID experiences.</li>
            <li>• Enable status callbacks and Voice Insights for production monitoring.</li>
            <li>• Invite additional operators and assign permission sets.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

