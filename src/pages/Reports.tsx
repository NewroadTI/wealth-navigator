import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, Filter, BarChart3, PieChart, TrendingUp, FileSpreadsheet } from 'lucide-react';

const reportTypes = [
  {
    id: 'portfolio-summary',
    name: 'Portfolio Summary',
    description: 'Overview of all portfolios with key metrics and performance',
    icon: BarChart3,
    format: 'PDF / Excel',
  },
  {
    id: 'position-report',
    name: 'Position Report',
    description: 'Detailed holdings across all portfolios with cost basis',
    icon: PieChart,
    format: 'PDF / Excel',
  },
  {
    id: 'performance-report',
    name: 'Performance Report',
    description: 'TWR performance vs benchmark with attribution analysis',
    icon: TrendingUp,
    format: 'PDF',
  },
  {
    id: 'transaction-history',
    name: 'Transaction History',
    description: 'All transactions filtered by date range and type',
    icon: FileSpreadsheet,
    format: 'CSV / Excel',
  },
  {
    id: 'tax-report',
    name: 'Tax Report',
    description: 'Realized gains/losses and dividend income for tax purposes',
    icon: FileText,
    format: 'PDF',
  },
  {
    id: 'fee-summary',
    name: 'Fee Summary',
    description: 'Management fees, trading costs, and other charges',
    icon: FileText,
    format: 'PDF / Excel',
  },
];

const Reports = () => {
  return (
    <AppLayout title="Reports" subtitle="Generate and export financial reports">
      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <Button variant="outline" className="border-border">
          <Calendar className="h-4 w-4 mr-2" />
          Date Range
        </Button>
        <Button variant="outline" className="border-border">
          <Filter className="h-4 w-4 mr-2" />
          Portfolio
        </Button>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className="bg-card border border-border rounded-xl p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <report.icon className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {report.format}
              </span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">{report.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <Download className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="mt-8 bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Recent Reports</h3>
        </div>
        <div className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No recent reports generated</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a report above to see it here
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
