import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface VisitedPage {
  path: string;
  title: string;
  timestamp: number;
}

interface NavigationHistoryContextType {
  visitedPages: VisitedPage[];
  addPage: (path: string, title: string) => void;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/portfolios': 'Portfolios',
  '/advisors': 'Advisors',
  '/assets': 'Assets',
  '/positions': 'Positions',
  '/transactions': 'Transactions',
  '/cash': 'Cash & FX',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/basic-data': 'Basic Data',
};

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [visitedPages, setVisitedPages] = useState<VisitedPage[]>([]);
  const location = useLocation();

  const addPage = (path: string, title: string) => {
    setVisitedPages((prev) => {
      // Remove existing entry for this path
      const filtered = prev.filter((p) => p.path !== path);
      // Add to beginning
      const newPages = [{ path, title, timestamp: Date.now() }, ...filtered];
      // Keep only last 10
      return newPages.slice(0, 10);
    });
  };

  useEffect(() => {
    const path = location.pathname;
    let title = pageTitles[path] || 'Page';
    
    // Handle dynamic routes
    if (path.startsWith('/portfolios/')) {
      title = 'Portfolio Detail';
    }

    addPage(path, title);
  }, [location.pathname]);

  return (
    <NavigationHistoryContext.Provider value={{ visitedPages, addPage }}>
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
