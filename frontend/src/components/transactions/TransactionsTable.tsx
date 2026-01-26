import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

// Tipos necesarios (puedes importarlos si ya los tienes centralizados)
export interface TransactionDisplay {
  id: string;
  type: 'Trade' | 'CashJournal' | 'FX' | 'CorporateAction';
  date: string;
  data: any;
}

interface TransactionsTableProps {
  transactions: TransactionDisplay[];
  visibleColumns: string[];
  allColumns: any[]; // O el tipo ColumnDef si lo exportas
  isLoading: boolean;
  totalTransactions: number;
  pageStart: number;
  pageEnd: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Funciones helper pasadas desde el padre para renderizar datos complejos
  getColumnValue: (transaction: TransactionDisplay, key: string) => string;
  getTypeColor: (typeValue: string) => { bg: string; text: string; icon: string };
}

export const TransactionsTable = ({
  transactions,
  visibleColumns,
  allColumns,
  isLoading,
  totalTransactions,
  pageStart,
  pageEnd,
  currentPage,
  totalPages,
  onPageChange,
  getColumnValue,
  getTypeColor,
}: TransactionsTableProps) => {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 md:mb-6">
      {/* --- AQUÍ ESTÁ LA MAGIA DEL PAGINADOR SUPERIOR --- */}
      <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
        {/* Lado Izquierdo: Título */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm md:text-base">Transaction List</h3>
        </div>

        {/* Lado Derecho: Paginador Idéntico a Assets */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {isLoading
              ? 'Loading...'
              : totalTransactions === 0
              ? '0 transactions'
              : `${pageStart}-${pageEnd} of ${totalTransactions}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={isLoading || currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="hidden sm:inline">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={isLoading || currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* ------------------------------------------------ */}

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
        ) : transactions.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {visibleColumns.map((colKey) => {
                  const col = allColumns.find((c) => c.key === colKey);
                  return (
                    <th
                      key={colKey}
                      className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {col ? col.label : colKey}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-border hover:bg-muted/20 transition-colors"
                >
                  {visibleColumns.map((colKey) => (
                    <td key={`${transaction.id}-${colKey}`} className="px-4 py-3 text-xs">
                      {colKey === 'date' ? (
                        format(new Date(transaction.date), 'yyyy-MM-dd HH:mm')
                      ) : colKey === 'table_type' ? (
                        (() => {
                          const typeValue = getColumnValue(transaction, colKey);
                          const colors = getTypeColor(typeValue);
                          return (
                            <span
                              className={`inline-block px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${colors.bg} ${colors.text}`}
                            >
                              {colors.icon} {typeValue}
                            </span>
                          );
                        })()
                      ) : (
                        getColumnValue(transaction, colKey) || ''
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No transactions found for the selected filters
          </div>
        )}
      </div>
      
      {/* Opcional: Paginador inferior redundante (puedes quitarlo si solo quieres el de arriba) */}
      {transactions.length > 0 && (
         <div className="px-3 md:px-4 py-3 md:py-4 border-t border-border flex items-center justify-between sm:hidden">
            {/* Versión móvil simple si se necesita */}
             <span className="text-xs text-muted-foreground">Page {currentPage}</span>
         </div>
      )}
    </div>
  );
};