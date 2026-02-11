import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  ArrowLeftRight,
  TrendingUp,
  Settings,
  FileText,
  Building2,
  Package,
  ChevronDown,
  ChevronRight,
  Users,
  Database,
  Menu,
  X,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  children?: { name: string; href: string; icon: React.ElementType }[];
}

import { Shield, Contact } from 'lucide-react';

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Investors & Portfolios',
    icon: Users,
    children: [
      { name: 'Portfolios', href: '/portfolios', icon: Briefcase },
      { name: 'Advisors', href: '/advisors', icon: Building2 },
    ],
  },
  { name: 'Assets', href: '/assets', icon: Package },
  { name: 'Positions', href: '/positions', icon: TrendingUp },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Structured Notes', href: '/structured-notes', icon: FileSpreadsheet },
  { name: 'CRM', href: '/crm', icon: Contact },
  { name: 'Basic Data', href: '/basic-data', icon: Database },
  { name: 'Reports', href: '/reports', icon: FileText },
  {
    name: 'ETL Sync',
    icon: RefreshCw,
    children: [
      { name: 'IBKR', href: '/etl/ibkr', icon: Database },
      { name: 'Pershing', href: '/etl/pershing', icon: FileSpreadsheet },
    ],
  },
  { name: 'Admin', href: '/admin', icon: Shield },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isVisible?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isVisible = true, onToggle }: SidebarProps) {
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>(['Investors & Portfolios', 'ETL Sync']);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleSubmenu = (name: string) => {
    setOpenSubmenus((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const isSubmenuActive = (children?: { href: string }[]) => {
    if (!children) return false;
    return children.some((child) => isActive(child.href));
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo with Toggle Button */}
      <div className="flex h-14 md:h-16 items-center gap-2 md:gap-3 border-b border-sidebar-border px-4 md:px-6 relative">
        <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-base md:text-lg font-semibold text-sidebar-foreground">NewroadAI</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground">Wealth Management ERP</p>
        </div>
        {/* Desktop Toggle Button */}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex h-8 w-8 hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 md:px-3 py-3 md:py-4 overflow-y-auto">
        {navigation.map((item) => {
          if (item.children) {
            const isOpen = openSubmenus.includes(item.name);
            const hasActiveChild = isSubmenuActive(item.children);

            return (
              <Collapsible
                key={item.name}
                open={isOpen}
                onOpenChange={() => toggleSubmenu(item.name)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'flex w-full items-center justify-between gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-all duration-200',
                      hasActiveChild
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <item.icon className={cn('h-4 w-4 md:h-5 md:w-5', hasActiveChild && 'text-sidebar-primary')} />
                      {item.name}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
                    ) : (
                      <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 md:pl-6 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      to={child.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all duration-200',
                        isActive(child.href)
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <child.icon className={cn('h-3.5 w-3.5 md:h-4 md:w-4', isActive(child.href) && 'text-sidebar-primary')} />
                      {child.name}
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <Link
              key={item.name}
              to={item.href!}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-all duration-200',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('h-4 w-4 md:h-5 md:w-5', isActive(item.href) && 'text-sidebar-primary')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 md:p-4">
        <div className="flex items-center gap-2 md:gap-3 rounded-lg bg-sidebar-accent/50 px-2 md:px-3 py-2 md:py-2.5">
          <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs md:text-sm font-medium text-primary">NR</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-sidebar-foreground truncate">Newroad Admin</p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">admin@newroad.com</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-56 border-r border-sidebar-border bg-sidebar transition-transform duration-300 md:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-300",
        "hidden md:block",
        isVisible ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
