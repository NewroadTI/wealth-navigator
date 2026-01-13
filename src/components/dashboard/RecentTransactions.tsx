import { transactions } from '@/lib/mockData';
import { formatCurrency, formatDate, getChangeColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, RefreshCw, DollarSign, Percent, Repeat } from 'lucide-react';

const transactionIcons = {
  Buy: ArrowDownRight,
  Sell: ArrowUpRight,
  Deposit: ArrowUpRight,
  Withdrawal: ArrowDownRight,
  Dividend: DollarSign,
  Interest: Percent,
  Fee: ArrowDownRight,
  'FX Trade': Repeat,
};

const transactionColors = {
  Buy: 'text-loss',
  Sell: 'text-gain',
  Deposit: 'text-gain',
  Withdrawal: 'text-loss',
  Dividend: 'text-gain',
  Interest: 'text-gain',
  Fee: 'text-loss',
  'FX Trade': 'text-accent',
};

export function RecentTransactions() {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Recent Transactions</h3>
        <a href="/transactions" className="text-xs text-primary hover:underline">
          View all
        </a>
      </div>
      <div className="space-y-3">
        {transactions.slice(0, 5).map((tx) => {
          const Icon = transactionIcons[tx.type];
          const colorClass = transactionColors[tx.type];

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-muted', colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tx.type}
                    {tx.symbol && <span className="text-muted-foreground ml-1">{tx.symbol}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-medium mono', getChangeColor(tx.amount))}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </p>
                <p className="text-xs text-muted-foreground">{tx.status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
