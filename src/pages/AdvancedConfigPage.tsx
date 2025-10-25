import { Code2, Globe, Layers, Lock, Server } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const items = [
  {
    title: 'Webhooks & Status Callbacks',
    description: 'Subscribe to Twilio Voice status callbacks and recording webhooks to automate post-call workflows.',
    icon: <Server className="h-5 w-5 text-brand" />
  },
  {
    title: 'Programmable Voice API',
    description: "Trigger outbound calls or update live sessions using Twilio's REST API, Functions, or Studio flows.",
    icon: <Code2 className="h-5 w-5 text-brand" />
  },
  {
    title: 'TwiML Applications',
    description: 'Design IVRs, warm transfers, and conference bridges with TwiML bins or server-hosted TwiML.',
    icon: <Globe className="h-5 w-5 text-brand" />
  },
  {
    title: 'Secure Media',
    description: 'Enforce SRTP, TLS, and JWT access tokens for hardened voice connectivity.',
    icon: <Lock className="h-5 w-5 text-brand" />
  },
  {
    title: 'Developer Tooling',
    description: 'Leverage the Twilio CLI, Postman collections, and Terraform modules to automate deployments.',
    icon: <Layers className="h-5 w-5 text-brand" />
  }
];

export function AdvancedConfigPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Advanced Configuration</h2>
        <p className="text-sm text-slate-400">
          Extend the Twilio web dialer with Programmable Voice, serverless automation, and production observability.
        </p>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.title} className="flex items-start gap-4">
            <div className="rounded-xl bg-slate-900/70 p-3">{item.icon}</div>
            <div>
              <CardHeader className="p-0">
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </div>
          </Card>
        ))}
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Developer Checklist</CardTitle>
          <CardDescription>Steps to launch advanced functionality in a production-ready workspace.</CardDescription>
        </CardHeader>
        <ol className="list-decimal space-y-3 px-6 pb-6 text-sm text-slate-300">
          <li>Create TwiML applications and SIP domains for each environment.</li>
          <li>Issue short-lived access tokens via Twilio Functions or your backend.</li>
          <li>Implement status callbacks to orchestrate IVRs, warm transfers, and recording policies.</li>
          <li>Instrument Voice Insights, Event Streams, and your monitoring stack for quality dashboards.</li>
        </ol>
      </Card>
    </div>
  );
}


