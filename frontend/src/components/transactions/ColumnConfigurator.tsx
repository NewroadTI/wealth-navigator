import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Columns3, GripVertical, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnDef {
  key: string;
  label: string;
  tables: string[];
}

interface ColumnConfig {
  key: string;
  visible: boolean;
}

interface ColumnConfiguratorProps {
  allColumns: ColumnDef[];
  defaultVisibleColumns: string[];
  onConfigChange: (visibleColumns: string[]) => void;
  storageKey?: string; // For localStorage persistence
}

const STORAGE_PREFIX = 'transactions_column_config_';

export const ColumnConfigurator = ({
  allColumns,
  defaultVisibleColumns,
  onConfigChange,
  storageKey = 'default',
}: ColumnConfiguratorProps) => {
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Load configuration from localStorage or use defaults
  useEffect(() => {
    const fullStorageKey = `${STORAGE_PREFIX}${storageKey}`;
    const savedConfig = localStorage.getItem(fullStorageKey);
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig) as ColumnConfig[];
        // Validate and merge with allColumns (in case new columns were added)
        const existingKeys = new Set(parsed.map(c => c.key));
        const validConfig: ColumnConfig[] = [];
        
        // Add saved columns that still exist
        parsed.forEach(savedCol => {
          if (allColumns.some(c => c.key === savedCol.key)) {
            validConfig.push(savedCol);
          }
        });
        
        // Add any new columns that aren't in saved config
        allColumns.forEach(col => {
          if (!existingKeys.has(col.key)) {
            validConfig.push({
              key: col.key,
              visible: defaultVisibleColumns.includes(col.key),
            });
          }
        });
        
        setColumnConfig(validConfig);
        // Emit initial visible columns
        onConfigChange(validConfig.filter(c => c.visible).map(c => c.key));
      } catch {
        // Invalid JSON, use defaults
        initializeDefaults();
      }
    } else {
      initializeDefaults();
    }
  }, [storageKey]);

  const initializeDefaults = () => {
    const config: ColumnConfig[] = allColumns.map(col => ({
      key: col.key,
      visible: defaultVisibleColumns.includes(col.key),
    }));
    setColumnConfig(config);
    onConfigChange(config.filter(c => c.visible).map(c => c.key));
  };

  // Save to localStorage whenever config changes
  const saveConfig = useCallback((config: ColumnConfig[]) => {
    const fullStorageKey = `${STORAGE_PREFIX}${storageKey}`;
    localStorage.setItem(fullStorageKey, JSON.stringify(config));
    onConfigChange(config.filter(c => c.visible).map(c => c.key));
  }, [storageKey, onConfigChange]);

  // Toggle column visibility
  const toggleVisibility = (columnKey: string) => {
    const newConfig = columnConfig.map(c => 
      c.key === columnKey ? { ...c, visible: !c.visible } : c
    );
    setColumnConfig(newConfig);
    saveConfig(newConfig);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Add a slight delay to show the dragging state
    requestAnimationFrame(() => {
      const element = e.target as HTMLElement;
      element.classList.add('opacity-50');
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.classList.remove('opacity-50');
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDragOverIndex(null);
      return;
    }

    const newConfig = [...columnConfig];
    const [removed] = newConfig.splice(draggedIndex, 1);
    newConfig.splice(targetIndex, 0, removed);
    
    setColumnConfig(newConfig);
    saveConfig(newConfig);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const config: ColumnConfig[] = allColumns.map(col => ({
      key: col.key,
      visible: defaultVisibleColumns.includes(col.key),
    }));
    setColumnConfig(config);
    saveConfig(config);
  };

  // Show/Hide all
  const toggleAll = (show: boolean) => {
    const newConfig = columnConfig.map(c => ({ ...c, visible: show }));
    setColumnConfig(newConfig);
    saveConfig(newConfig);
  };

  const visibleCount = columnConfig.filter(c => c.visible).length;
  const getColumnLabel = (key: string) => allColumns.find(c => c.key === key)?.label || key;
  const getColumnTables = (key: string) => allColumns.find(c => c.key === key)?.tables || [];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-border h-8 md:h-9 text-xs md:text-sm">
          <Columns3 className="h-3.5 w-3.5 mr-1.5" />
          Columns ({visibleCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-sm font-medium">Configure Columns</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => toggleAll(true)}
              title="Show all columns"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => toggleAll(false)}
              title="Hide all columns"
            >
              <EyeOff className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={resetToDefaults}
              title="Reset to defaults"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Hint */}
        <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/20 border-b border-border">
          Drag to reorder • Click checkbox to show/hide
        </div>
        
        {/* Column List */}
        <div className="max-h-[400px] overflow-y-auto p-1">
          {columnConfig.map((config, index) => (
            <div
              key={config.key}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-move transition-all duration-150",
                "hover:bg-muted/50",
                draggedIndex === index && "opacity-50",
                dragOverIndex === index && "bg-primary/10 border border-primary/30"
              )}
            >
              {/* Drag Handle */}
              <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
              
              {/* Checkbox */}
              <Checkbox
                id={`col-config-${config.key}`}
                checked={config.visible}
                onCheckedChange={() => toggleVisibility(config.key)}
                className="flex-shrink-0"
              />
              
              {/* Label */}
              <Label
                htmlFor={`col-config-${config.key}`}
                className="flex-1 text-xs cursor-pointer select-none"
              >
                <span className={cn(!config.visible && "text-muted-foreground")}>
                  {getColumnLabel(config.key)}
                </span>
                <span className="text-muted-foreground/60 ml-1 text-[10px]">
                  ({getColumnTables(config.key).join(', ')})
                </span>
              </Label>
              
              {/* Position indicator */}
              <span className="text-[10px] text-muted-foreground/40 tabular-nums w-5 text-right flex-shrink-0">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          {visibleCount} of {columnConfig.length} columns visible
        </div>
      </PopoverContent>
    </Popover>
  );
};
