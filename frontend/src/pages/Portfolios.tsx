import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PortfolioCard } from '@/components/portfolios/PortfolioCard';
import { portfolios } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Filter, Download, User, Building2, Wallet, LayoutGrid, List } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const Portfolios = () => {
  const [isNewPortfolioOpen, setIsNewPortfolioOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <AppLayout title="Portfolios" subtitle="Manage investor portfolios and accounts">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search portfolios..."
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
          <Button variant="outline" size="icon" className="border-border">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="border-border">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isNewPortfolioOpen} onOpenChange={setIsNewPortfolioOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Investor Portfolio</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="investor" className="mt-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="investor" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Investor
                  </TabsTrigger>
                  <TabsTrigger value="portfolio" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Portfolio
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Accounts
                  </TabsTrigger>
                </TabsList>

                {/* Investor Tab */}
                <TabsContent value="investor" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="investorName">Full Name / Company Name</Label>
                      <Input id="investorName" placeholder="James Morrison" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="investorType">Entity Type</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="Company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="email@example.com" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" placeholder="+1 (555) 123-4567" className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taxId">Tax ID / Passport</Label>
                      <Input id="taxId" placeholder="***-**-1234" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="riskLevel">Risk Tolerance</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Conservative">Conservative</SelectItem>
                          <SelectItem value="Moderate">Moderate</SelectItem>
                          <SelectItem value="Aggressive">Aggressive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="advisor">Assigned Advisor</Label>
                    <Select>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select advisor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sarah">Sarah Chen (Relationship)</SelectItem>
                        <SelectItem value="michael">Michael Torres (Sales)</SelectItem>
                        <SelectItem value="jennifer">Jennifer Williams (Account Manager)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Portfolio Tab */}
                <TabsContent value="portfolio" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="portfolioName">Portfolio Name</Label>
                      <Input id="portfolioName" placeholder="Global Growth Portfolio" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="interfaceCode">Interface Code</Label>
                      <Input id="interfaceCode" placeholder="WR-2024-001" className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="portfolioType">Portfolio Type</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="Corporate">Corporate</SelectItem>
                          <SelectItem value="Joint">Joint (Mancomunado)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="mainCurrency">Main Currency</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" placeholder="United States" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="benchmark">Benchmark</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select benchmark" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sp500">S&P 500</SelectItem>
                          <SelectItem value="nasdaq">NASDAQ 100</SelectItem>
                          <SelectItem value="bloomberg">Bloomberg US Agg</SelectItem>
                          <SelectItem value="eurostoxx">Euro Stoxx 50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="inceptionDate">Inception Date</Label>
                      <Input id="inceptionDate" type="date" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="processingType">Processing Type</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full">Full Processing (NAV, Fees, Return)</SelectItem>
                          <SelectItem value="Custody">Custody Only (View balances)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                {/* Accounts Tab */}
                <TabsContent value="accounts" className="space-y-4 mt-4">
                  <div className="bg-muted/30 border border-border rounded-lg p-4">
                    <h4 className="font-medium text-foreground mb-4">Add Account</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="institution">Institution</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select institution" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ib">Interactive Brokers</SelectItem>
                            <SelectItem value="pershing">Pershing</SelectItem>
                            <SelectItem value="ubs">UBS</SelectItem>
                            <SelectItem value="jpmorgan">JP Morgan</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="accountCode">Account Code</Label>
                        <Input id="accountCode" placeholder="IB-001" className="mt-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label htmlFor="accountName">Account Name</Label>
                        <Input id="accountName" placeholder="Main Brokerage USD" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="accountType">Account Type</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Brokerage">Brokerage (Securities)</SelectItem>
                            <SelectItem value="Bank">Bank (Cash Only)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label htmlFor="accountCurrency">Currency</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="costMethod">Cost Method</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FIFO">FIFO (First-In, First-Out)</SelectItem>
                            <SelectItem value="Average">Average Cost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button variant="outline" className="mt-4 w-full border-dashed">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Account
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Multi-currency accounts must be registered as separate sub-accounts to prevent accounting errors.
                  </p>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                <Button variant="outline" onClick={() => setIsNewPortfolioOpen(false)}>Cancel</Button>
                <Button className="bg-primary text-primary-foreground">Create Portfolio</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Portfolio Grid or List View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {portfolios.map((portfolio) => (
            <PortfolioCard key={portfolio.id} portfolio={portfolio} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* List Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/30 border-b border-border text-sm font-medium text-muted-foreground">
            <div className="col-span-3">Portfolio</div>
            <div className="col-span-2">Investor</div>
            <div className="col-span-2 text-right">Total Value</div>
            <div className="col-span-2 text-right">Day Change</div>
            <div className="col-span-1 text-right">YTD</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-center">Type</div>
          </div>

          {/* List Rows */}
          {portfolios.map((portfolio) => (
            <Link
              key={portfolio.id}
              to={`/portfolios/${portfolio.id}`}
              className="grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
            >
              <div className="col-span-3">
                <p className="font-medium text-foreground">{portfolio.name}</p>
                <p className="text-xs text-muted-foreground">{portfolio.interfaceCode}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-foreground">{portfolio.investor.name}</p>
                <p className="text-xs text-muted-foreground">{portfolio.type}</p>
              </div>
              <div className="col-span-2 text-right">
                <p className="font-mono font-medium text-foreground">
                  {formatCurrency(portfolio.totalValue)}
                </p>
              </div>
              <div className="col-span-2 text-right">
                <p
                  className={`font-mono font-medium ${
                    portfolio.dayChange >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {portfolio.dayChange >= 0 ? '+' : ''}
                  {formatCurrency(portfolio.dayChange)}
                </p>
                <p
                  className={`text-xs ${
                    portfolio.dayChangePercent >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {formatPercent(portfolio.dayChangePercent)}
                </p>
              </div>
              <div className="col-span-1 text-right">
                <span
                  className={`font-mono ${
                    portfolio.ytdReturn >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {formatPercent(portfolio.ytdReturn)}
                </span>
              </div>
              <div className="col-span-1 text-center">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    portfolio.status === 'Active'
                      ? 'bg-success/20 text-success border-success/30'
                      : portfolio.status === 'Pending'
                      ? 'bg-warning/20 text-warning border-warning/30'
                      : 'bg-muted/20 text-muted-foreground border-border'
                  }`}
                >
                  {portfolio.status}
                </Badge>
              </div>
              <div className="col-span-1 text-center">
                <Badge variant="outline" className="text-xs">
                  {portfolio.processingType}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Portfolios;
