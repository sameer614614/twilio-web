import { Mail, MessageCircle, PhoneCall } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function ContactPage() {
  const contactDetails = [
    {
      icon: <Mail className="h-5 w-5 text-brand-light" />,
      label: 'Email',
      value: 'support@twilio.com',
      helper: 'Reach our support desk for account or billing questions.'
    },
    {
      icon: <PhoneCall className="h-5 w-5 text-brand-light" />,
      label: 'WhatsApp',
      value: '+1 (877) 889-4545',
      helper: 'Tap to start a secure conversation with our operators.'
    },
    {
      icon: <MessageCircle className="h-5 w-5 text-brand-light" />,
      label: 'Live chat',
      value: 'Coming soon',
      helper: 'We are building an in-dashboard live chat experience for rapid responses.'
    }
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand">Need a hand?</h1>
        <p className="text-sm text-slate-400">
          The Twilio success team is ready to help with onboarding, troubleshooting, or optimisation guidance.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contact Twilio</CardTitle>
          <CardDescription>Use the channel that suits you best &mdash; we will route your request to the right specialist.</CardDescription>
        </CardHeader>
        <div className="space-y-5">
          {contactDetails.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-4 rounded-lg border border-slate-800/60 bg-slate-950/40 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                <p className="text-lg font-medium text-brand-light">{item.value}</p>
                <p className="text-xs text-slate-400">{item.helper}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

