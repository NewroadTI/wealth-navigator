import { Portfolio } from '@/lib/mockData';
import { formatCurrency, formatPercent, formatDate, getChangeColor } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Calendar, User, TrendingUp, Building2 } from 'lucide-react';

interface PortfolioCardProps {
  portfolio: Portfolio;
}

export function PortfolioCard({ portfolio }: PortfolioCardProps) {
  const isPositive = portfolio.dayChange >= 0;

  return (
    <Link
      to={`/portfolios/${portfolio.id}`}
      className="block bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 group animate-fade-in"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
            {portfolio.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{portfolio.interfaceCode}</p>
        </div>
        <div className="flex gap-2">
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
          <Badge variant="outline" className="text-xs bg-secondary/50">
            {portfolio.type}
          </Badge>
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-2xl font-bold mono text-foreground">
          {formatCurrency(portfolio.totalValue)}
        </span>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <ArrowUpRight className="h-4 w-4 text-gain" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-loss" />
          )}
          <span className={cn('text-sm font-medium mono', getChangeColor(portfolio.dayChangePercent))}>
            {isPositive ? '+' : ''}{formatPercent(portfolio.dayChangePercent)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="truncate">{portfolio.investor.name}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span className="truncate">{portfolio.advisor}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(portfolio.inceptionDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={cn('mono', getChangeColor(portfolio.ytdReturn))}>
            YTD: {portfolio.ytdReturn > 0 ? '+' : ''}{formatPercent(portfolio.ytdReturn)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {portfolio.mainCurrency} • {portfolio.benchmark}
        </span>
        <Badge
          variant="outline"
          className={cn(
            portfolio.investor.riskLevel === 'Conservative' && 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            portfolio.investor.riskLevel === 'Moderate' && 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            portfolio.investor.riskLevel === 'Aggressive' && 'bg-red-500/10 text-red-400 border-red-500/30'
          )}
        >
          {portfolio.investor.riskLevel}
        </Badge>
      </div>
    </Link>
  );
}
