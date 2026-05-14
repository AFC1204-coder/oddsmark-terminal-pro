import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useToast } from "@/hooks/use-toast";
import type { BetInput } from "@/services/betService";
import { pageTransition } from "@/lib/animations";
import { calculateBetProfit } from "@/lib/bet-calculations";
import { useLocalState } from "@/hooks/use-local-state";
import { Header } from "@/components/terminal/Header";
import { BottomNavigation } from "@/components/terminal/BottomNavigation";
import { StatsSection } from "@/components/terminal/StatsSection";
import { BetFeed } from "@/components/terminal/BetFeed";
import { BetEditor } from "@/components/terminal/BetEditor";
import { ToolsModal } from "@/components/terminal/ToolsModal";
import { SettingsModal } from "@/components/terminal/SettingsModal";
import { ProfileModal } from "@/components/terminal/ProfileModal";
import { StrategiesModal } from "@/components/terminal/StrategiesModal";
import { AnalyticsModal } from "@/components/terminal/AnalyticsModal";
import { ViralTicket } from "@/components/share/ViralTicket";
import { ShareSummaryTicket } from "@/components/share/ShareSummaryTicket";
import { StreakCelebration } from "@/components/share/StreakCelebration";
import { AddWidgetModal } from "@/components/terminal/AddWidgetModal";
import { TransactionModal } from "@/components/terminal/TransactionModal";
import { WalletModal } from "@/components/terminal/WalletModal";
import { FilterModal } from "@/components/terminal/FilterModal";
import { applyFilters, defaultFilters, hasActiveFilters, type BetFilters } from "@/lib/bet-filters";
import { matchesBetSearch } from "@/lib/bet-search";
import { CommandPalette } from "@/components/terminal/CommandPalette";
import { DecisionSignalsPanel } from "@/components/terminal/DecisionSignalsPanel";
import { OnboardingWizard } from "@/components/terminal/OnboardingWizard";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { DashboardSkeleton } from "@/components/ui/skeleton-loaders";
import type { Bet, Strategy, UserConfig, InsertBet, Transaction, InsertTransaction } from "@shared/schema";

type SortOption = "createdAt" | "eventDate" | "highestProfit" | "highestStake";
type ClosureFilter = "all" | "excludeCashouts" | "onlyCashouts";

