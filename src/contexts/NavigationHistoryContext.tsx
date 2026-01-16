import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface VisitedPage {
  path: string;
  search: string;
  title: string;
  timestamp: number;
  fullKey: string;
}

interface NavigationHistoryContextType {
  visitedPages: VisitedPage[];
  addPageWithFilters: (path: string, title: string, filterLabel?: string) => void;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/portfolios': 'Portfolios',
  '/advisors': 'Advisors',
  '/assets': 'Assets',
  '/positions': 'Positions',
  '/transactions': 'Transactions',
  '/performance': 'Performance',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/basic-data': 'Basic Data',
};

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [visitedPages, setVisitedPages] = useState<VisitedPage[]>([]);
  const location = useLocation();

  const addPageWithFilters = (path: string, title: string, filterLabel?: string) => {
    const search = location.search;
    const fullKey = filterLabel ? `${path}?${filterLabel}` : `${path}${search}`;
    const displayTitle = filterLabel ? `${title}: ${filterLabel}` : title;
    
    setVisitedPages((prev) => {
      // Remove existing entry for this exact path+filter combination
      const filtered = prev.filter((p) => p.fullKey !== fullKey);
      // Add to beginning
      const newPages = [{ path, search, title: displayTitle, timestamp: Date.now(), fullKey }, ...filtered];
      // Keep only last 15
      return newPages.slice(0, 15);
    });
  };

  useEffect(() => {
    const path = location.pathname;
    let title = pageTitles[path] || 'Page';
    
    // Handle dynamic routes
    if (path.startsWith('/portfolios/')) {
      title = 'Portfolio Detail';
    }

    // Only add basic page visit without filters on initial navigation
    addPageWithFilters(path, title);
  }, [location.pathname]);

  return (
    <NavigationHistoryContext.Provider value={{ visitedPages, addPageWithFilters }}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within NavigationHistoryProvider');
  }
  return context;
}
