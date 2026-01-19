import { AppLayout } from '@/components/layout/AppLayout';
import { cashBalances } from '@/lib/mockData';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ArrowLeftRight, DollarSign, Euro, PoundSterling } from 'lucide-react';

const currencyIcons: Record<string, React.ReactNode> = {
  USD: <DollarSign className="h-5 w-5" />,
  EUR: <Euro className="h-5 w-5" />,
  GBP: <PoundSterling className="h-5 w-5" />,
  CHF: <span className="text-sm font-bold">₣</span>,
};

const Cash = () => {
  const totalUSD = cashBalances.reduce((sum, b) => sum + b.usdEquivalent, 0);

  return (
    <AppLayout title="Cash & FX" subtitle="Manage cash balances and currency positions">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 bg-muted/50 border-border"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-border">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            New FX Trade
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Cash Transaction
          </Button>
        </div>
      </div>

      {/* Total Balance */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-6 mb-6">
        <p className="text-sm text-muted-foreground mb-2">Total Cash (USD Equivalent)</p>
        <p className="text-4xl font-bold mono text-foreground">{formatCurrency(totalUSD)}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Across {cashBalances.length} currencies
        </p>
      </div>

      {/* Currency Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {cashBalances.map((balance) => (
          <div
            key={balance.currency}
            className="bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:border-primary/40"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-foreground">
                  {currencyIcons[balance.currency] || <span>{balance.currency}</span>}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{balance.currency}</h3>
                  <p className="text-xs text-muted-foreground">
                    Rate: {formatNumber(balance.fxRate, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Balance</p>
                <p className="text-xl font-semibold mono text-foreground">
                  {formatNumber(balance.balance)} {balance.currency}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">USD Equivalent</p>
                <p className="text-xl font-semibold mono text-foreground">
                  {formatCurrency(balance.usdEquivalent)}
                </p>
              </div>
            </div>

            {balance.currency !== 'USD' && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Convert to USD cost</span>
                  <span className="text-foreground mono">
                    ~{formatCurrency(balance.usdEquivalent * 0.001)} (0.1% spread)
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent FX Trades */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Recent FX Trades</h3>
          <a href="/transactions" className="text-sm text-primary hover:underline">
            View all
          </a>
        </div>
        <div className="p-8 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No recent FX trades</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Cash;
