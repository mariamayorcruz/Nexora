'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContextType = {
  value: string;
  setValue: (next: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
}

function Tabs({ defaultValue, className, children, ...props }: TabsProps) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-600', className)}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  if (!context) return null;

  const active = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
        className
      )}
      {...props}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const context = React.useContext(TabsContext);
  if (!context || context.value !== value) return null;

  return <div className={cn(className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
