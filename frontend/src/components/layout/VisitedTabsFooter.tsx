import { Link, useLocation } from 'react-router-dom';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { X, Clock, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function VisitedTabsFooter() {
  const { visitedPages, removeSavedFilter } = useNavigationHistory();
  const location = useLocation();

  // Don't show if less than 2 pages visited
  if (visitedPages.length < 2) return null;

  const buildLink = (page: { path: string; filters?: string }) => {
    return page.filters ? `${page.path}?${page.filters}` : page.path;
  };

  // Separate saved and recent pages
  const savedPages = visitedPages.filter(p => p.isSaved);
  const recentPages = visitedPages.filter(p => !p.isSaved).slice(0, 8);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border h-10 md:h-8 md:ml-64">
      <div className="flex items-center h-full px-2 md:px-4 gap-1 overflow-x-auto">
        {/* Saved Filters (pinned at start) */}
        {savedPages.length > 0 && (
          <>
            <Bookmark className="h-3 w-3 text-accent flex-shrink-0" />
            {savedPages.slice(0, 5).map((page) => (
              <div
                key={page.timestamp}
                className="flex items-center gap-0.5 flex-shrink-0 group"
              >
                <Link
                  to={buildLink(page)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs rounded-l transition-colors whitespace-nowrap",
                    "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30"
                  )}
                >
                  {page.title}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-5 p-0 rounded-l-none rounded-r bg-accent/10 border border-l-0 border-accent/30 opacity-60 hover:opacity-100 hover:bg-destructive/20"
                  onClick={() => removeSavedFilter(page.timestamp)}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
            <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />
          </>
        )}

        {/* Recent Pages */}
        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0 hidden sm:block" />
        <span className="text-xs text-muted-foreground mr-1 hidden sm:block">Recent:</span>
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {recentPages.map((page) => (
            <Link
              key={page.path + page.timestamp + (page.filters || '')}
              to={buildLink(page)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors whitespace-nowrap flex-shrink-0",
                location.pathname === page.path && !page.filters
                  ? "bg-primary/20 text-primary"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {page.title}
              {page.filters && (
                <span className="text-[10px] text-accent opacity-70">*</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
