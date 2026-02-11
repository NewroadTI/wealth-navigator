import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { VisitedTabsFooter } from './VisitedTabsFooter';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const SIDEBAR_STORAGE_KEY = 'wealthroad_sidebar_visible';

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const toggleSidebar = () => {
    setSidebarVisible(prev => {
      const newValue = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue));
      return newValue;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isVisible={sidebarVisible} onToggle={toggleSidebar} />
      <div className={cn(
        "transition-all duration-300",
        sidebarVisible ? "md:ml-64" : "md:ml-0"
      )}>
        <Header title={title} subtitle={subtitle} />
        
        {/* Show Menu Button - appears when sidebar is hidden */}
        {!sidebarVisible && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex fixed top-4 left-4 z-50 h-9 w-9 bg-background/80 backdrop-blur-sm border border-border hover:bg-accent"
            onClick={toggleSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        
        <main className="p-3 md:p-6 pb-16 md:pb-12">{children}</main>
      </div>
      <VisitedTabsFooter />
    </div>
  );
}
