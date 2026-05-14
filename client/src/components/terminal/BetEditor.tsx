import { useForm, type FieldErrors } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Loader2, Plus, Minus, ArrowDown, X, ChevronDown, Tag, User, Check, Ban, Hourglass, Wallet2 } from "lucide-react";
import { CompetitionSelector } from "./CompetitionSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Bet, Strategy, InsertBet } from "@shared/schema";

interface Selection {
  event: string;
  market: string;
  odds: number;
  line?: number;
  status?: "pending" | "won" | "lost" | "void";
  stake?: number;
  closingOdds?: number;
  sport?: string;
  league?: string;
  isCashout?: boolean;
  cashoutVal?: number;
  cashout_units?: number;
  cashout_fiat?: number;
  cashout_timestamp?: string;
  closure_status?: "cashout" | "standard";
}

type StepInputType = "odds" | "stake" | "line" | "default";

function getSmartStep(value: number, type: StepInputType): number {
  if (type === "odds") {
    if (value < 3.00) return 0.05;
    if (value < 10.00) return 0.10;
    return 0.50;
  }
  if (type === "stake") {
    return 0.5;
  }
  if (type === "line") {
    return 0.5;
  }
  return 0.1;
}

function StepInput({ 
  value, 
  onChange, 
  min = 0, 
  step,
  stepType = "default",
  placeholder,
  testId 
}: { 
  value: number | undefined; 
  onChange: (v: number | undefined) => void; 
  min?: number; 
  step?: number;
  stepType?: StepInputType;
  placeholder?: string;
  testId: string;
}) {
  const [inputValue, setInputValue] = useState(value !== undefined ? value.toString() : "");

  useEffect(() => {
    setInputValue(value !== undefined ? value.toString() : "");
  }, [value]);

  const currentVal = value ?? min;
  const getStep = () => step ?? getSmartStep(currentVal, stepType);

  const decrement = () => {
    const currentStep = getStep();
    const newVal = Math.round((currentVal - currentStep) * 100) / 100;
    const clamped = Math.max(min, newVal);
    onChange(clamped);
    setInputValue(clamped.toString());
  };
  
  const increment = () => {
    const currentStep = getStep();
    const startVal = value ?? (min > 0 ? min : 0);
    const newVal = Math.round((startVal + currentStep) * 100) / 100;
    onChange(newVal);
    setInputValue(newVal.toString());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    if (raw === "") {
      onChange(undefined);
    }
  };

  const handleBlur = () => {
    if (inputValue === "") {
      return;
    }
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      setInputValue("");
      onChange(undefined);
    } else {
      const clamped = Math.max(min, parsed);
      onChange(clamped);
      setInputValue(clamped.toString());
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={decrement}
        data-testid={`${testId}-minus`}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="font-mono text-center flex-1 min-w-0 h-9 text-sm px-1"
        data-testid={testId}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={increment}
        data-testid={`${testId}-plus`}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

const sports = ["Futbol", "Basket", "Tenis", "Otros"];

const defaultBookies = ["Bet365", "Winamax", "Betfair", "William Hill", "Kirolbet", "Bwin", "Pokerstars", "Codere"];

function getBookies(): string[] {
  try {
    const custom = localStorage.getItem("customBookies");
    if (custom) return [...defaultBookies, ...JSON.parse(custom)];
  } catch {}
  return defaultBookies;
}

function addCustomBookie(name: string) {
  try {
    const custom = JSON.parse(localStorage.getItem("customBookies") || "[]");
    if (!custom.includes(name) && !defaultBookies.includes(name)) {
      custom.push(name);
      localStorage.setItem("customBookies", JSON.stringify(custom));
    }
  } catch {}
}

const footballLeagues = [
  "La Liga", "La Liga 2", "Premier League", "Championship",
  "Serie A", "Serie B", "Bundesliga", "Ligue 1",
  "Champions League", "Europa League", "Conference League",
  "Copa del Rey", "FA Cup", "Copa Libertadores", "Copa del Mundo"
];

const otherLeagues: Record<string, string[]> = {
  Basket: ["NBA", "Euroliga", "ACB", "FIBA"],
  Tenis: ["ATP", "WTA", "Grand Slam", "Davis Cup"],
  Otros: ["NFL", "NHL", "MLB", "UFC", "Boxeo", "E-Sports"],
};

const betTypes = [
  { value: "simple", label: "Simple", icon: null },
  { value: "combinada", label: "Combinada", icon: null },
  { value: "escalera", label: "Escalera", icon: null },
] as const;

const footballMarketTypes = {
  main: ["1x2", "Hándicap", "Over/Under", "BTTS", "Corners"],
  props: ["Tiros", "Tiros Puerta", "Pases", "Entradas", "Faltas", "Asistencias"],
};

const basketballMarketTypes = {
  main: ["Ganador", "Hándicap", "Total puntos", "Total equipo", "1ª Mitad", "1º Cuarto", "Margen victoria"],
  props: ["Puntos jugador", "Rebotes", "Asistencias", "Triples", "PRA", "Robos", "Tapones", "Pérdidas"],
};

const tennisMarketTypes = {
  main: ["Ganador partido", "Ganador set", "Hándicap juegos", "Hándicap sets", "Total juegos", "Total sets", "Tie-break", "Resultado exacto"],
  props: ["Aces", "Doble faltas", "Breaks", "Juegos al saque", "1er set", "Set betting"],
};

function getMarketTypesForSport(sport?: string) {
  if (sport === "Basket") return basketballMarketTypes;
  if (sport === "Tenis") return tennisMarketTypes;
  return footballMarketTypes;
}

const positions = ["PT", "DFC", "LI", "LD", "CAD", "CAI", "MCD", "MC", "MCO", "EI", "ED", "SD", "DC"];
const formations = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "3-4-3"];
const matchSides = ["Local", "Visitante"];

const sportContextFields = {
  Futbol: {
    position: { label: "Posición", options: positions },
    formation: { label: "Formación", options: formations },
    matchSide: { label: "Condición", options: matchSides },
  },
  Tenis: {
    position: { label: "Superficie", options: ["Tierra", "Pista dura", "Hierba", "Indoor hard", "Moqueta"] },
    formation: { label: "Formato", options: ["Individual", "Dobles", "Mejor de 3", "Mejor de 5"] },
    matchSide: { label: "Circuito", options: ["ATP", "WTA", "Challenger", "Grand Slam", "Exhibición"] },
  },
  Basket: {
    position: { label: "Posición", options: ["Base", "Escolta", "Alero", "Ala-pívot", "Pívot"] },
    formation: { label: "Contexto", options: ["Pace alto", "Pace medio", "Pace bajo", "Back-to-back", "Descanso"] },
    matchSide: { label: "Condición", options: ["Local", "Visitante", "Neutral", "Regular season", "Playoffs"] },
  },
} as const;

function getSportContextFields(sport?: string) {
  if (sport === "Tenis") return sportContextFields.Tenis;
  if (sport === "Basket") return sportContextFields.Basket;
  return sportContextFields.Futbol;
}

const ENABLE_TICKET_SCAN = false;

const betFormSchema = z.object({
  sport: z.string().min(1),
  league: z.string().min(1, "Selecciona una competición"),
  event: z.string().optional().default(""),
  market: z.string().optional().default(""),
  odds: z.coerce.number().min(1.01, "Cuota mínima 1.01"),
  stake: z.coerce.number().min(0.1, "Stake mínimo 0.1"),
  date: z.string().optional().default(""),
  time: z.string().min(1, "Introduce la hora del evento"),
  bookie: z.string().optional(),
  tipster: z.string().optional(),
  betType: z.enum(["simple", "combinada", "escalera"]).default("simple"),
  selections: z.array(z.object({
    event: z.string(),
    market: z.string(),
    odds: z.number(),
    line: z.number().optional(),
    status: z.enum(["pending", "won", "lost", "void"]).optional(),
    stake: z.number().optional(),
    sport: z.string().optional(),
    league: z.string().optional(),
    isCashout: z.boolean().optional(),
    cashoutVal: z.number().optional(),
    cashout_units: z.number().optional(),
    cashout_fiat: z.number().optional(),
    cashout_timestamp: z.string().optional(),
    closure_status: z.enum(["cashout", "standard"]).optional(),
  })).optional(),
  isLive: z.boolean().default(false),
  isCashout: z.boolean().default(false),
  cashoutVal: z.coerce.number().optional(),
  isValue: z.boolean().default(false),
  isParlay: z.boolean().default(false),
  comment: z.string().optional(),
  strategyId: z.coerce.number().optional(),
  status: z.enum(["pending", "won", "lost", "void"]).default("pending"),
  marketType: z.string().optional(),
  tags: z.string().optional(),
  position: z.string().optional(),
  formation: z.string().optional(),
  matchSide: z.string().optional(),
  closingOdds: z.coerce.number().optional(),
  isLongTerm: z.boolean().default(false),
  resolutionDate: z.string().optional(),
  currentCashout: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
  if (data.betType === "simple") return;

  const selections = data.selections ?? [];
  const label = data.betType === "combinada" ? "selecciones" : "peldaños";
  if (selections.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selections"],
      message: `Añade al menos 2 ${label}.`,
    });
    return;
  }

  selections.forEach((selection, index) => {
    if (!selection.event?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index, "event"],
        message: "Evento requerido.",
      });
    }
    if (!selection.market?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index, "market"],
        message: "Mercado requerido.",
      });
    }
    if (!Number.isFinite(selection.odds) || selection.odds < 1.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index, "odds"],
        message: "Cuota mínima 1.01.",
      });
    }
    if (data.betType === "escalera" && (!Number.isFinite(selection.stake) || (selection.stake ?? 0) < 0.1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index, "stake"],
        message: "Stake mínimo 0.1U.",
      });
    }
  });
}).refine((data) => {
  if (data.betType === "simple") {
    return data.event && data.event.length > 0 && data.market && data.market.length > 0;
  }
  return true;
}, { message: "Introduce el evento y mercado", path: ["event"] }).refine((data) => {
  if (!data.isLongTerm && (!data.date || data.date.length === 0)) {
    return false;
  }
  return true;
}, { message: "Selecciona una fecha del evento", path: ["date"] }).refine((data) => {
  if (data.isLongTerm && (!data.resolutionDate || data.resolutionDate.length === 0)) {
    return false;
  }
  return true;
}, { message: "Las apuestas a largo plazo requieren fecha de resolución", path: ["resolutionDate"] });

