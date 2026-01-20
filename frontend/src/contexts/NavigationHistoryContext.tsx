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
  '/admin': 'Admin',
  '/crm': 'CRM',
};

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  // Load saved filters from localStorage and merge with visitedPages
  const [visitedPages, setVisitedPages] = useState<VisitedPage[]>(() => {
    const saved = localStorage.getItem('wealthroad-saved-filters');
    return saved ? JSON.parse(saved) : [];
  });
  const location = useLocation();

  // Persist saved filters to localStorage whenever visitedPages changes
  useEffect(() => {
    const savedFilters = visitedPages.filter(p => p.isSaved);
    localStorage.setItem('wealthroad-saved-filters', JSON.stringify(savedFilters));
  }, [visitedPages]);

  const addPage = (path: string, title: string, filters?: string) => {
    setVisitedPages((prev) => {
      // Don't add if it's a saved filter (they stay pinned)
      const key = filters ? `${path}?${filters}` : path;
      
      // Check if this exact path+filters already exists as non-saved
      const existing = prev.find((p) => {
        const pKey = p.filters ? `${p.path}?${p.filters}` : p.path;
        return pKey === key && !p.isSaved;
      });
      
      if (existing) {
        // Move to front (after saved items)
        const savedItems = prev.filter(p => p.isSaved);
        const nonSavedItems = prev.filter(p => !p.isSaved && p !== existing);
        return [...savedItems, { ...existing, timestamp: Date.now() }, ...nonSavedItems].slice(0, 20);
      }
      
      // Add new page
      const savedItems = prev.filter(p => p.isSaved);
      const nonSavedItems = prev.filter(p => !p.isSaved);
      const newPage = { path, title, timestamp: Date.now(), filters };
      return [...savedItems, newPage, ...nonSavedItems].slice(0, 20);
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
    setVisitedPages((prev) => {
      // Add to the beginning of saved items
      const savedItems = prev.filter(p => p.isSaved);
      const nonSavedItems = prev.filter(p => !p.isSaved);
      return [newFilter, ...savedItems, ...nonSavedItems].slice(0, 20);
    });
  };

  const removeSavedFilter = (timestamp: number) => {
    setVisitedPages((prev) => prev.filter((f) => f.timestamp !== timestamp));
  };

  useEffect(() => {
    const path = location.pathname;
    let title = pageTitles[path] || 'Page';
    
    // Handle dynamic routes
    if (path.startsWith('/portfolios/') && path.includes('/performance')) {
      title = 'Portfolio Performance';
    } else if (path.startsWith('/portfolios/')) {
      title = 'Portfolio Detail';
    }

    addPage(path, title);
  }, [location.pathname]);

  return (
    <NavigationHistoryContext.Provider value={{ 
      visitedPages, 
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
      addPage: () => {}, 
      saveCurrentFilter: () => {},
      removeSavedFilter: () => {},
    };
  }
  return context;
}
