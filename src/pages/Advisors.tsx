import { AppLayout } from '@/components/layout/AppLayout';
import { advisors } from '@/lib/mockData';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Mail, Phone, Briefcase } from 'lucide-react';

const roleColors = {
  'Sales Advisor': 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  'Relationship Advisor': 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  'Account Manager': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
};

const Advisors = () => {
  const totalAUM = advisors.reduce((sum, a) => sum + a.aum, 0);

  return (
    <AppLayout title="Advisors" subtitle="Manage financial advisors and assignments">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search advisors..."
            className="pl-9 bg-muted/50 border-border"
          />
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Advisor
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Advisors</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{advisors.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total AUM</p>
          <p className="text-2xl font-semibold mono text-foreground mt-1">
            {formatCurrency(totalAUM)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Avg AUM per Advisor</p>
          <p className="text-2xl font-semibold mono text-foreground mt-1">
            {formatCurrency(totalAUM / advisors.length)}
          </p>
        </div>
      </div>

      {/* Advisors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {advisors.map((advisor) => (
          <div
            key={advisor.id}
            className="bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg animate-fade-in"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-semibold text-primary">
                  {advisor.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{advisor.name}</h3>
                <Badge variant="outline" className={`text-xs mt-1 ${roleColors[advisor.role]}`}>
                  {advisor.role}
                </Badge>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{advisor.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{advisor.phone}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span className="text-xs">Portfolios</span>
                </div>
                <p className="text-lg font-semibold text-foreground">{advisor.portfoliosCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">AUM</p>
                <p className="text-lg font-semibold mono text-foreground">
                  ${(advisor.aum / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Advisors;
