import { Bell, Search, RefreshCw, ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const isPortfolioPerformance = /^\/portfolios\/[^/]+\/performance$/.test(path);
  const isPortfolioAccount = /^\/portfolios\/[^/]+\/accounts\/[^/]+$/.test(path);
  const isPortfolioDetail = /^\/portfolios\/[^/]+$/.test(path);
  const showBackButton = isPortfolioPerformance || isPortfolioAccount || isPortfolioDetail;
  const backTarget = isPortfolioPerformance
    ? path.replace(/\/performance$/, '')
    : isPortfolioAccount
      ? path.replace(/\/accounts\/[^/]+$/, '')
      : '/portfolios';

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 md:px-6 pl-14 md:pl-6">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={() => navigate(backTarget)}
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-base md:text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search portfolios, assets..."
            className="w-48 xl:w-64 pl-9 bg-muted/50 border-border focus:bg-background"
          />
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-success">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="hidden xl:inline text-muted-foreground">Live</span>
          </div>
        </div>

        {/* Refresh */}
        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}
