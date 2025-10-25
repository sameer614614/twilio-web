import { cn } from '../../utils/cn';

export const Card = ({ className, ...props }) => (
  <div className={cn('rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg', className)} {...props} />
);

export const CardHeader = ({ className, ...props }) => (
  <div className={cn('mb-4 space-y-1', className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h2 className={cn('text-xl font-semibold tracking-tight', className)} {...props} />
);

export const CardDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-slate-400', className)} {...props} />
);
