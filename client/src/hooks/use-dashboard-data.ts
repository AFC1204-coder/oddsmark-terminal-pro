/**
 * useDashboardData — extracts all data fetching and mutations from the Dashboard component.
 * This reduces the Dashboard from a God Component to a view that delegates data logic.
 */
import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { betService, type BetInput } from "@/services/betService";
import { profileService } from "@/services/profileService";
import { transactionService } from "@/services/transactionService";
import { calculateBetProfit } from "@/lib/bet-calculations";
import type { Strategy, UserConfig, Transaction } from "@shared/schema";

export function useDashboardData() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();

  // ─── Queries ───
  const { data: bets = [], isLoading: betsLoading } = useQuery({
    queryKey: ["supabase-bets"],
    queryFn: () => betService.getBets(),
    enabled: !!user,
  });

  const { data: strategies = [] } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
    enabled: !!user,
  });

  const { data: config } = useQuery<UserConfig | null>({
    queryKey: ["/api/config"],
    queryFn: () => profileService.getProfile(),
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    queryFn: () => transactionService.getTransactions(),
    enabled: !!user,
  });

  // ─── Mutations ───
  const createBetMutation = useMutation({
    mutationFn: (bet: BetInput) => betService.createBet(bet),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-bets"] });
      toast({ title: "Apuesta guardada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    },
  });

  const updateBetMutation = useMutation({
    mutationFn: ({ id, bet }: { id: number | string; bet: Partial<BetInput> }) =>
      betService.updateBet(id, bet),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-bets"] });
      toast({ title: "Apuesta actualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteBetMutation = useMutation({
    mutationFn: (id: number | string) => betService.deleteBet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-bets"] });
      toast({ title: "Apuesta eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/bets", undefined, {
      headers: { "X-Confirm-Action": "soft-delete-visible-bets" },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-bets"] });
      toast({ title: "Historial limpiado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al limpiar", description: error.message, variant: "destructive" });
    },
  });

  const createStrategyMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/strategies", { name, userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Estrategia creada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear estrategia", description: error.message, variant: "destructive" });
    },
  });

  const deleteStrategyMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/strategies/${id}`, undefined, {
      headers: { "X-Confirm-Action": "delete-strategy" },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Estrategia eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar estrategia", description: error.message, variant: "destructive" });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (configData: Partial<UserConfig>) =>
      profileService.upsertProfile(configData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({ title: "Configuración guardada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar configuración", description: error.message, variant: "destructive" });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (txn: { type: "deposit" | "withdrawal"; amount: number; date: string; note?: string }) =>
      transactionService.createTransaction(txn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transacción registrada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al registrar transacción", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: number) => transactionService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transacción eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar transacción", description: error.message, variant: "destructive" });
    },
  });

  // ─── Derived data ───
  const totalDeposits = useMemo(() =>
    transactions.filter(t => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0),
  [transactions]);

  const totalWithdrawals = useMemo(() =>
    transactions.filter(t => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0),
  [transactions]);

  const currentBankroll = useMemo(() => {
    const initialCapitalEUR = config?.initialCapital ?? 0;
    const unitValue = config?.unitValue || 10;
    const profitFromBetsEUR = bets
      .reduce((sum, bet) => {
        return sum + calculateBetProfit(bet, unitValue).profit;
      }, 0);
    return initialCapitalEUR + totalDeposits - totalWithdrawals + profitFromBetsEUR;
  }, [bets, config, totalDeposits, totalWithdrawals]);

  const existingTipsters = useMemo(() =>
    Array.from(new Set(bets.map(b => b.tipster).filter(Boolean) as string[])),
  [bets]);

  return {
    // Auth
    user, authLoading, logout,
    // Data
    bets, betsLoading, strategies, config, transactions,
    // Derived
    totalDeposits, totalWithdrawals, currentBankroll, existingTipsters,
    // Mutations
    createBetMutation, updateBetMutation, deleteBetMutation, clearAllMutation,
    createStrategyMutation, deleteStrategyMutation,
    updateConfigMutation,
    createTransactionMutation, deleteTransactionMutation,
  };
}
