import { Portfolio } from '@/lib/mockData';
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface PortfolioSummaryCardProps {
  portfolio: Portfolio;
}

export function PortfolioSummaryCard({ portfolio }: PortfolioSummaryCardProps) {
  const isPositive = portfolio.dayChange >= 0;

  return (
    <Link
      to={`/portfolios/${portfolio.id}`}
      className="metric-card group block animate-fade-in cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
            {portfolio.name}
          </p>
          <p className="text-xs text-muted-foreground">{portfolio.investor.name}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            portfolio.status === 'Active' && 'status-active',
            portfolio.status === 'Pending' && 'status-pending',
            portfolio.status === 'Closed' && 'status-closed'
          )}
        >
          {portfolio.status}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold mono">
            {formatCurrency(portfolio.totalValue)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {isPositive ? (
              <ArrowUpRight className="h-4 w-4 text-gain" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-loss" />
            )}
            <span className={cn('text-sm font-medium mono', getChangeColor(portfolio.dayChange))}>
              {isPositive ? '+' : ''}{formatCurrency(portfolio.dayChange)}
            </span>
            <span className={cn('text-sm mono', getChangeColor(portfolio.dayChangePercent))}>
              ({isPositive ? '+' : ''}{formatPercent(portfolio.dayChangePercent)})
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Today</span>
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">YTD</span>
          </div>
          <span className={cn('text-sm font-medium mono', getChangeColor(portfolio.ytdReturn))}>
            {portfolio.ytdReturn > 0 ? '+' : ''}{formatPercent(portfolio.ytdReturn)}
          </span>
        </div>
      </div>
    </Link>
  );
}
