import { Transaction } from '@/lib/mockData';
import { formatCurrency, formatDate, getChangeColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, DollarSign, Percent, Repeat, CreditCard } from 'lucide-react';

interface TransactionsTableProps {
  transactions: Transaction[];
}

const transactionIcons = {
  Buy: ArrowDownRight,
  Sell: ArrowUpRight,
  Deposit: ArrowUpRight,
  Withdrawal: ArrowDownRight,
  Dividend: DollarSign,
  Interest: Percent,
  Fee: CreditCard,
  'FX Trade': Repeat,
};

const typeColors = {
  Buy: 'bg-loss/20 text-loss border-loss/30',
  Sell: 'bg-gain/20 text-gain border-gain/30',
  Deposit: 'bg-gain/20 text-gain border-gain/30',
  Withdrawal: 'bg-loss/20 text-loss border-loss/30',
  Dividend: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  Interest: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  Fee: 'bg-muted text-muted-foreground border-border',
  'FX Trade': 'bg-chart-4/20 text-chart-4 border-chart-4/30',
};

const statusColors = {
  Settled: 'status-active',
  Pending: 'status-pending',
  Cancelled: 'status-closed',
};

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Symbol</th>
            <th className="text-right">Quantity</th>
            <th className="text-right">Price</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
            <th>Account</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const Icon = transactionIcons[tx.type];

            return (
              <tr key={tx.id} className="group">
                <td className="mono text-sm">{formatDate(tx.date)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-md', typeColors[tx.type])}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <Badge variant="outline" className={cn('text-xs', typeColors[tx.type])}>
                      {tx.type}
                    </Badge>
                  </div>
                </td>
                <td>
                  <p className="text-sm text-foreground max-w-[250px] truncate">
                    {tx.description}
                  </p>
                </td>
                <td>
                  {tx.symbol ? (
                    <span className="font-medium text-foreground">{tx.symbol}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-right mono">
                  {tx.quantity ? tx.quantity.toLocaleString() : '—'}
                </td>
                <td className="text-right mono">
                  {tx.price ? formatCurrency(tx.price) : '—'}
                </td>
                <td className="text-right">
                  <span className={cn('font-medium mono', getChangeColor(tx.amount))}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </td>
                <td>
                  <Badge variant="outline" className={cn('text-xs', statusColors[tx.status])}>
                    {tx.status}
                  </Badge>
                </td>
                <td className="text-sm text-muted-foreground">{tx.account}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
