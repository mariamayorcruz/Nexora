import type { ReactNode } from 'react';

interface OpsGridProps {
  children: ReactNode;
  className?: string;
}

interface OpsGridHeaderProps {
  columnsClassName: string;
  children: ReactNode;
}

interface OpsGridRowProps {
  columnsClassName: string;
  children: ReactNode;
}

interface OpsGridCellProps {
  label: string;
  children: ReactNode;
}

export function OpsGrid({ children, className = '' }: OpsGridProps) {
  return <div className={`overflow-hidden rounded-3xl border border-slate-200 ${className}`.trim()}>{children}</div>;
}

export function OpsGridHeader({ columnsClassName, children }: OpsGridHeaderProps) {
  return (
    <div
      className={`hidden gap-3 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid ${columnsClassName}`}
    >
      {children}
    </div>
  );
}

export function OpsGridRow({ columnsClassName, children }: OpsGridRowProps) {
  return (
    <article
      className={`grid gap-4 border-t border-slate-200 bg-white px-5 py-5 first:border-t-0 lg:items-start lg:gap-3 ${columnsClassName}`}
    >
      {children}
    </article>
  );
}

export function OpsGridCell({ label, children }: OpsGridCellProps) {
  return (
    <div>
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400 lg:hidden">{label}</span>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
