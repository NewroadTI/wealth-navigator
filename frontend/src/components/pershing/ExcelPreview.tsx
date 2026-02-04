/**
 * ExcelPreview Component
 * 
 * Renders a preview of Excel/CSV data in a scrollable table.
 * Uses the xlsx library to parse Excel files client-side.
 */

import { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface ExcelPreviewProps {
    data: Record<string, unknown>[];
    maxRows?: number;
    className?: string;
}

export function ExcelPreview({ data, maxRows = 10, className = '' }: ExcelPreviewProps) {
    const { headers, rows } = useMemo(() => {
        if (!data || data.length === 0) {
            return { headers: [], rows: [] };
        }

        // Get headers from first row
        const headers = Object.keys(data[0]);

        // Limit rows
        const rows = data.slice(0, maxRows);

        return { headers, rows };
    }, [data, maxRows]);

    if (headers.length === 0) {
        return (
            <div className="text-sm text-muted-foreground text-center py-4">
                No preview data available
            </div>
        );
    }

    return (
        <div className={`border rounded-lg overflow-hidden ${className}`}>
            <ScrollArea className="h-[300px]">
                <div className="inline-block min-w-full">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                            <tr>
                                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b w-10">
                                    #
                                </th>
                                {headers.slice(0, 12).map((header, idx) => (
                                    <th
                                        key={idx}
                                        className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b whitespace-nowrap"
                                    >
                                        {String(header).slice(0, 20)}
                                        {String(header).length > 20 ? '...' : ''}
                                    </th>
                                ))}
                                {headers.length > 12 && (
                                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b">
                                        +{headers.length - 12} more
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-muted/30">
                                    <td className="px-2 py-1 border-b text-muted-foreground">
                                        {rowIdx + 1}
                                    </td>
                                    {headers.slice(0, 12).map((header, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className="px-2 py-1 border-b whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis"
                                        >
                                            {String(row[header] ?? '').slice(0, 25)}
                                            {String(row[header] ?? '').length > 25 ? '...' : ''}
                                        </td>
                                    ))}
                                    {headers.length > 12 && (
                                        <td className="px-2 py-1 border-b text-muted-foreground">
                                            ...
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="px-3 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
                Showing {rows.length} of {data.length} rows • {headers.length} columns
            </div>
        </div>
    );
}
