import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/formatters';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  format?: 'currency' | 'percent' | 'number';
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  format = 'currency',
  trend,
}: MetricCardProps) {
  const formattedValue =
    format === 'currency' && typeof value === 'number'
      ? formatCurrency(value)
      : format === 'percent' && typeof value === 'number'
      ? formatPercent(value)
      : value;

  return (
    <div className="metric-card group animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="metric-label">{title}</p>
          <p className="metric-value mono">{formattedValue}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <span className={cn('text-sm font-medium mono', getChangeColor(change))}>
            {change > 0 ? '+' : ''}{formatPercent(change)}
          </span>
          {changeLabel && (
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
