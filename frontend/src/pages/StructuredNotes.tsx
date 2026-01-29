import { Fragment, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { 
  Search, 
  Download, 
  Plus, 
  ChevronDown, 
  ChevronRight,
  Users
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// Mock data for structured notes
interface StructuredNoteHolder {
  userId: string;
  name: string;
  quantity: number;
  purchaseDate: string;
  purchasePrice: number;
  portfolioName: string;
}

interface StructuredNote {
  isin: string;
  issuer: string;
  product: string;
  size: number;
  underlying: string;
  mktPrice: number;
  cupon: number;
  autocall: string;
  proteccion: number;
  holders: StructuredNoteHolder[];
}

interface StructuredNoteTransaction {
  id: string;
  date: string;
  noteIsin: string;
  type: 'Buy' | 'Sell' | 'Coupon' | 'Redemption';
  investor: string;
  portfolio: string;
  quantity: number;
  price: number;
  amount: number;
  status: 'Completed' | 'Pending' | 'Cancelled';
}

// Mock structured notes data
const mockStructuredNotes: StructuredNote[] = [
  {
    isin: 'XS2345678901',
    issuer: 'Goldman Sachs',
    product: 'Phoenix Autocall Note',
    size: 5000000,
    underlying: 'AAPL, MSFT, GOOGL',
    mktPrice: 98.5,
    cupon: 8.5,
    autocall: '105%',
    proteccion: 70,
    holders: [
      { userId: '1', name: 'John Smith', quantity: 100000, purchaseDate: '2024-06-15', purchasePrice: 100, portfolioName: 'Smith Family Trust' },
      { userId: '2', name: 'Maria Garcia', quantity: 250000, purchaseDate: '2024-07-01', purchasePrice: 99.5, portfolioName: 'Garcia Investments' },
      { userId: '3', name: 'Robert Chen', quantity: 150000, purchaseDate: '2024-08-10', purchasePrice: 98.75, portfolioName: 'Chen Holdings' },
    ],
  },
  {
    isin: 'XS3456789012',
    issuer: 'JP Morgan',
    product: 'Barrier Reverse Convertible',
    size: 3000000,
    underlying: 'NVDA',
    mktPrice: 102.3,
    cupon: 12.0,
    autocall: 'N/A',
    proteccion: 60,
    holders: [
      { userId: '4', name: 'Sarah Johnson', quantity: 500000, purchaseDate: '2024-05-20', purchasePrice: 100, portfolioName: 'Johnson Retirement' },
      { userId: '5', name: 'David Lee', quantity: 200000, purchaseDate: '2024-06-05', purchasePrice: 100.5, portfolioName: 'Lee Capital' },
    ],
  },
  {
    isin: 'XS4567890123',
    issuer: 'UBS',
    product: 'Callable Note on Index',
    size: 10000000,
    underlying: 'S&P 500',
    mktPrice: 95.8,
    cupon: 6.5,
    autocall: '110%',
    proteccion: 80,
    holders: [
      { userId: '6', name: 'Emily Davis', quantity: 1000000, purchaseDate: '2024-04-01', purchasePrice: 100, portfolioName: 'Davis Family Office' },
      { userId: '1', name: 'John Smith', quantity: 500000, purchaseDate: '2024-04-15', purchasePrice: 99.8, portfolioName: 'Smith Family Trust' },
    ],
  },
  {
    isin: 'XS5678901234',
    issuer: 'Morgan Stanley',
    product: 'Memory Coupon Note',
    size: 2500000,
    underlying: 'TSLA, META',
    mktPrice: 88.2,
    cupon: 15.0,
    autocall: '100%',
    proteccion: 55,
    holders: [
      { userId: '7', name: 'Michael Brown', quantity: 300000, purchaseDate: '2024-09-01', purchasePrice: 100, portfolioName: 'Brown Ventures' },
    ],
  },
  {
    isin: 'XS6789012345',
    issuer: 'Credit Suisse',
    product: 'Twin-Win Certificate',
    size: 7500000,
    underlying: 'EURO STOXX 50',
    mktPrice: 104.5,
    cupon: 5.0,
    autocall: 'N/A',
    proteccion: 90,
    holders: [
      { userId: '2', name: 'Maria Garcia', quantity: 750000, purchaseDate: '2024-03-10', purchasePrice: 100, portfolioName: 'Garcia Investments' },
      { userId: '8', name: 'Jennifer Wilson', quantity: 400000, purchaseDate: '2024-04-20', purchasePrice: 101.2, portfolioName: 'Wilson Trust' },
      { userId: '9', name: 'Christopher Taylor', quantity: 350000, purchaseDate: '2024-05-15', purchasePrice: 102.0, portfolioName: 'Taylor Advisors' },
    ],
  },
];

// Mock transactions for structured notes
const mockNoteTransactions: StructuredNoteTransaction[] = [
  { id: 'sn-1', date: '2025-01-15', noteIsin: 'XS2345678901', type: 'Buy', investor: 'John Smith', portfolio: 'Smith Family Trust', quantity: 50000, price: 98.5, amount: 49250, status: 'Completed' },
  { id: 'sn-2', date: '2025-01-14', noteIsin: 'XS3456789012', type: 'Coupon', investor: 'Sarah Johnson', portfolio: 'Johnson Retirement', quantity: 500000, price: 0, amount: 15000, status: 'Completed' },
  { id: 'sn-3', date: '2025-01-13', noteIsin: 'XS4567890123', type: 'Buy', investor: 'Emily Davis', portfolio: 'Davis Family Office', quantity: 200000, price: 95.8, amount: 191600, status: 'Completed' },
  { id: 'sn-4', date: '2025-01-12', noteIsin: 'XS2345678901', type: 'Sell', investor: 'Maria Garcia', portfolio: 'Garcia Investments', quantity: 50000, price: 99.0, amount: 49500, status: 'Completed' },
  { id: 'sn-5', date: '2025-01-11', noteIsin: 'XS5678901234', type: 'Buy', investor: 'Michael Brown', portfolio: 'Brown Ventures', quantity: 100000, price: 88.2, amount: 88200, status: 'Pending' },
  { id: 'sn-6', date: '2025-01-10', noteIsin: 'XS6789012345', type: 'Coupon', investor: 'Maria Garcia', portfolio: 'Garcia Investments', quantity: 750000, price: 0, amount: 9375, status: 'Completed' },
  { id: 'sn-7', date: '2025-01-09', noteIsin: 'XS3456789012', type: 'Redemption', investor: 'David Lee', portfolio: 'Lee Capital', quantity: 100000, price: 102.3, amount: 102300, status: 'Completed' },
  { id: 'sn-8', date: '2025-01-08', noteIsin: 'XS4567890123', type: 'Sell', investor: 'John Smith', portfolio: 'Smith Family Trust', quantity: 100000, price: 96.5, amount: 96500, status: 'Completed' },
];

const StructuredNotes = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIsin, setExpandedIsin] = useState<string | null>(null);

  // Filter notes based on search
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return mockStructuredNotes;
    const query = searchQuery.toLowerCase();
    return mockStructuredNotes.filter(note =>
      note.isin.toLowerCase().includes(query) ||
      note.issuer.toLowerCase().includes(query) ||
      note.product.toLowerCase().includes(query) ||
      note.underlying.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Build filter string
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    return params.toString();
  }, [searchQuery]);

  const toggleExpand = (isin: string) => {
    setExpandedIsin(expandedIsin === isin ? null : isin);
  };

  const getTypeColor = (type: StructuredNoteTransaction['type']) => {
    switch (type) {
      case 'Buy': return 'bg-blue-500/10 text-blue-500';
      case 'Sell': return 'bg-orange-500/10 text-orange-500';
      case 'Coupon': return 'bg-green-500/10 text-green-500';
      case 'Redemption': return 'bg-purple-500/10 text-purple-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: StructuredNoteTransaction['status']) => {
    switch (status) {
      case 'Completed': return 'bg-green-500/10 text-green-500';
      case 'Pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'Cancelled': return 'bg-red-500/10 text-red-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout title="Structured Notes" subtitle="Manage and track structured products">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveFilterButton
            currentPath={location.pathname}
            currentFilters={currentFilters}
            defaultTitle="Structured Notes"
          />
          <Button variant="outline" size="sm" className="border-border">
            <Download className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Add Note</span>
          </Button>
        </div>
      </div>

      {/* Structured Notes Table */}
      <Card className="border-border mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Structured Products ({filteredNotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>ISIN</th>
                  <th>Issuer</th>
                  <th>Product</th>
                  <th className="text-right">Size</th>
                  <th>Underlying</th>
                  <th className="text-right">Mkt Price</th>
                  <th className="text-right">Cupón</th>
                  <th className="text-center">Autocall</th>
                  <th className="text-right">Protección</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map((note) => {
                  const isExpanded = expandedIsin === note.isin;
                  return (
                    <Fragment key={note.isin}>
                      <tr
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          isExpanded && "bg-muted/30"
                        )}
                        onClick={() => toggleExpand(note.isin)}
                      >
                        <td className="w-8">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td>
                          <span className="font-medium text-primary">{note.isin}</span>
                        </td>
                        <td>{note.issuer}</td>
                        <td className="max-w-[200px] truncate">{note.product}</td>
                        <td className="text-right mono">{formatCurrency(note.size)}</td>
                        <td className="max-w-[150px] truncate text-muted-foreground">{note.underlying}</td>
                        <td className="text-right mono">{note.mktPrice.toFixed(2)}%</td>
                        <td className="text-right mono text-gain">{note.cupon.toFixed(1)}%</td>
                        <td className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {note.autocall}
                          </Badge>
                        </td>
                        <td className="text-right mono">{note.proteccion}%</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${note.isin}-holders`} className="bg-muted/20">
                          <td colSpan={10} className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Holders ({note.holders.length})</span>
                            </div>
                            <div className="bg-card rounded-lg border border-border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border bg-muted/50">
                                    <th className="px-4 py-2 text-left font-medium">Name</th>
                                    <th className="px-4 py-2 text-left font-medium">Portfolio</th>
                                    <th className="px-4 py-2 text-right font-medium">Quantity</th>
                                    <th className="px-4 py-2 text-right font-medium">Purchase Price</th>
                                    <th className="px-4 py-2 text-right font-medium">Purchase Date</th>
                                    <th className="px-4 py-2 text-right font-medium">Current Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {note.holders.map((holder, idx) => {
                                    const currentValue = (holder.quantity / 100) * note.mktPrice;
                                    const purchaseValue = (holder.quantity / 100) * holder.purchasePrice;
                                    const pnl = currentValue - purchaseValue;
                                    return (
                                      <tr key={`${holder.userId}-${idx}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                                        <td className="px-4 py-2 font-medium">{holder.name}</td>
                                        <td className="px-4 py-2 text-muted-foreground">{holder.portfolioName}</td>
                                        <td className="px-4 py-2 text-right mono">{formatCurrency(holder.quantity)}</td>
                                        <td className="px-4 py-2 text-right mono">{holder.purchasePrice.toFixed(2)}%</td>
                                        <td className="px-4 py-2 text-right mono text-muted-foreground">{holder.purchaseDate}</td>
                                        <td className="px-4 py-2 text-right">
                                          <span className="mono">{formatCurrency(currentValue)}</span>
                                          <span className={cn("ml-2 text-xs", pnl >= 0 ? "text-gain" : "text-loss")}>
                                            ({pnl >= 0 ? '+' : ''}{formatCurrency(pnl)})
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table for Structured Notes */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Structured Note Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>ISIN</th>
                  <th>Type</th>
                  <th>Investor</th>
                  <th>Portfolio</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockNoteTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-muted/50">
                    <td className="mono text-muted-foreground">{txn.date}</td>
                    <td>
                      <span className="font-medium text-primary">{txn.noteIsin}</span>
                    </td>
                    <td>
                      <Badge className={cn("text-xs", getTypeColor(txn.type))}>
                        {txn.type}
                      </Badge>
                    </td>
                    <td>{txn.investor}</td>
                    <td className="text-muted-foreground">{txn.portfolio}</td>
                    <td className="text-right mono">{formatCurrency(txn.quantity)}</td>
                    <td className="text-right mono">
                      {txn.price > 0 ? `${txn.price.toFixed(2)}%` : '-'}
                    </td>
                    <td className="text-right mono font-medium">{formatCurrency(txn.amount)}</td>
                    <td className="text-center">
                      <Badge className={cn("text-xs", getStatusColor(txn.status))}>
                        {txn.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default StructuredNotes;
