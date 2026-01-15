import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2, Building, Globe, Factory, BarChart3 } from 'lucide-react';

// Mock data
const mockExchanges = [
  { id: '1', code: 'NYSE', name: 'New York Stock Exchange', country: 'United States', timezone: 'EST' },
  { id: '2', code: 'NASDAQ', name: 'NASDAQ', country: 'United States', timezone: 'EST' },
  { id: '3', code: 'LSE', name: 'London Stock Exchange', country: 'United Kingdom', timezone: 'GMT' },
  { id: '4', code: 'TSE', name: 'Tokyo Stock Exchange', country: 'Japan', timezone: 'JST' },
];

const mockCountries = [
  { id: '1', code: 'US', name: 'United States', currency: 'USD', region: 'North America' },
  { id: '2', code: 'GB', name: 'United Kingdom', currency: 'GBP', region: 'Europe' },
  { id: '3', code: 'DE', name: 'Germany', currency: 'EUR', region: 'Europe' },
  { id: '4', code: 'JP', name: 'Japan', currency: 'JPY', region: 'Asia' },
  { id: '5', code: 'CH', name: 'Switzerland', currency: 'CHF', region: 'Europe' },
];

const mockIndustries = [
  { id: '1', code: 'TECH', name: 'Technology', sector: 'Information Technology' },
  { id: '2', code: 'FINC', name: 'Financials', sector: 'Financial Services' },
  { id: '3', code: 'HLTH', name: 'Healthcare', sector: 'Health Care' },
  { id: '4', code: 'ENGY', name: 'Energy', sector: 'Energy' },
  { id: '5', code: 'CONS', name: 'Consumer Goods', sector: 'Consumer Discretionary' },
];

const mockIndices = [
  { id: '1', code: 'SPX', name: 'S&P 500', exchange: 'NYSE', country: 'United States' },
  { id: '2', code: 'NDX', name: 'NASDAQ 100', exchange: 'NASDAQ', country: 'United States' },
  { id: '3', code: 'DJI', name: 'Dow Jones Industrial Average', exchange: 'NYSE', country: 'United States' },
  { id: '4', code: 'FTSE', name: 'FTSE 100', exchange: 'LSE', country: 'United Kingdom' },
  { id: '5', code: 'DAX', name: 'DAX 40', exchange: 'XETRA', country: 'Germany' },
];

const BasicData = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppLayout title="Basic Data" subtitle="Manage reference data for the system">
      <Tabs defaultValue="exchanges" className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
          <TabsList className="bg-muted/50 p-1 w-full sm:w-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="exchanges" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
              <Building className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              Exchanges
            </TabsTrigger>
            <TabsTrigger value="countries" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
              <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              Countries
            </TabsTrigger>
            <TabsTrigger value="industries" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
              <Factory className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              Industries
            </TabsTrigger>
            <TabsTrigger value="indices" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
              <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              Indices
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50 border-border text-sm"
              />
            </div>
          </div>
        </div>

        {/* Exchanges Tab */}
        <TabsContent value="exchanges">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Stock Exchanges</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Exchange
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Stock Exchange</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code</Label>
                        <Input placeholder="NYSE" className="mt-1" />
                      </div>
                      <div>
                        <Label>Timezone</Label>
                        <Input placeholder="EST" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="New York Stock Exchange" className="mt-1" />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Input placeholder="United States" className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Country</th>
                    <th className="text-xs md:text-sm hidden md:table-cell">Timezone</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockExchanges.map((exchange) => (
                    <tr key={exchange.id}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{exchange.code}</td>
                      <td className="text-foreground text-xs md:text-sm">{exchange.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">{exchange.country}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">{exchange.timezone}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Countries Tab */}
        <TabsContent value="countries">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Countries</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Country
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Country</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code (ISO)</Label>
                        <Input placeholder="US" className="mt-1" />
                      </div>
                      <div>
                        <Label>Currency</Label>
                        <Input placeholder="USD" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="United States" className="mt-1" />
                    </div>
                    <div>
                      <Label>Region</Label>
                      <Input placeholder="North America" className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Currency</th>
                    <th className="text-xs md:text-sm hidden md:table-cell">Region</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockCountries.map((country) => (
                    <tr key={country.id}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{country.code}</td>
                      <td className="text-foreground text-xs md:text-sm">{country.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">{country.currency}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">{country.region}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Industries Tab */}
        <TabsContent value="industries">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Industries</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Industry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Industry</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Code</Label>
                      <Input placeholder="TECH" className="mt-1" />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="Technology" className="mt-1" />
                    </div>
                    <div>
                      <Label>Sector</Label>
                      <Input placeholder="Information Technology" className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Sector</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockIndustries.map((industry) => (
                    <tr key={industry.id}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{industry.code}</td>
                      <td className="text-foreground text-xs md:text-sm">{industry.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">{industry.sector}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Indices Tab */}
        <TabsContent value="indices">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Market Indices</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Index
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Market Index</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code</Label>
                        <Input placeholder="SPX" className="mt-1" />
                      </div>
                      <div>
                        <Label>Exchange</Label>
                        <Input placeholder="NYSE" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="S&P 500" className="mt-1" />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Input placeholder="United States" className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Exchange</th>
                    <th className="text-xs md:text-sm hidden md:table-cell">Country</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockIndices.map((index) => (
                    <tr key={index.id}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{index.code}</td>
                      <td className="text-foreground text-xs md:text-sm">{index.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">{index.exchange}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">{index.country}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default BasicData;
