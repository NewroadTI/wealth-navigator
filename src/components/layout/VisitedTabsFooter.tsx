import { Link, useLocation } from 'react-router-dom';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { X, Clock, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function VisitedTabsFooter() {
  const { visitedPages, savedFilters, removeSavedFilter } = useNavigationHistory();
  const location = useLocation();

  // Don't show if less than 2 pages visited
  if (visitedPages.length < 2 && savedFilters.length === 0) return null;

  const buildLink = (page: { path: string; filters?: string }) => {
    return page.filters ? `${page.path}?${page.filters}` : page.path;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border h-10 md:h-8 md:ml-64">
      <div className="flex items-center h-full px-2 md:px-4 gap-1 overflow-x-auto">
        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0 hidden sm:block" />
        <span className="text-xs text-muted-foreground mr-2 hidden sm:block">Recent:</span>
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {visitedPages.slice(0, 8).map((page) => (
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

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 flex-shrink-0"
              >
                <Bookmark className="h-3 w-3 text-accent" />
                <span className="hidden sm:inline">Saved ({savedFilters.length})</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end" side="top">
              <div className="text-xs font-medium mb-2 text-foreground">Saved Filters</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {savedFilters.map((filter) => (
                  <div
                    key={filter.timestamp}
                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/50 hover:bg-muted group"
                  >
                    <Link
                      to={buildLink(filter)}
                      className="flex-1 text-xs text-foreground truncate hover:text-primary"
                    >
                      {filter.title}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => removeSavedFilter(filter.timestamp)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </footer>
  );
}
