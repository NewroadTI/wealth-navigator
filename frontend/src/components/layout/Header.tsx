import { Bell, Search, RefreshCw, ChevronLeft, User, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada', {
      description: 'Has cerrado sesión correctamente.',
    });
    navigate('/login');
  };

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
        <NotificationsBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.full_name || 'Usuario'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
