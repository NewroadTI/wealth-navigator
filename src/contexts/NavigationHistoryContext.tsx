import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface VisitedPage {
  path: string;
  title: string;
  timestamp: number;
  filters?: string; // Query string or filter description
  isSaved?: boolean; // If this was manually saved by user
}

interface NavigationHistoryContextType {
  visitedPages: VisitedPage[];
  savedFilters: VisitedPage[];
  addPage: (path: string, title: string, filters?: string) => void;
  saveCurrentFilter: (title: string, path: string, filters: string) => void;
  removeSavedFilter: (timestamp: number) => void;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/portfolios': 'Portfolios',
  '/advisors': 'Advisors',
  '/assets': 'Assets',
  '/positions': 'Positions',
  '/transactions': 'Transactions',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/basic-data': 'Basic Data',
};

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [visitedPages, setVisitedPages] = useState<VisitedPage[]>([]);
  const [savedFilters, setSavedFilters] = useState<VisitedPage[]>(() => {
    const saved = localStorage.getItem('wealthroad-saved-filters');
    return saved ? JSON.parse(saved) : [];
  });
  const location = useLocation();

  const addPage = (path: string, title: string, filters?: string) => {
    setVisitedPages((prev) => {
      // Remove existing entry for this exact path+filters combination
      const key = filters ? `${path}?${filters}` : path;
      const filtered = prev.filter((p) => {
        const pKey = p.filters ? `${p.path}?${p.filters}` : p.path;
        return pKey !== key;
      });
      // Add to beginning
      const newPages = [{ path, title, timestamp: Date.now(), filters }, ...filtered];
      // Keep only last 15
      return newPages.slice(0, 15);
    });
  };

  const saveCurrentFilter = (title: string, path: string, filters: string) => {
    const newFilter: VisitedPage = {
      path,
      title,
      timestamp: Date.now(),
      filters,
      isSaved: true,
    };
    setSavedFilters((prev) => {
      const updated = [newFilter, ...prev].slice(0, 20);
      localStorage.setItem('wealthroad-saved-filters', JSON.stringify(updated));
      return updated;
    });
  };

  const removeSavedFilter = (timestamp: number) => {
    setSavedFilters((prev) => {
      const updated = prev.filter((f) => f.timestamp !== timestamp);
      localStorage.setItem('wealthroad-saved-filters', JSON.stringify(updated));
      return updated;
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
    <NavigationHistoryContext.Provider value={{ 
      visitedPages, 
      savedFilters, 
      addPage, 
      saveCurrentFilter, 
      removeSavedFilter 
    }}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    // Return a safe fallback instead of throwing
    return { 
      visitedPages: [], 
      savedFilters: [],
      addPage: () => {}, 
      saveCurrentFilter: () => {},
      removeSavedFilter: () => {},
    };
  }
  return context;
}