type BetFormValues = z.infer<typeof betFormSchema>;

const toDateInputValue = (value?: string | null): string => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const spanishMonthMatch = value.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñÑ.]+)/);
  if (spanishMonthMatch) {
    const monthMap: Record<string, string> = {
      ene: "01", enero: "01",
      feb: "02", febrero: "02",
      mar: "03", marzo: "03",
      abr: "04", abril: "04",
      may: "05", mayo: "05",
      jun: "06", junio: "06",
      jul: "07", julio: "07",
      ago: "08", agosto: "08",
      sep: "09", sept: "09", septiembre: "09",
      oct: "10", octubre: "10",
      nov: "11", noviembre: "11",
      dic: "12", diciembre: "12",
    };
    const day = spanishMonthMatch[1].padStart(2, "0");
    const monthKey = spanishMonthMatch[2].replace(".", "").toLowerCase();
    const month = monthMap[monthKey];
    if (month) return `${new Date().getFullYear()}-${month}-${day}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
};

interface BetEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (bet: InsertBet) => void;
  editingBet?: Bet | null;
  initialBet?: Bet | null;
  strategies: Strategy[];
  userId: string;
  unitValue?: number;
  existingTipsters?: string[];
}

function getDefaultValues(editingBet?: Bet | null): BetFormValues {
  return {
    sport: editingBet?.sport || "Futbol",
    league: editingBet?.league || "",
    event: editingBet?.event || "",
    market: editingBet?.market || "",
    odds: editingBet?.odds || 1.5,
    stake: editingBet?.stake || 1,
    date: toDateInputValue(editingBet?.date) || new Date().toISOString().split("T")[0],
    time: editingBet?.time || "",
    bookie: editingBet?.bookie || "",
    tipster: editingBet?.tipster || "",
    betType: (editingBet?.betType as "simple" | "combinada" | "escalera") || "simple",
    selections: (editingBet?.selections as Selection[]) || [],
    isLive: editingBet?.isLive || false,
    isCashout: editingBet?.isCashout || false,
    cashoutVal: editingBet?.cashoutVal || undefined,
    isValue: editingBet?.isValue || false,
    isParlay: editingBet?.isParlay || false,
    comment: editingBet?.comment || "",
    strategyId: editingBet?.strategyId || undefined,
    status: (editingBet?.status as "pending" | "won" | "lost" | "void") || "pending",
    marketType: editingBet?.marketType || "",
    tags: editingBet?.tags || "",
    position: editingBet?.position || "",
    formation: editingBet?.formation || "",
    matchSide: editingBet?.matchSide || "",
    closingOdds: editingBet?.closingOdds || undefined,
    isLongTerm: editingBet?.isLongTerm || false,
    resolutionDate: toDateInputValue(editingBet?.resolutionDate),
    currentCashout: editingBet?.currentCashout || undefined,
  };
}

export function BetEditor({ open, onClose, onSave, editingBet, initialBet, strategies, userId, unitValue = 10, existingTipsters = [] }: BetEditorProps) {
  const isMobile = useIsMobile();
  const sourceBet = editingBet ?? initialBet ?? null;
  const form = useForm<BetFormValues>({
    resolver: zodResolver(betFormSchema),
    defaultValues: getDefaultValues(sourceBet),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tipsterInput, setTipsterInput] = useState("");
  const [showTipsterSuggestions, setShowTipsterSuggestions] = useState(false);
  const [activeSelectionIdx, setActiveSelectionIdx] = useState<number | null>(null);
  const { toast } = useToast();
  
  const filteredTipsters = existingTipsters.filter(t => 
    t.toLowerCase().includes(tipsterInput.toLowerCase()) && t !== tipsterInput
  );

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(sourceBet));
      setTipsterInput(sourceBet?.tipster || "");
      // Opciones avanzadas cerradas por defecto (Divulgación Progresiva)
      setAdvancedOpen(false);
    }
  }, [open, sourceBet, form]);

  const watchIsCashout = form.watch("isCashout");
  const watchBetType = form.watch("betType");
  const watchSelectionsRaw = form.watch("selections");
  const watchSelections = Array.isArray(watchSelectionsRaw) ? watchSelectionsRaw : [];
  const watchIsLongTerm = form.watch("isLongTerm");
  const watchStatus = form.watch("status");
  const watchSport = form.watch("sport");
  const marketTypes = getMarketTypesForSport(watchSport);
  const sportContext = getSportContextFields(watchSport);

  useEffect(() => {
    if (open && sourceBet?.selections) {
      form.setValue("selections", sourceBet.selections as Selection[]);
    } else if (open) {
      form.setValue("selections", []);
    }
  }, [open, sourceBet, form]);

  useEffect(() => {
    if (!open) return;
    const selectedMarketType = form.getValues("marketType");
    if (!selectedMarketType) return;

    const allowedMarketTypes = [...marketTypes.main, ...marketTypes.props];
    if (!allowedMarketTypes.includes(selectedMarketType)) {
      form.setValue("marketType", "");
    }
  }, [form, marketTypes, open, watchSport]);

  useEffect(() => {
    if (!open) return;

    const contextValues = [
      ["position", sportContext.position.options],
      ["formation", sportContext.formation.options],
      ["matchSide", sportContext.matchSide.options],
    ] as const;

    contextValues.forEach(([fieldName, options]) => {
      const currentValue = form.getValues(fieldName);
      if (currentValue && !(options as readonly string[]).includes(currentValue)) {
        form.setValue(fieldName, "");
      }
    });
  }, [form, open, sportContext, watchSport]);

  const addSelection = () => {
    const betType = form.getValues("betType");
    const currentSport = form.getValues("sport") || "Futbol";
    const currentLeague = form.getValues("league") || "";
    let newSelection: Selection = { 
      event: "", 
      market: "", 
      odds: 1.5, 
      status: "pending",
      sport: currentSport,
      league: currentLeague,
    };
    
    if (betType === "escalera") {
      if (watchSelections.length > 0) {
        const lastSelection = watchSelections[watchSelections.length - 1];
        newSelection = {
          event: lastSelection.event || "",
          market: lastSelection.market || "",
          odds: lastSelection.odds || 1.5,
          line: (lastSelection.line || 0) + 0.5,
          status: "pending",
          stake: undefined,
          sport: lastSelection.sport || currentSport,
          league: lastSelection.league || currentLeague,
        };
      } else {
        newSelection.stake = undefined;
      }
    } else if (betType === "combinada" && watchSelections.length > 0) {
      const lastSelection = watchSelections[watchSelections.length - 1];
      newSelection.sport = lastSelection.sport || currentSport;
      newSelection.league = lastSelection.league || currentLeague;
    }
    
    const newSelections = [...watchSelections, newSelection];
    form.setValue("selections", newSelections);
  };

  const removeSelection = (index: number) => {
    const newSelections = watchSelections.filter((_: Selection, i: number) => i !== index);
    form.setValue("selections", newSelections);
  };

  const updateSelection = (index: number, field: keyof Selection, value: string | number | boolean | undefined) => {
    const updated = [...watchSelections];
    updated[index] = { ...updated[index], [field]: value };
    form.setValue("selections", updated);
    if (field === "market" || field === "event") {
      setActiveSelectionIdx(index);
    }
  };

  const handleChipClick = (type: string, field: { value: string | undefined; onChange: (v: string) => void }) => {
    const currentValue = field.value || "";
    const newValue = currentValue === type ? "" : type;
    field.onChange(newValue);
    
    // Auto-fill market input based on bet type
    if (newValue) {
      if (watchBetType === "simple") {
        form.setValue("market", newValue);
      } else if ((watchBetType === "combinada" || watchBetType === "escalera") && watchSelections.length > 0) {
        // Fill the active selection or the last one
        const targetIdx = activeSelectionIdx !== null && activeSelectionIdx < watchSelections.length 
          ? activeSelectionIdx 
          : watchSelections.length - 1;
        updateSelection(targetIdx, "market", newValue);
      }
    }
  };

  const totalOdds = watchSelections.length > 0 
    ? watchSelections.reduce((acc: number, s: Selection) => acc * (s.odds || 1), 1) 
    : form.watch("odds");

  const handleScanTicket = (file: File) => {
    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        
        const response = await apiRequest("POST", "/api/scan-ticket", { image: base64 });

        const data = await response.json();
        
        form.setValue("sport", data.deporte || "Futbol");
        form.setValue("league", data.competicion || "");
        form.setValue("event", data.evento || "");
        form.setValue("market", data.mercado || "");
        form.setValue("odds", data.cuota || 1.5);
        form.setValue("stake", data.stake || 1);
        form.setValue("date", data.fecha || new Date().toISOString().split("T")[0]);

        toast({
          title: "Ticket escaneado",
          description: "Los datos se han rellenado automáticamente",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo analizar el ticket",
          variant: "destructive",
        });
      } finally {
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "No se pudo leer el archivo",
        variant: "destructive",
      });
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (values: BetFormValues) => {
    const formSelections = values.selections || [];
    const useSelections = values.betType !== "simple" && formSelections.length > 0;
    const calculatedOdds = useSelections 
      ? formSelections.reduce((acc, s) => acc * (s.odds || 1), 1) 
      : values.odds;
    
    let finalStatus = values.status;
    if (values.isCashout && values.cashoutVal !== undefined) {
      const cashoutProfit = values.cashoutVal - values.stake;
      finalStatus = cashoutProfit >= 0 ? "won" : "lost";
    }

    const eventValue = useSelections && formSelections[0] 
      ? formSelections.map(s => s.event).join(" + ")
      : values.event || "";
    const marketValue = useSelections && formSelections[0]
      ? formSelections.map(s => s.market).join(" + ")
      : values.market || "";
    
    const bet: InsertBet = {
      ...values,
      userId,
      event: eventValue,
      market: marketValue,
      odds: Math.round(calculatedOdds * 100) / 100,
      betType: values.betType,
      selections: useSelections ? formSelections : null,
      status: finalStatus,
      time: values.time || null,
      bookie: values.bookie || null,
      tipster: values.tipster || null,
      comment: values.comment || null,
      cashoutVal: values.isCashout ? values.cashoutVal : null,
      strategyId: values.strategyId || null,
      position: values.position || null,
      formation: values.formation || null,
      matchSide: values.matchSide || null,
      marketType: values.marketType || null,
      tags: values.tags || null,
      player: null,
      isSubstitute: false,
      isParlay: values.betType === "combinada",
    };
    onSave(bet);
    onClose();
  };

  const onInvalid = (errors: FieldErrors<BetFormValues>) => {
    if (errors.resolutionDate) {
      setAdvancedOpen(true);
    }
    if (errors.selections) {
      toast({
        title: watchBetType === "combinada" ? "Revisa la combinada" : "Revisa la escalera",
        description: watchBetType === "combinada"
          ? "Añade al menos dos selecciones con evento, mercado y cuota."
          : "Añade al menos dos peldaños con evento, mercado, cuota y stake.",
        variant: "destructive",
      });
    }
    if (errors.time) {
      toast({
        title: "Hora del evento requerida",
        description: "Es necesaria para verificar que la apuesta se registró antes del inicio.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-h-[92dvh] overflow-x-hidden overflow-y-auto p-4 sm:p-6",
        isMobile ? "w-[calc(100vw-1rem)] max-w-none" : "max-w-lg",
      )}>
        <DialogHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DialogTitle>
            {editingBet ? "Editar apuesta" : initialBet ? "Duplicar apuesta" : "Nueva apuesta"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registra evento, mercado, cuota, stake y hora local para crear una apuesta verificable.
          </DialogDescription>
          {!editingBet && ENABLE_TICKET_SCAN && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleScanTicket(file);
                  }
                }}
                data-testid="input-scan-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-scan-ticket"
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                {isScanning ? "Escaneando..." : "Escanear"}
              </Button>
            </div>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="min-w-0 space-y-4 overflow-x-hidden">
            {/* ========== ZONA VISIBLE: Inputs principales ========== */}
            
            <FormField
              control={form.control}
              name="betType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Tipo de apuesta</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {betTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            field.onChange(type.value);
                            if (type.value === "simple") {
                              form.setValue("selections", []);
                            }
                          }}
                          className={cn(
                            "flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center text-xs font-medium transition-all sm:px-3 sm:text-sm",
                            field.value === type.value
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-muted text-muted-foreground border-border opacity-60"
                          )}
                          data-testid={`button-type-${type.value}`}
                        >
                          {type.label}
                        </button>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            {watchBetType !== "simple" && (
              <div className={cn(
                "space-y-3 p-3 rounded-md border",
                watchBetType === "combinada" ? "bg-blue-500/5 border-blue-500/30" : "bg-amber-500/5 border-amber-500/30"
              )}>
                  <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {watchBetType === "combinada"
                      ? `Selecciones (${watchSelections.length})`
                      : `Peldaños (${watchSelections.length})`}
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addSelection}
                    data-testid="button-add-selection"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Añadir
                  </Button>
                </div>

                {watchSelections.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {watchBetType === "combinada" 
                      ? "Añade al menos dos selecciones a tu combinada"
                      : "Añade al menos dos peldaños a tu escalera"}
                  </p>
                )}

                <div className="space-y-2">
                  {watchSelections.map((sel: Selection, idx: number) => {
                    const selSport = sel.sport || "Futbol";
                    const selLeagues = selSport === "Futbol" ? footballLeagues : otherLeagues[selSport] || [];
                    
                    return (
                    <div key={idx} className="relative">
                      {watchBetType === "escalera" && idx > 0 && (
                        <div className="flex justify-center -mt-1 mb-1">
                          <ArrowDown className="h-4 w-4 text-amber-400" />
                        </div>
                      )}
                      <div className={cn(
                        "p-2 rounded border bg-background/50 space-y-2",
                        watchBetType === "escalera" && "border-l-2 border-l-amber-400"
                      )}>
                        {watchBetType === "combinada" && (
                          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border/50">
                            <Select 
                              value={sel.sport || "Futbol"} 
                              onValueChange={(v) => {
                                updateSelection(idx, "sport", v);
                                updateSelection(idx, "league", "");
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs" data-testid={`select-selection-sport-${idx}`}>
                                <SelectValue placeholder="Deporte" />
                              </SelectTrigger>
                              <SelectContent>
                                {sports.map((sport) => (
                                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="relative group">
                              <input
                                value={sel.league || ""}
                                onChange={(e) => updateSelection(idx, "league", e.target.value)}
                                list={`selection-leagues-${idx}`}
                                placeholder="Competición"
                                autoComplete="off"
                                className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded-lg px-2 text-xs text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-[#B0FB5D] transition-all appearance-none"
                                data-testid={`input-selection-league-${idx}`}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-white transition-colors">
                                <ChevronDown size={12} />
                              </div>
                              <datalist id={`selection-leagues-${idx}`}>
                                {selLeagues.map((league) => (
                                  <option key={league} value={league} />
                                ))}
                              </datalist>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          {watchBetType === "escalera" && (
                            <span className="text-xs font-mono text-amber-400 shrink-0">
                              #{idx + 1}
                            </span>
                          )}
                          <Input
                            placeholder="Evento"
                            value={sel.event}
                            onChange={(e) => updateSelection(idx, "event", e.target.value)}
                            onFocus={() => setActiveSelectionIdx(idx)}
                            className="text-sm h-8"
                            data-testid={`input-selection-event-${idx}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeSelection(idx)}
                            data-testid={`button-remove-selection-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className={cn(
                          "grid gap-2",
                          watchBetType === "escalera" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
                        )}>
                          <Input
                            placeholder="Mercado"
                            value={sel.market}
                            onChange={(e) => updateSelection(idx, "market", e.target.value)}
                            onFocus={() => setActiveSelectionIdx(idx)}
                            className="text-sm h-8"
                            data-testid={`input-selection-market-${idx}`}
                          />
                          {watchBetType === "escalera" && (
                            <div>
                              <StepInput
                                value={sel.line}
                                onChange={(v) => updateSelection(idx, "line", v)}
                                min={-100}
                                stepType="line"
                                placeholder="Línea"
                                testId={`input-selection-line-${idx}`}
                              />
                            </div>
                          )}
                          <div>
                            <StepInput
                              value={sel.odds || undefined}
                              onChange={(v) => updateSelection(idx, "odds", v ?? 1.01)}
                              min={1.01}
                              stepType="odds"
                              placeholder="Cuota"
                              testId={`input-selection-odds-${idx}`}
                            />
                          </div>
                        </div>
                        {watchBetType === "escalera" && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => updateSelection(idx, "status", sel.status === "won" ? "pending" : "won")}
                                className={cn(
                                  "h-9 w-9 rounded flex items-center justify-center border",
                                  sel.status === "won" 
                                    ? "bg-win/20 border-win text-win" 
                                    : "bg-muted/30 border-border text-muted-foreground"
                                )}
                                data-testid={`button-step-won-${idx}`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSelection(idx, "status", sel.status === "lost" ? "pending" : "lost")}
                                className={cn(
                                  "h-9 w-9 rounded flex items-center justify-center border",
                                  sel.status === "lost" 
                                    ? "bg-loss/20 border-loss text-loss" 
                                    : "bg-muted/30 border-border text-muted-foreground"
                                )}
                                data-testid={`button-step-lost-${idx}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSelection(idx, "status", sel.status === "void" ? "pending" : "void")}
                                className={cn(
                                  "h-9 w-9 rounded flex items-center justify-center border",
                                  sel.status === "void" 
                                    ? "bg-muted border-muted-foreground text-muted-foreground" 
                                    : "bg-muted/30 border-border text-muted-foreground"
                                )}
                                data-testid={`button-step-void-${idx}`}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex-1">
                              <StepInput
                                value={sel.stake}
                                onChange={(v) => updateSelection(idx, "stake", v)}
                                min={0.1}
                                stepType="stake"
                                placeholder="Stake"
                                testId={`input-step-stake-${idx}`}
                              />
                            </div>
                          </div>
                        )}
                        {watchBetType === "escalera" && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`cashout-${idx}`}
                                checked={sel.isCashout || false}
                                onCheckedChange={(checked) => {
                                  const isChecked = !!checked;
                                  const updated = [...watchSelections];
                                  if (!isChecked) {
                                    updated[idx] = { 
                                      ...updated[idx], 
                                      isCashout: false,
                                      cashoutVal: undefined,
                                      cashout_units: undefined,
                                      cashout_fiat: undefined,
                                      cashout_timestamp: undefined,
                                      closure_status: undefined 
                                    };
                                  } else {
                                    updated[idx] = { 
                                      ...updated[idx], 
                                      isCashout: true,
                                      closure_status: "cashout",
                                      cashout_timestamp: new Date().toISOString()
                                    };
                                  }
                                  form.setValue("selections", updated);
                                }}
                                className="h-3.5 w-3.5"
                                data-testid={`checkbox-step-cashout-${idx}`}
                              />
                              <label 
                                htmlFor={`cashout-${idx}`} 
                                className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                              >
                                <Wallet2 className="h-3 w-3" />
                                <span>Cashout</span>
                              </label>
                            </div>
                            {sel.isCashout === true && (
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">U</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    value={sel.cashout_units ?? sel.cashoutVal ?? ""}
                                    onChange={(e) => {
                                      const units = e.target.value ? parseFloat(e.target.value) : undefined;
                                      const safeUnitValue = unitValue > 0 ? unitValue : 1;
                                      const fiat = units !== undefined ? Math.round(units * safeUnitValue * 100) / 100 : undefined;
                                      updateSelection(idx, "cashout_units", units);
                                      updateSelection(idx, "cashout_fiat", fiat);
                                      updateSelection(idx, "cashoutVal", units);
                                    }}
                                    className={cn(
                                      "h-7 text-xs w-20",
                                      (sel.cashout_units ?? sel.cashoutVal) !== undefined && sel.stake !== undefined && (
                                        (sel.cashout_units ?? sel.cashoutVal ?? 0) > sel.stake 
                                          ? "border-win-cashout bg-win-cashout/10" 
                                          : (sel.cashout_units ?? sel.cashoutVal ?? 0) < sel.stake 
                                            ? "border-loss-cashout bg-loss-cashout/10" 
                                            : ""
                                      )
                                    )}
                                    data-testid={`input-step-cashout-units-${idx}`}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">€</span>
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="0"
                                    value={sel.cashout_fiat ?? (sel.cashoutVal !== undefined ? Math.round(sel.cashoutVal * (unitValue > 0 ? unitValue : 1) * 100) / 100 : "")}
                                    onChange={(e) => {
                                      const fiat = e.target.value ? parseFloat(e.target.value) : undefined;
                                      const safeUnitValue = unitValue > 0 ? unitValue : 1;
                                      const units = fiat !== undefined ? Math.round((fiat / safeUnitValue) * 100) / 100 : undefined;
                                      updateSelection(idx, "cashout_fiat", fiat);
                                      updateSelection(idx, "cashout_units", units);
                                      updateSelection(idx, "cashoutVal", units);
                                    }}
                                    className={cn(
                                      "h-7 text-xs w-20",
                                      sel.cashout_fiat !== undefined && sel.stake !== undefined && (
                                        (sel.cashout_fiat / (unitValue > 0 ? unitValue : 1)) > sel.stake 
                                          ? "border-win-cashout bg-win-cashout/10" 
                                          : (sel.cashout_fiat / (unitValue > 0 ? unitValue : 1)) < sel.stake 
                                            ? "border-loss-cashout bg-loss-cashout/10" 
                                            : ""
                                      )
                                    )}
                                    data-testid={`input-step-cashout-fiat-${idx}`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {watchSelections.length > 0 && watchBetType === "combinada" && (
                  <div className="flex justify-between items-center pt-2 border-t text-sm">
                    <span className="text-muted-foreground">Cuota total:</span>
                    <span className="font-mono font-semibold text-primary">
                      {totalOdds.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {watchBetType === "simple" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="sport"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Deporte</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-sport">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sports.map((sport) => (
                              <SelectItem key={sport} value={sport}>
                                {sport}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="league"
                    render={({ field }) => {
                      const currentSport = form.watch("sport");
                      return (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Competición</FormLabel>
                          <FormControl>
                            <CompetitionSelector
                              value={field.value}
                              onChange={field.onChange}
                              sport={currentSport}
                              testId="input-league"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="event"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Evento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Madrid vs Barcelona" {...field} data-testid="input-event" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="market"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Mercado</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: +2.5 Goles" {...field} data-testid="input-market" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          Fecha {watchIsLongTerm && <span className="text-muted-foreground/60">(opcional)</span>}
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Hora local</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {watchBetType === "simple" && (
                <FormField
                  control={form.control}
                  name="odds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Cuota</FormLabel>
                      <FormControl>
                        <StepInput
                          value={field.value}
                          onChange={field.onChange}
                          min={1.01}
                          stepType="odds"
                          testId="input-odds"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {watchBetType !== "escalera" && (
                <FormField
                  control={form.control}
                  name="stake"
                  render={({ field }) => (
                    <FormItem className={watchBetType !== "simple" ? "col-span-2" : ""}>
                      <FormLabel className="text-xs text-muted-foreground">Stake (U)</FormLabel>
                      <FormControl>
                        <StepInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0.1}
                          stepType="stake"
                          testId="input-stake"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* EV Calculator + Implied Probability */}
            {watchBetType === "simple" && form.watch("odds") > 1 && (
              <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Prob. implícita</span>
                  <span className="font-mono font-bold text-foreground">
                    {(100 / form.watch("odds")).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Ganancia potencial</span>
                  <span className="font-mono font-bold text-win">
                    +{((form.watch("odds") - 1) * (form.watch("stake") || 0)).toFixed(2)}U
                  </span>
                </div>
                {form.watch("isValue") && (
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/50">
                    <span className="text-amber-400 font-medium">EV+ Value Bet</span>
                    <span className="font-mono font-bold text-amber-400">
                      {((1 / form.watch("odds")) * 100).toFixed(0)}% para breakeven
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-6 py-2 border-y flex-wrap">
              <FormField
                control={form.control}
                name="isLive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-live" />
                    <Label className="text-sm">En vivo</Label>
                  </div>
                )}
              />
              {watchBetType === "simple" && (
                <FormField
                  control={form.control}
                  name="isLongTerm"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (!checked) {
                            form.setValue("resolutionDate", "");
                          }
                        }} 
                        data-testid="switch-long-term" 
                      />
                      <div className="flex items-center gap-1">
                        <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-sm">Largo plazo</Label>
                      </div>
                    </div>
                  )}
                />
              )}
            </div>

            {watchIsLongTerm && watchBetType === "simple" && (
              <FormField
                control={form.control}
                name="resolutionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground flex items-center gap-1">
                      <Hourglass className="h-3 w-3" />
                      Fecha de resolución
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        className="text-sm"
                        data-testid="input-resolution-date"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Fecha estimada de resolución (requerido)</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchBetType !== "escalera" && (
            <div className={cn(
              "p-3 rounded-md border transition-all",
              watchIsCashout ? "bg-amber-500/10 border-amber-500/40" : "bg-muted/30"
            )}>
              <FormField
                control={form.control}
                name="isCashout"
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-cashout" />
                      <Label className="text-sm font-medium">Cierre anticipado / Cashout</Label>
                    </div>
                  </div>
                )}
              />

              {watchIsCashout && (
                <FormField
                  control={form.control}
                  name="cashoutVal"
                  render={({ field }) => {
                    const cashoutUnits = field.value || 0;
                    const safeUnitValue = unitValue > 0 ? unitValue : 1;
                    const cashoutEuros = cashoutUnits * safeUnitValue;
                    const profit = cashoutUnits - form.watch("stake");

                    const handleUnitsChange = (val: number | undefined) => {
                      field.onChange(val ?? 0);
                    };

                    const handleEurosChange = (val: number | undefined) => {
                      const safeUnitValue = unitValue > 0 ? unitValue : 1;
                      const unitsFromEuros = (val ?? 0) / safeUnitValue;
                      field.onChange(Math.round(unitsFromEuros * 100) / 100);
                    };

                    return (
                      <FormItem className="mt-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <FormLabel className="text-xs text-muted-foreground">Cobrado (U)</FormLabel>
                            <FormControl>
                              <StepInput
                                value={field.value || 0}
                                onChange={handleUnitsChange}
                                min={0}
                                step={0.5}
                                testId="input-cashout-units"
                              />
                            </FormControl>
                          </div>
                          <div>
                            <FormLabel className="text-xs text-muted-foreground">Equivalente (€)</FormLabel>
                            <FormControl>
                              <StepInput
                                value={parseFloat(cashoutEuros.toFixed(2))}
                                onChange={handleEurosChange}
                                min={0}
                                step={1}
                                testId="input-cashout-euros"
                              />
                            </FormControl>
                          </div>
                        </div>
                        <p className={cn(
                          "text-xs mt-2 font-mono",
                          profit >= 0 ? "text-win" : "text-loss"
                        )}>
                          P&L: {profit >= 0 ? "+" : ""}{profit.toFixed(2)}U = {profit >= 0 ? "+" : ""}{(profit * safeUnitValue).toFixed(0)}€
                        </p>
                      </FormItem>
                    );
                  }}
                />
              )}
            </div>
            )}

            {watchBetType !== "escalera" && !watchIsCashout && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Estado</FormLabel>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {[
                        { value: "won", label: "Ganada", color: "bg-win/20 border-win text-win" },
                        { value: "lost", label: "Perdida", color: "bg-loss/20 border-loss text-loss" },
                        { value: "void", label: "Anulada", color: "bg-muted border-muted-foreground text-muted-foreground" },
                        { value: "pending", label: "Pendiente", color: "bg-pending/20 border-pending text-pending" },
                      ].map((status) => (
                        <button
                          key={status.value}
                          type="button"
                          onClick={() => field.onChange(status.value)}
                          className={cn(
                            "py-2 text-center text-sm font-medium rounded-md border",
                            field.value === status.value
                              ? status.color
                              : "bg-muted text-muted-foreground border-border opacity-50"
                          )}
                          data-testid={`button-status-${status.value}`}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            )}

            {watchIsCashout && watchBetType !== "escalera" && (
              <div className="p-3 rounded-md border border-cashout/30 bg-cashout/5">
                <p className="text-xs text-muted-foreground mb-1">Estado automático:</p>
                <p className={cn(
                  "text-sm font-medium",
                  (form.watch("cashoutVal") || 0) > form.watch("stake") ? "text-win" : 
                  (form.watch("cashoutVal") || 0) < form.watch("stake") ? "text-loss" : "text-muted-foreground"
                )}>
                  {(form.watch("cashoutVal") || 0) > form.watch("stake") ? "GANADA (Cashout)" : 
                   (form.watch("cashoutVal") || 0) < form.watch("stake") ? "PERDIDA (Cashout)" : "VOID (Cashout)"}
                </p>
              </div>
            )}

            {watchStatus === "pending" && !watchIsCashout && (
              <FormField
                control={form.control}
                name="currentCashout"
                render={({ field }) => {
                  const currentCashoutUnits = field.value || 0;
                  const stake = form.watch("stake") || 0;
                  const potentialProfit = currentCashoutUnits - stake;

                  return (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Valor Cashout Actual (informativo)
                      </FormLabel>
                      <FormControl>
                        <StepInput
                          value={field.value}
                          onChange={(val) => field.onChange(val ?? undefined)}
                          min={0}
                          step={0.5}
                          placeholder="Ej: 0.85"
                          testId="input-current-cashout"
                        />
                      </FormControl>
                      {currentCashoutUnits > 0 && (
                        <p className={cn(
                          "text-xs font-mono",
                          potentialProfit >= 0 ? "text-cashout" : "text-loss"
                        )}>
                          Potencial: {potentialProfit >= 0 ? "+" : ""}{potentialProfit.toFixed(2)}U
                        </p>
                      )}
                    </FormItem>
                  );
                }}
              />
            )}

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full flex items-center justify-between gap-2 py-2 text-muted-foreground"
                  data-testid="button-advanced-options"
                >
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Opciones avanzadas
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="min-w-0 space-y-4 pt-3">
                {/* Casa de Apuestas */}
                <FormField
                  control={form.control}
                  name="bookie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Casa de apuestas</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bookie">
                            <SelectValue placeholder="Seleccionar casa..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getBookies().map((bookie) => (
                            <SelectItem key={bookie} value={bookie}>
                              {bookie}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {/* Estrategia */}
                {strategies.length > 0 && (
                  <FormField
                    control={form.control}
                    name="strategyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Estrategia</FormLabel>
                        <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-strategy">
                              <SelectValue placeholder="Seleccionar estrategia..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {strategies.map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                )}

                {/* Tipo de Mercado */}
                <FormField
                  control={form.control}
                  name="marketType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Tipo de mercado</FormLabel>
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                          Mercados principales
                        </p>
                        <div className="flex min-w-0 flex-wrap gap-1.5 pb-1">
                          {marketTypes.main.map((type) => (
                            <Badge
                              key={type}
                              variant={field.value === type ? "default" : "outline"}
                              className={cn(
                                "h-auto max-w-full cursor-pointer whitespace-normal px-2 py-1 text-[11px] leading-tight transition-all",
                                field.value === type && "bg-primary text-primary-foreground"
                              )}
                              onClick={() => handleChipClick(type, field)}
                              data-testid={`chip-market-${type}`}
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                          Props y derivados
                        </p>
                        <div className="flex min-w-0 flex-wrap gap-1.5 pb-1">
                          {marketTypes.props.map((type) => (
                            <Badge
                              key={type}
                              variant={field.value === type ? "default" : "outline"}
                              className={cn(
                                "h-auto max-w-full cursor-pointer whitespace-normal px-2 py-1 text-[11px] leading-tight transition-all",
                                field.value === type && "bg-primary text-primary-foreground"
                              )}
                              onClick={() => handleChipClick(type, field)}
                              data-testid={`chip-market-${type}`}
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Tipster */}
                <FormField
                  control={form.control}
                  name="tipster"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Tipster
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="Nombre del tipster..."
                            value={tipsterInput || field.value || ""}
                            onChange={(e) => {
                              setTipsterInput(e.target.value);
                              field.onChange(e.target.value);
                              setShowTipsterSuggestions(true);
                            }}
                            onFocus={() => setShowTipsterSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowTipsterSuggestions(false), 200)}
                            data-testid="input-tipster"
                          />
                          {showTipsterSuggestions && filteredTipsters.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-popover border rounded-md shadow-lg mt-1 max-h-32 overflow-auto">
                              {filteredTipsters.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover-elevate"
                                  onClick={() => {
                                    field.onChange(t);
                                    setTipsterInput(t);
                                    setShowTipsterSuggestions(false);
                                  }}
                                  data-testid={`tipster-suggestion-${t}`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Etiquetas</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Value, Estrategia A, etc..."
                          {...field}
                          data-testid="input-tags"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Separa con comas</p>
                    </FormItem>
                  )}
                />

                <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel className="block truncate text-xs text-muted-foreground">{sportContext.position.label}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 w-full min-w-0 px-2 text-xs" data-testid="select-position">
                              <SelectValue placeholder="..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sportContext.position.options.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="formation"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel className="block truncate text-xs text-muted-foreground">{sportContext.formation.label}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 w-full min-w-0 px-2 text-xs" data-testid="select-formation">
                              <SelectValue placeholder="..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sportContext.formation.options.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="matchSide"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel className="block truncate text-xs text-muted-foreground">{sportContext.matchSide.label}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 w-full min-w-0 px-2 text-xs" data-testid="select-match-side">
                              <SelectValue placeholder="..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sportContext.matchSide.options.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {watchBetType !== "escalera" && (
                  <FormField
                    control={form.control}
                    name="closingOdds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Cuota Cierre (CLV)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Ej: 1.85"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            data-testid="input-closing-odds"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Cuota al cierre del mercado</p>
                      </FormItem>
                    )}
                  />
                )}

                {watchBetType === "escalera" && watchSelections.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">CLV por peldaño</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(watchSelections as Selection[]).map((sel: Selection, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-amber-400 shrink-0 w-10">CLV {idx + 1}</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Ej: 1.85"
                            value={sel.closingOdds || ""}
                            onChange={(e) => updateSelection(idx, "closingOdds", e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="h-8 text-sm"
                            data-testid={`input-clv-step-${idx}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Cuota al cierre de cada peldaño</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Comentario</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas opcionales..." {...field} className="resize-none" data-testid="input-comment" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-3 backdrop-blur sm:-mx-6 sm:px-6">
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                  Cancelar
                </Button>
                <Button type="submit" data-testid="button-save">
                  Guardar
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
