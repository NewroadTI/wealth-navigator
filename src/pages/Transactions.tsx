import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { transactions } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Download, Calendar } from 'lucide-react';

const Transactions = () => {
  return (
    <AppLayout title="Transactions" subtitle="View and manage all financial transactions">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search transactions..."
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
          <Button variant="outline" size="icon" className="border-border">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="border-border">
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-border">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Transactions</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{transactions.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Buys</p>
          <p className="text-2xl font-semibold text-loss mt-1">
            {transactions.filter((t) => t.type === 'Buy').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Sells</p>
          <p className="text-2xl font-semibold text-gain mt-1">
            {transactions.filter((t) => t.type === 'Sell').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Dividends</p>
          <p className="text-2xl font-semibold text-chart-2 mt-1">
            {transactions.filter((t) => t.type === 'Dividend').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Settled</p>
          <p className="text-2xl font-semibold text-success mt-1">
            {transactions.filter((t) => t.status === 'Settled').length}
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <TransactionsTable transactions={transactions} />
      </div>
    </AppLayout>
  );
};

export default Transactions;
