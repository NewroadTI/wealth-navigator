import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { transactions, portfolios } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Plus, Search, Filter, Download, Calendar, Calculator, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const transactionTypes = ['Buy', 'Sell', 'Deposit', 'Withdrawal', 'Dividend', 'Interest', 'Fee', 'FX Trade', 'Structured Note'];

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
  const location = useLocation();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(transactionTypes);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showSum, setShowSum] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

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
      if (startDate && t.date < format(startDate, 'yyyy-MM-dd')) return false;
      if (endDate && t.date > format(endDate, 'yyyy-MM-dd')) return false;
      return true;
    });
  }, [selectedTypes, selectedPortfolio, selectedAssetClass, startDate, endDate]);

  // Build current filter string for saving
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPortfolio !== 'all') params.set('portfolio', selectedPortfolio);
    if (selectedAssetClass !== 'all') params.set('class', selectedAssetClass);
    if (selectedAssetSubclass !== 'all') params.set('subclass', selectedAssetSubclass);
    if (startDate) params.set('from', format(startDate, 'yyyy-MM-dd'));
    if (endDate) params.set('to', format(endDate, 'yyyy-MM-dd'));
    if (selectedTypes.length !== transactionTypes.length) {
      params.set('types', selectedTypes.join(','));
    }
    return params.toString();
  }, [selectedPortfolio, selectedAssetClass, selectedAssetSubclass, startDate, endDate, selectedTypes]);

  // Calculate sum of income
  const { dividendSum, interestSum, feeSum } = useMemo(() => {
    const txns = filteredTransactions;
    return {
      dividendSum: txns.filter((t) => t.type === 'Dividend').reduce((acc, t) => acc + t.amount, 0),
      interestSum: txns.filter((t) => t.type === 'Interest').reduce((acc, t) => acc + t.amount, 0),
      feeSum: txns.filter((t) => t.type === 'Fee').reduce((acc, t) => acc + t.amount, 0),
    };
  }, [filteredTransactions]);

  const handleSumIncome = () => {
    if (!startDate || !endDate) {
      toast.error('Please select a date range first', {
        description: 'Both start and end dates are required to calculate income sum.',
      });
      return;
    }
    setShowSum(true);
  };

  const availableSubclasses = selectedAssetClass !== 'all' ? assetSubclasses[selectedAssetClass] || [] : [];

  // Build filter title for saving
  const filterTitle = useMemo(() => {
    const parts: string[] = ['Transactions'];
    if (selectedPortfolio !== 'all') {
      const pf = portfolios.find(p => p.id === selectedPortfolio);
      if (pf) parts.push(pf.name);
    }
    if (startDate && endDate) parts.push(`${format(startDate, 'yyyy-MM-dd')} - ${format(endDate, 'yyyy-MM-dd')}`);
    return parts.join(' - ');
  }, [selectedPortfolio, startDate, endDate]);

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
            <SaveFilterButton
              currentPath={location.pathname}
              currentFilters={currentFilters}
              defaultTitle={filterTitle}
            />
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
              <Button 
                variant="outline" 
                size="sm" 
                className={`border-border h-8 md:h-9 text-xs md:text-sm ${startDate && endDate ? 'border-primary text-primary' : ''}`}
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">
                  {startDate && endDate 
                    ? `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}` 
                    : 'Date Range'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-2 block">Start Date</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartDateOpen(false);
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">End Date</Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date);
                          setEndDateOpen(false);
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => { setStartDate(undefined); setEndDate(undefined); setShowSum(false); }}
                >
                  Clear Dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sum Income Button */}
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

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filteredTransactions.length > 0 ? (
          <TransactionsTable transactions={filteredTransactions} />
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No transactions found for the selected filters
          </div>
        )}
      </div>

      {/* Sum Display - Below Table */}
      {showSum && (
        <div className="mt-4 md:mt-6">
          {(!startDate || !endDate) ? (
            <div className="flex items-center gap-2 p-3 md:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">Please select a date range to calculate income sum.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Income Summary ({format(startDate, 'yyyy-MM-dd')} to {format(endDate, 'yyyy-MM-dd')})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Dividends</p>
                  <p className="text-lg md:text-2xl font-semibold mono text-gain">{formatCurrency(dividendSum)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Interest</p>
                  <p className="text-lg md:text-2xl font-semibold mono text-gain">{formatCurrency(interestSum)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fees / Taxes</p>
                  <p className="text-lg md:text-2xl font-semibold mono text-loss">{formatCurrency(feeSum)}</p>
                </div>
                <div className="border-l border-border pl-4">
                  <p className="text-xs text-muted-foreground">Net Income</p>
                  <p className={`text-lg md:text-2xl font-semibold mono ${(dividendSum + interestSum + feeSum) >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {formatCurrency(dividendSum + interestSum + feeSum)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Transactions;
