import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Wallet2, Trash2 } from "lucide-react";
import type { Transaction } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onAddTransaction: () => void;
  onDeleteTransaction?: (id: number) => void;
  totalDeposits: number;
  totalWithdrawals: number;
  currentBankroll: number;
  currency: "money" | "units";
  unitValue: number;
}

export function WalletModal({
  open,
  onClose,
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  totalDeposits,
  totalWithdrawals,
  currentBankroll,
  currency,
  unitValue,
}: WalletModalProps) {
  const formatAmount = (amount: number) => {
    if (currency === "money") {
      return `${amount.toFixed(2)}€`;
    }
    return `${(amount / unitValue).toFixed(2)}U`;
  };

  const handleDeleteTransaction = (txn: Transaction) => {
    if (!onDeleteTransaction) return;
    const label = txn.type === "deposit" ? "depósito" : "retirada";
    const confirmed = window.confirm(
      `¿Eliminar este ${label} de ${formatAmount(txn.amount)}?\n\nLa banca se recalculará sin este movimiento.`,
    );
    if (confirmed) onDeleteTransaction(txn.id);
  };

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const netFlow = totalDeposits - totalWithdrawals;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
	          <DialogTitle className="flex items-center gap-2">
	            <Wallet2 className="h-5 w-5 text-[#B0FB5D]" />
	            Mi Cartera
	          </DialogTitle>
	          <DialogDescription className="sr-only">
	            Consulta depósitos, retiradas y movimientos de banca.
	          </DialogDescription>
	        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 rounded-xl p-3 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Depósitos</p>
              <p className="text-sm font-mono text-win" data-testid="text-total-deposits">
                +{formatAmount(totalDeposits)}
              </p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Retiradas</p>
              <p className="text-sm font-mono text-loss" data-testid="text-total-withdrawals">
                -{formatAmount(totalWithdrawals)}
              </p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Flujo Neto</p>
              <p className={`text-sm font-mono ${netFlow >= 0 ? "text-win" : "text-loss"}`} data-testid="text-net-flow">
                {netFlow >= 0 ? "+" : ""}{formatAmount(netFlow)}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl p-4 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Bankroll Actual</p>
            <p className="text-2xl font-mono font-bold text-white" data-testid="text-wallet-bankroll">
              {formatAmount(currentBankroll)}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-zinc-400">Ultimos Movimientos</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={onAddTransaction}
              className="h-8"
              data-testid="button-add-transaction"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Añadir
            </Button>
          </div>

          <ScrollArea className="max-h-[200px]">
            {sortedTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-8">
                <Wallet2 className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Sin movimientos</p>
                <p className="text-xs">Añade un deposito o retirada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl group"
                    data-testid={`transaction-${txn.id}`}
                  >
                    <div className={`p-2 rounded-lg ${txn.type === "deposit" ? "bg-win/20" : "bg-loss/20"}`}>
                      {txn.type === "deposit" ? (
                        <ArrowDownToLine className="h-4 w-4 text-win" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4 text-loss" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {txn.type === "deposit" ? "Depósito" : "Retirada"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {format(new Date(txn.date), "d MMM yyyy", { locale: es })}
                        {txn.note && ` · ${txn.note}`}
                      </p>
                    </div>
                    <p className={`font-mono text-sm ${txn.type === "deposit" ? "text-win" : "text-loss"}`}>
                      {txn.type === "deposit" ? "+" : "-"}{formatAmount(txn.amount)}
                    </p>
                    {onDeleteTransaction && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteTransaction(txn)}
                        data-testid={`button-delete-transaction-${txn.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-loss" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
