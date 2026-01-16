import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { transactions, portfolios } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Search, Filter, Download, Calendar, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useToast } from '@/hooks/use-toast';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { ScrollArea } from '@/components/ui/scroll-area';

const transactionTypes = ['Buy', 'Sell', 'Deposit', 'Withdrawal', 'Dividend', 'Interest', 'Fee', 'FX Trade'];

const assetClasses = ['Equity', 'Fixed Income', 'Funds', 'Derivatives', 'Cash', 'Custom'];
const assetSubclasses: Record<string, string[]> = {
  'Equity': ['Common Stock', 'Preferred Stock', 'ADR', 'Warrant'],
  'Fixed Income': ['Government Bond', 'Corporate Bond', 'Structured Note', 'ETF'],
  'Funds': ['ETF', 'Mutual Fund', 'Closed-End Fund', 'Private Equity'],
  'Derivatives': ['Futures', 'Call Option', 'Put Option'],
  'Cash': ['Cash'],
  'Custom': ['Art', 'Loan', 'Real Estate', 'Other'],
};

const Transactions = () => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(transactionTypes);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showSum, setShowSum] = useState(false);
  const { toast } = useToast();
  const { addPageWithFilters } = useNavigationHistory();

  const handleSumIncome = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Date Range Required",
        description: "Please select a start and end date before calculating income.",
        variant: "destructive",
      });
      return;
    }
    setShowSum(true);
    // Save this filter to history
    addPageWithFilters('/transactions', 'Transactions', `Income ${startDate} to ${endDate}`);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!selectedTypes.includes(t.type)) return false;
      if (selectedPortfolio !== 'all' && t.portfolioId !== selectedPortfolio) return false;
      if (selectedAssetClass !== 'all' && t.assetClass !== selectedAssetClass) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [selectedTypes, selectedPortfolio, selectedAssetClass, startDate, endDate]);

  // Calculate sum of dividends and taxes (using Interest as proxy for tax-related)
  const dividendSum = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'Dividend')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  const interestSum = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'Interest')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  const feeSum = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'Fee')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  const availableSubclasses = selectedAssetClass !== 'all' ? assetSubclasses[selectedAssetClass] || [] : [];

  return (
    <AppLayout title="Transactions" subtitle="View and manage all financial transactions">
      {/* Filters Row */}
      <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
        {/* Top Row: Search and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search transactions..."
                className="pl-9 bg-muted/50 border-border text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Add Transaction</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Portfolio Filter */}
          <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
            <SelectTrigger className="w-full sm:w-40 md:w-48 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
              <SelectValue placeholder="Portfolio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portfolios</SelectItem>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Asset Class Filter */}
          <Select value={selectedAssetClass} onValueChange={(v) => { setSelectedAssetClass(v); setSelectedAssetSubclass('all'); }}>
            <SelectTrigger className="w-full sm:w-32 md:w-40 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
              <SelectValue placeholder="Asset Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {assetClasses.map((ac) => (
                <SelectItem key={ac} value={ac}>{ac}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Asset Subclass Filter */}
          {availableSubclasses.length > 0 && (
            <Select value={selectedAssetSubclass} onValueChange={setSelectedAssetSubclass}>
              <SelectTrigger className="w-full sm:w-32 md:w-40 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
                <SelectValue placeholder="Subclass" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subclasses</SelectItem>
                {availableSubclasses.map((asc) => (
                  <SelectItem key={asc} value={asc}>{asc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Type Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-8 md:h-9 text-xs md:text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Types ({selectedTypes.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Transaction Types</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setSelectedTypes(selectedTypes.length === transactionTypes.length ? [] : transactionTypes)}
                  >
                    {selectedTypes.length === transactionTypes.length ? 'Clear' : 'All'}
                  </Button>
                </div>
                {transactionTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => toggleType(type)}
                    />
                    <Label htmlFor={type} className="text-sm cursor-pointer">{type}</Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-8 md:h-9 text-xs md:text-sm">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Date Range</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                >
                  Clear Dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sum Dividends + Taxes Button */}
          <Button
            variant={showSum ? "secondary" : "outline"}
            size="sm"
            className="border-border h-8 md:h-9 text-xs md:text-sm"
            onClick={handleSumIncome}
          >
            <Calculator className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Sum Income</span>
          </Button>
        </div>
      </div>

      {/* Transactions Table with fixed height and scroll */}
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 min-h-0">
          <ScrollArea className="h-[calc(100vh-380px)] md:h-[calc(100vh-320px)]">
            {filteredTransactions.length > 0 ? (
              <TransactionsTable transactions={filteredTransactions} />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No transactions found for the selected filters
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Sum Display - Below the table */}
        {showSum && (
          <div className="flex flex-wrap gap-3 md:gap-4 p-3 md:p-4 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-2 w-full">
              Income from {startDate} to {endDate}
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-muted-foreground">Dividends</p>
              <p className="text-sm md:text-lg font-semibold mono text-gain">{formatCurrency(dividendSum)}</p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-muted-foreground">Interest</p>
              <p className="text-sm md:text-lg font-semibold mono text-gain">{formatCurrency(interestSum)}</p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-muted-foreground">Fees / Taxes</p>
              <p className="text-sm md:text-lg font-semibold mono text-loss">{formatCurrency(feeSum)}</p>
            </div>
            <div className="flex-1 min-w-[120px] border-l border-border pl-3 md:pl-4">
              <p className="text-xs text-muted-foreground">Net Income</p>
              <p className={`text-sm md:text-lg font-semibold mono ${(dividendSum + interestSum + feeSum) >= 0 ? 'text-gain' : 'text-loss'}`}>
                {formatCurrency(dividendSum + interestSum + feeSum)}
              </p>
            </div>
          </div>
        )}
      </div>

    </AppLayout>
  );
};

export default Transactions;
