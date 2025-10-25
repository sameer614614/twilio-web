import { Link } from 'react-router-dom';

import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-center text-slate-100">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold">404</h1>
        <p className="text-sm text-slate-400">The page you are looking for does not exist.</p>
        <Button asChild>
          <Link to="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