export default function Dashboard() {
  const {
    user, authLoading,
    logout,
    bets, betsLoading, strategies, config, transactions,
    totalDeposits, totalWithdrawals, currentBankroll, existingTipsters,
    createBetMutation, updateBetMutation, deleteBetMutation, clearAllMutation,
    createStrategyMutation, deleteStrategyMutation,
    updateConfigMutation,
    createTransactionMutation, deleteTransactionMutation,
  } = useDashboardData();
  const { toast } = useToast();

  const [currency, setCurrency] = useLocalState<"units" | "money">(
    "tp-currency",
    "units",
    (v): v is "units" | "money" => v === "units" || v === "money",
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<Bet | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [strategiesOpen, setStrategiesOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingBet, setSharingBet] = useState<Bet | null>(null);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<BetFilters>(defaultFilters);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("onboardingDone"));
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Data fetching and mutations handled by useDashboardData hook

  // (queries, mutations, derived data moved to useDashboardData hook)

  const handleSaveBet = (bet: InsertBet) => {
    const betInput: BetInput = {
      date: bet.date || new Date().toISOString().split("T")[0],
      sport: bet.sport || "Futbol",
      league: bet.league,
      event: bet.event || "",
      market: bet.market || "",
      odds: bet.odds || 1,
      stake: bet.stake || 0,
      status: bet.status,
      time: bet.time,
      bookie: bet.bookie,
      tipster: bet.tipster,
      betType: bet.betType,
      selections: bet.selections,
      isLive: bet.isLive ?? false,
      isCashout: bet.isCashout ?? false,
      cashoutVal: bet.cashoutVal,
      currentCashout: bet.currentCashout,
      isValue: bet.isValue ?? false,
      isParlay: bet.isParlay ?? false,
      comment: bet.comment,
      strategyId: bet.strategyId,
      closingOdds: bet.closingOdds,
      verified: bet.verified ?? false,
      isLongTerm: bet.isLongTerm ?? false,
      resolutionDate: bet.resolutionDate,
      position: bet.position,
      formation: bet.formation,
      matchSide: bet.matchSide,
      tags: bet.tags,
      marketType: bet.marketType,
    };
    
    if (editingBet) {
      updateBetMutation.mutate({ id: editingBet.id, bet: betInput });
    } else {
      createBetMutation.mutate(betInput);
    }
    setEditingBet(null);
    setDuplicateDraft(null);
  };

  const handleEditBet = (bet: Bet) => {
    setDuplicateDraft(null);
    setEditingBet(bet);
    setEditorOpen(true);
  };

  const handleDuplicateBet = (bet: Bet) => {
    const cleanSelections = Array.isArray(bet.selections)
      ? bet.selections.map((selection) => ({
          ...(selection as Record<string, unknown>),
          status: "pending",
          isCashout: false,
          cashoutVal: undefined,
          cashout_units: undefined,
          cashout_fiat: undefined,
          cashout_timestamp: undefined,
          closure_status: "standard",
        }))
      : bet.selections;

    setEditingBet(null);
    setDuplicateDraft({
      ...bet,
      id: `duplicate-${bet.id}`,
      status: "pending",
      profit: 0,
      verified: false,
      isCashout: false,
      cashoutVal: null,
      currentCashout: null,
      closingOdds: null,
      selections: cleanSelections,
      createdAt: new Date(),
    });
    setEditorOpen(true);
    toast({ title: "Apuesta duplicada como borrador" });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado al portapapeles" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const handleShare = (bet: Bet) => {
    setSharingBet(bet);
    setShareModalOpen(true);
  };

  // Current win streak for celebration prompts
  const currentWinStreak = useMemo(() => {
    const settled = bets.filter(b => b.status === "won" || b.status === "lost");
    const sorted = [...settled].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let streak = 0;
    for (const bet of sorted) {
      if (bet.status === "won") streak++;
      else break;
    }
    return streak;
  }, [bets]);

  const handleUpdateLegStatus = (betId: string, legIndex: number, status: "won" | "lost") => {
    const bet = bets.find(b => b.id === betId);
    if (!bet || !bet.selections) return;
    
    const selections = [...(bet.selections as Array<{ event: string; market: string; odds: number; line?: number; status?: string }>)];
    selections[legIndex] = { ...selections[legIndex], status };
    
    const allSettled = selections.every(s => s.status === "won" || s.status === "lost");
    const allWon = selections.every(s => s.status === "won");
    const anyLost = selections.some(s => s.status === "lost");
    
    let newBetStatus = bet.status;
    if (allSettled) {
      newBetStatus = allWon ? "won" : "lost";
    } else if (anyLost) {
      newBetStatus = "lost";
    }
    
    updateBetMutation.mutate({ 
      id: betId, 
      bet: { selections, status: newBetStatus } 
    });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("eventDate");
  const [closureFilter, setClosureFilter] = useState<ClosureFilter>("all");

  const advancedFilteredBets = useMemo(() => {
    return applyFilters(bets, advancedFilters);
  }, [bets, advancedFilters]);

  const isFiltered = hasActiveFilters(advancedFilters);

  // Earliest date of a cryptographically verified bet — drives the "from
  // here onwards, this is anchored" marker on the equity curve. `bets` (not
  // `filteredBets`) is used so the marker doesn't drift when the user filters.
  const firstVerifiedDate = useMemo<string | null>(() => {
    let earliest: string | null = null;
    for (const b of bets) {
      if (!b.verified) continue;
      const d = b.date;
      if (!d) continue;
      if (!earliest || d < earliest) earliest = d;
    }
    return earliest;
  }, [bets]);

  const filteredBets = useMemo(() => {
    return advancedFilteredBets.filter(bet => {
      if (closureFilter === "excludeCashouts" && bet.isCashout) return false;
      if (closureFilter === "onlyCashouts" && !bet.isCashout) return false;

      if (!searchQuery) return true;
      return matchesBetSearch(bet, searchQuery);
    });
  }, [advancedFilteredBets, searchQuery, closureFilter]);

  const sortedBets = useMemo(() => {
    return [...filteredBets].sort((a, b) => {
      switch (sortBy) {
        case "createdAt": {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdB - createdA;
        }
        case "highestProfit":
          return calculateBetProfit(b).profit - calculateBetProfit(a).profit;
        case "highestStake":
          return b.stake - a.stake;
        default: {
          const dateA = new Date(a.date + " " + (a.time || "00:00"));
          const dateB = new Date(b.date + " " + (b.time || "00:00"));
          return dateB.getTime() - dateA.getTime();
        }
      }
    });
  }, [filteredBets, sortBy]);

  if (authLoading || betsLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <motion.div
      className="terminal-shell min-h-screen pb-36 text-foreground lg:pb-8"
      variants={pageTransition}
      initial="initial"
      animate="animate"
    >
      <Header
        onOpenTools={() => setToolsOpen(true)}
        onOpenStrategies={() => setStrategiesOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenNewBet={() => { setEditingBet(null); setDuplicateDraft(null); setEditorOpen(true); }}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={() => void logout()}
      />

      <CommandPalette
        onNewBet={() => { setEditingBet(null); setEditorOpen(true); }}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenTools={() => setToolsOpen(true)}
        onOpenStrategies={() => setStrategiesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWallet={() => setWalletOpen(true)}
        onShareSummary={() => setSummaryOpen(true)}
      />

      <StatsSection
        bets={filteredBets}
        allBets={bets}
        config={config || null}
        currency={currency}
        onCurrencyToggle={() => setCurrency(c => c === "units" ? "money" : "units")}
        onOpenAddWidget={() => setAddWidgetOpen(true)}
        transactions={transactions}
        onOpenTransaction={() => setTransactionOpen(true)}
        onOpenWallet={() => setWalletOpen(true)}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenNewBet={() => { setEditingBet(null); setEditorOpen(true); }}
        isFiltered={isFiltered}
        firstVerifiedDate={firstVerifiedDate}
      />

      <BetFeed
        bets={sortedBets}
        totalBets={bets.length}
        currency={currency}
        unitValue={config?.unitValue || 10}
        onEdit={handleEditBet}
        onDelete={(id) => deleteBetMutation.mutate(id)}
        onCopy={handleCopy}
        onDuplicate={handleDuplicateBet}
        onShare={handleShare}
        onCreateBet={() => { setEditingBet(null); setDuplicateDraft(null); setEditorOpen(true); }}
        onClearAll={() => clearAllMutation.mutate()}
        onUpdateLegStatus={handleUpdateLegStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        closureFilter={closureFilter}
        onClosureFilterChange={setClosureFilter}
        advancedFiltersActive={isFiltered}
      />

      <DecisionSignalsPanel
        bets={filteredBets}
        allBets={bets}
        config={config || null}
        currency={currency}
        transactions={transactions}
      />

      <FeedbackButton />

      <BottomNavigation
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenNewBet={() => { setEditingBet(null); setDuplicateDraft(null); setEditorOpen(true); }}
      />

      <OnboardingWizard
        open={showOnboarding}
        onComplete={(data) => {
          updateConfigMutation.mutate({
            unitValue: data.unitValue,
            initialCapital: data.initialCapital,
            targetBankroll: data.targetBankroll,
          });
          localStorage.setItem("onboardingDone", "true");
          setShowOnboarding(false);
        }}
      />

      <BetEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingBet(null);
          setDuplicateDraft(null);
        }}
        onSave={handleSaveBet}
        editingBet={editingBet}
        initialBet={duplicateDraft}
        strategies={strategies}
        userId={user?.id || ""}
        unitValue={config?.unitValue || 10}
        existingTipsters={existingTipsters}
      />

      <ToolsModal open={toolsOpen} onClose={() => setToolsOpen(false)} />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config || null}
        onSave={(c) => updateConfigMutation.mutate(c)}
      />

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        bets={bets}
      />

      <StrategiesModal
        open={strategiesOpen}
        onClose={() => setStrategiesOpen(false)}
        strategies={strategies}
        bets={bets}
        onAdd={(name) => createStrategyMutation.mutate(name)}
        onDelete={(id) => deleteStrategyMutation.mutate(id)}
      />

      <AnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        bets={bets}
        initialCapital={config?.initialCapital || 0}
      />

      {sharingBet && (
        <ViralTicket
          bet={sharingBet}
          open={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSharingBet(null);
          }}
          currency={currency}
          unitValue={config?.unitValue || 10}
        />
      )}

      <ShareSummaryTicket
        bets={bets}
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        currency={currency}
        unitValue={config?.unitValue || 10}
      />

      <StreakCelebration
        streak={currentWinStreak}
        onShare={() => setSummaryOpen(true)}
        onDismiss={() => {}}
      />

      <AddWidgetModal
        open={addWidgetOpen}
        onClose={() => setAddWidgetOpen(false)}
      />

      <TransactionModal
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        onSave={(txn) => createTransactionMutation.mutate(txn)}
        unitValue={config?.unitValue || 10}
      />

      <WalletModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        transactions={transactions}
        onAddTransaction={() => {
          setWalletOpen(false);
          setTransactionOpen(true);
        }}
        onDeleteTransaction={(id) => deleteTransactionMutation.mutate(id)}
        totalDeposits={totalDeposits}
        totalWithdrawals={totalWithdrawals}
        currentBankroll={currentBankroll}
        currency={currency}
        unitValue={config?.unitValue || 10}
      />

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        bets={bets}
        filters={advancedFilters}
        onApply={setAdvancedFilters}
      />
    </motion.div>
  );
}
