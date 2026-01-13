import { AppLayout } from '@/components/layout/AppLayout';
import { portfolios } from '@/lib/mockData';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, User, Building2, Shield } from 'lucide-react';

// Extract unique investors from portfolios
const investors = portfolios.map((p) => ({
  id: p.id,
  name: p.investor.name,
  type: p.investor.type,
  riskLevel: p.investor.riskLevel,
  portfolios: 1,
  totalValue: p.totalValue,
  advisor: p.advisor,
}));

const riskColors = {
  Conservative: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Aggressive: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const Investors = () => {
  const totalAUM = investors.reduce((sum, i) => sum + i.totalValue, 0);

  return (
    <AppLayout title="Investors" subtitle="Client profiles and relationship management">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search investors..."
            className="pl-9 bg-muted/50 border-border"
          />
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Investor
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Investors</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{investors.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Individuals</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {investors.filter((i) => i.type === 'Individual').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Companies</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {investors.filter((i) => i.type === 'Company').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total AUM</p>
          <p className="text-2xl font-semibold mono text-foreground mt-1">
            {formatCurrency(totalAUM)}
          </p>
        </div>
      </div>

      {/* Investors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {investors.map((investor) => (
          <div
            key={investor.id}
            className="bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg animate-fade-in cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                {investor.type === 'Individual' ? (
                  <User className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{investor.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs bg-secondary/50">
                    {investor.type}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${riskColors[investor.riskLevel]}`}>
                    <Shield className="h-3 w-3 mr-1" />
                    {investor.riskLevel}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                <p className="text-lg font-semibold mono text-foreground">
                  {formatCurrency(investor.totalValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Advisor</p>
                <p className="text-sm font-medium text-foreground">{investor.advisor}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Investors;
