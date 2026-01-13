import { Position } from '@/lib/mockData';
import { formatCurrency, formatNumber, formatPercent, getChangeColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
}

const assetClassColors = {
  Equity: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  'Fixed Income': 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  Funds: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  Derivatives: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  Cash: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
  Custom: 'bg-muted text-muted-foreground border-border',
};

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Class</th>
            <th className="text-right">Quantity</th>
            <th className="text-right">Avg Cost</th>
            <th className="text-right">Price</th>
            <th className="text-right">Market Value</th>
            <th className="text-right">P&L</th>
            <th className="text-right">Day Chg</th>
            <th className="text-right">Weight</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const isPositivePL = position.unrealizedPL >= 0;
            const isPositiveDay = position.dayChange >= 0;

            return (
              <tr key={position.id} className="group">
                <td>
                  <div>
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {position.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {position.name}
                    </p>
                  </div>
                </td>
                <td>
                  <Badge variant="outline" className={cn('text-xs', assetClassColors[position.assetClass])}>
                    {position.assetClass}
                  </Badge>
                </td>
                <td className="text-right mono">{formatNumber(position.quantity)}</td>
                <td className="text-right mono">{formatCurrency(position.avgCost)}</td>
                <td className="text-right mono">{formatCurrency(position.currentPrice)}</td>
                <td className="text-right mono font-medium">{formatCurrency(position.marketValue)}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isPositivePL ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-gain" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                    )}
                    <div>
                      <p className={cn('text-sm font-medium mono', getChangeColor(position.unrealizedPL))}>
                        {isPositivePL ? '+' : ''}{formatCurrency(position.unrealizedPL)}
                      </p>
                      <p className={cn('text-xs mono', getChangeColor(position.unrealizedPLPercent))}>
                        {isPositivePL ? '+' : ''}{formatPercent(position.unrealizedPLPercent)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-right">
                  <span className={cn('text-sm mono', getChangeColor(position.dayChangePercent))}>
                    {isPositiveDay ? '+' : ''}{formatPercent(position.dayChangePercent)}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(position.weight * 10, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm mono text-muted-foreground w-12 text-right">
                      {formatPercent(position.weight)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
