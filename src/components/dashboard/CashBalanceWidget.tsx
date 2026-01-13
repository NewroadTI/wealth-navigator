import { cashBalances } from '@/lib/mockData';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Wallet } from 'lucide-react';

export function CashBalanceWidget() {
  const totalUSD = cashBalances.reduce((sum, b) => sum + b.usdEquivalent, 0);

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Cash Balances</h3>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {cashBalances.map((balance) => (
          <div
            key={balance.currency}
            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                {balance.currency}
              </div>
              <div>
                <p className="text-sm font-medium mono text-foreground">
                  {formatNumber(balance.balance)} {balance.currency}
                </p>
                <p className="text-xs text-muted-foreground">
                  Rate: {formatNumber(balance.fxRate, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium mono text-foreground">
                {formatCurrency(balance.usdEquivalent)}
              </p>
              <p className="text-xs text-muted-foreground">USD equiv.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total (USD)</span>
          <span className="text-lg font-semibold mono text-foreground">
            {formatCurrency(totalUSD)}
          </span>
        </div>
      </div>
    </div>
  );
}
