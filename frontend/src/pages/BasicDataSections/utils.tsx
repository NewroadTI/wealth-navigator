import type React from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { SortConfig } from './types';

/**
 * Fetches all pages of data from a paginated API endpoint.
 */
export const fetchAllPages = async <T,>(
    apiBaseUrl: string,
    path: string,
    signal?: AbortSignal,
    pageSize: number = 500,
): Promise<T[]> => {
    const results: T[] = [];
    for (let skip = 0; ; skip += pageSize) {
        const response = await fetch(`${apiBaseUrl}${path}?skip=${skip}&limit=${pageSize}`, {
            signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const page = (await response.json()) as T[];
        if (!Array.isArray(page) || page.length === 0) {
            break;
        }
        results.push(...page);
        if (page.length < pageSize) {
            break;
        }
    }
    return results;
};

/**
 * Toggles sort direction for a column.
 */
export const toggleSort = (
    setSort: React.Dispatch<React.SetStateAction<SortConfig>>,
    key: string
) => {
    setSort(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
};

/**
 * Props for SortableHeader component.
 */
export interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSort: SortConfig;
    onSort: (key: string) => void;
}

/**
 * Sortable column header component.
 */
export const SortableHeader: React.FC<SortableHeaderProps> = ({
    label,
    sortKey,
    currentSort,
    onSort
}) => (
    <th
    className= "text-xs md:text-sm cursor-pointer hover:bg-muted/50 transition-colors select-none"
onClick = {() => onSort(sortKey)}
  >
    <div className="flex items-center gap-1" >
        { label }
        < ArrowUpDown className = {`h-3 w-3 ${currentSort.key === sortKey ? 'opacity-100' : 'opacity-40'}`} />
            </div>
            </th>
);
