import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { advisors, portfolios } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Mail, Phone, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';

const roleColors = {
  'Sales Advisor': 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  'Relationship Advisor': 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  'Account Manager': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
};

const Advisors = () => {
  const [expandedAdvisors, setExpandedAdvisors] = useState<string[]>([]);

  const toggleAdvisor = (advisorId: string) => {
    setExpandedAdvisors((prev) =>
      prev.includes(advisorId)
        ? prev.filter((id) => id !== advisorId)
        : [...prev, advisorId]
    );
  };

  const getAdvisorPortfolios = (advisorName: string) => {
    return portfolios.filter((p) => p.advisor === advisorName);
  };

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

      {/* Advisors List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/30 border-b border-border text-sm font-medium text-muted-foreground">
          <div className="col-span-1"></div>
          <div className="col-span-3">Advisor</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Portfolios</div>
          <div className="col-span-1"></div>
        </div>

        {/* Advisor Rows */}
        {advisors.map((advisor) => {
          const isExpanded = expandedAdvisors.includes(advisor.id);
          const advisorPortfolios = getAdvisorPortfolios(advisor.name);

          return (
            <Collapsible
              key={advisor.id}
              open={isExpanded}
              onOpenChange={() => toggleAdvisor(advisor.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-border hover:bg-muted/20 cursor-pointer transition-colors">
                  <div className="col-span-1">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {advisor.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">{advisor.name}</span>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className={`text-xs ${roleColors[advisor.role]}`}>
                      {advisor.role}
                    </Badge>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{advisor.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{advisor.phone}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{advisorPortfolios.length}</span>
                  </div>
                  <div className="col-span-1"></div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="bg-muted/10 border-b border-border">
                  <div className="px-10 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Managed Portfolios
                      </h4>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Assign Portfolio
                      </Button>
                    </div>
                    {advisorPortfolios.length > 0 ? (
                      <div className="space-y-2">
                        {advisorPortfolios.map((portfolio) => (
                          <Link
                            key={portfolio.id}
                            to={`/portfolios/${portfolio.id}`}
                            className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:border-primary/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {portfolio.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {portfolio.investor.name} • {portfolio.interfaceCode}
                                </p>
                              </div>
                            </div>
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
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        No portfolios assigned yet.
                      </p>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Advisors;
