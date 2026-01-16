import { Link, useLocation } from 'react-router-dom';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VisitedTabsFooter() {
  const { visitedPages } = useNavigationHistory();
  const location = useLocation();

  // Don't show if less than 2 pages visited
  if (visitedPages.length < 2) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border h-10 md:h-8 md:ml-64">
      <div className="flex items-center h-full px-2 md:px-4 gap-1 overflow-x-auto">
        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0 hidden sm:block" />
        <span className="text-xs text-muted-foreground mr-2 hidden sm:block">Recent:</span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {visitedPages.slice(0, 10).map((page, idx) => (
            <Link
              key={page.fullKey + '-' + idx}
              to={page.path + page.search}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors whitespace-nowrap flex-shrink-0",
                location.pathname === page.path && location.search === page.search
                  ? "bg-primary/20 text-primary"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={page.title}
            >
              {page.title.length > 20 ? page.title.substring(0, 20) + '...' : page.title}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
