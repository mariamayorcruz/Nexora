import * as React from 'react';
import { cn } from '@/lib/utils';

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('relative w-full rounded-lg border border-gray-300 bg-white p-4 text-sm', className)} {...props} />
  )
);
Alert.displayName = 'Alert';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('text-gray-700', className)} {...props} />
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription };
