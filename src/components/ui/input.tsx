import * as React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ring-offset-slate-950',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';
