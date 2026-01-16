import { useState } from 'react';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bookmark, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SaveFilterButtonProps {
  currentPath: string;
  currentFilters: string;
  defaultTitle?: string;
  className?: string;
}

export function SaveFilterButton({ 
  currentPath, 
  currentFilters, 
  defaultTitle = 'My Filter',
  className 
}: SaveFilterButtonProps) {
  const { saveCurrentFilter } = useNavigationHistory();
  const [isOpen, setIsOpen] = useState(false);
  const [filterName, setFilterName] = useState(defaultTitle);

  const handleSave = () => {
    if (!currentFilters) {
      toast.error('No filters to save');
      return;
    }
    saveCurrentFilter(filterName || defaultTitle, currentPath, currentFilters);
    toast.success('Filter saved!');
    setIsOpen(false);
    setFilterName(defaultTitle);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`border-border h-8 md:h-9 text-xs md:text-sm ${className}`}
          disabled={!currentFilters}
        >
          <Bookmark className="h-3.5 w-3.5 mr-1.5" />
          <span className="hidden sm:inline">Save Filter</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Filter Name</label>
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Name your filter..."
              className="mt-1 h-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Save to History
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
