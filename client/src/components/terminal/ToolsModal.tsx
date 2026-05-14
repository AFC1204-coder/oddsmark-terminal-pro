import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, Percent, ArrowLeftRight, ArrowLeft, Target } from "lucide-react";
import { PoissonCalculator } from "./PoissonCalculator";

interface ToolsModalProps {
  open: boolean;
  onClose: () => void;
}

type ToolType = "kelly" | "hedge" | "vig" | "poisson" | null;

export function ToolsModal({ open, onClose }: ToolsModalProps) {
  const [activeTool, setActiveTool] = useState<ToolType>(null);

  const [kellyOdds, setKellyOdds] = useState("");
  const [kellyProb, setKellyProb] = useState("");
  const [kellyResult, setKellyResult] = useState("");

  const [hedgeStake, setHedgeStake] = useState("");
  const [hedgeOdds1, setHedgeOdds1] = useState("");
  const [hedgeOdds2, setHedgeOdds2] = useState("");
  const [hedgeResult, setHedgeResult] = useState("");

  const [vig1, setVig1] = useState("");
  const [vigX, setVigX] = useState("");
  const [vig2, setVig2] = useState("");
  const [vigResult, setVigResult] = useState("");

  const calculateKelly = () => {
    const o = parseFloat(kellyOdds);
    const p = parseFloat(kellyProb) / 100;
    if (o && p && o > 1) {
      const kelly = ((o * p - 1) / (o - 1)) * 100;
      setKellyResult(kelly.toFixed(2) + "%");
    }
  };

  const calculateHedge = () => {
    const s = parseFloat(hedgeStake);
    const o1 = parseFloat(hedgeOdds1);
    const o2 = parseFloat(hedgeOdds2);
    if (s && o1 && o2 && o2 > 1) {
      const hedge = (s * o1) / o2;
      const profit1 = s * o1 - s - hedge;
      const profit2 = hedge * o2 - hedge - s;
      setHedgeResult(`${hedge.toFixed(2)} U (Profit: ${Math.min(profit1, profit2).toFixed(2)})`);
    }
  };

  const calculateVig = () => {
    const v1 = parseFloat(vig1);
    const vx = parseFloat(vigX) || 0;
    const v2 = parseFloat(vig2);
    if (v1 && v2) {
      const vig = (1/v1 + 1/v2 + (vx ? 1/vx : 0)) * 100 - 100;
      setVigResult(vig.toFixed(2) + "%");
    }
  };

  const tools = [
    { id: "poisson" as ToolType, name: "Calculadora de Valor", icon: Target, desc: "Probabilidades Poisson" },
    { id: "kelly" as ToolType, name: "Kelly Criterion", icon: Calculator, desc: "Calcula el stake óptimo" },
    { id: "hedge" as ToolType, name: "Cobertura", icon: ArrowLeftRight, desc: "Calcula coberturas" },
    { id: "vig" as ToolType, name: "Vigorish", icon: Percent, desc: "Calcula el margen" },
  ];

  const renderToolContent = () => {
    switch (activeTool) {
      case "kelly":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cuota</Label>
              <Input
                type="number"
                step="0.01"
                value={kellyOdds}
                onChange={(e) => setKellyOdds(e.target.value)}
                placeholder="Ej: 2.50"
                className="font-mono"
                data-testid="input-kelly-odds"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Probabilidad (%)</Label>
              <Input
                type="number"
                step="1"
                value={kellyProb}
                onChange={(e) => setKellyProb(e.target.value)}
                placeholder="Ej: 50"
                className="font-mono"
                data-testid="input-kelly-prob"
              />
            </div>
            <Button
              onClick={calculateKelly}
              className="w-full"
              data-testid="button-calculate-kelly"
            >
              Calcular
            </Button>
            {kellyResult && (
              <Card className="py-4" data-testid="result-kelly">
                <CardContent className="px-4 py-0 text-center">
                  <p className="text-2xl font-mono font-semibold text-win">{kellyResult}</p>
                  <p className="text-xs text-muted-foreground mt-1">Stake recomendado del bankroll</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "hedge":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Stake Original (U)</Label>
              <Input
                type="number"
                step="0.1"
                value={hedgeStake}
                onChange={(e) => setHedgeStake(e.target.value)}
                placeholder="Ej: 10"
                className="font-mono"
                data-testid="input-hedge-stake"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cuota 1</Label>
              <Input
                type="number"
                step="0.01"
                value={hedgeOdds1}
                onChange={(e) => setHedgeOdds1(e.target.value)}
                placeholder="Ej: 2.00"
                className="font-mono"
                data-testid="input-hedge-odds1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cuota 2 (Cobertura)</Label>
              <Input
                type="number"
                step="0.01"
                value={hedgeOdds2}
                onChange={(e) => setHedgeOdds2(e.target.value)}
                placeholder="Ej: 2.10"
                className="font-mono"
                data-testid="input-hedge-odds2"
              />
            </div>
            <Button
              onClick={calculateHedge}
              className="w-full"
              data-testid="button-calculate-hedge"
            >
              Calcular
            </Button>
            {hedgeResult && (
              <Card className="py-4" data-testid="result-hedge">
                <CardContent className="px-4 py-0 text-center">
                  <p className="text-xl font-mono font-semibold text-cashout">{hedgeResult}</p>
                  <p className="text-xs text-muted-foreground mt-1">Stake para cobertura</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "vig":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cuota 1</Label>
              <Input
                type="number"
                step="0.01"
                value={vig1}
                onChange={(e) => setVig1(e.target.value)}
                placeholder="Ej: 1.90"
                className="font-mono"
                data-testid="input-vig-1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cuota X (Opcional)</Label>
              <Input
                type="number"
                step="0.01"
                value={vigX}
                onChange={(e) => setVigX(e.target.value)}
                placeholder="Ej: 3.50"
                className="font-mono"
                data-testid="input-vig-x"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cuota 2</Label>
              <Input
                type="number"
                step="0.01"
                value={vig2}
                onChange={(e) => setVig2(e.target.value)}
                placeholder="Ej: 2.00"
                className="font-mono"
                data-testid="input-vig-2"
              />
            </div>
            <Button
              onClick={calculateVig}
              className="w-full"
              data-testid="button-calculate-vig"
            >
              Calcular
            </Button>
            {vigResult && (
              <Card className="py-4" data-testid="result-vig">
                <CardContent className="px-4 py-0 text-center">
                  <p className="text-2xl font-mono font-semibold">{vigResult}</p>
                  <p className="text-xs text-muted-foreground mt-1">Margen de la casa</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "poisson":
        return <PoissonCalculator />;

      default:
        return (
          <div className="grid grid-cols-1 gap-3">
            {tools.map((tool) => (
              <Card
                key={tool.id}
                className="py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setActiveTool(tool.id)}
                data-testid={`button-tool-${tool.id}`}
              >
                <CardContent className="px-4 py-0 flex items-center gap-4">
                  <tool.icon className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-sm text-muted-foreground">{tool.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activeTool && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveTool(null)}
                data-testid="button-tools-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {activeTool ? tools.find(t => t.id === activeTool)?.name : "Herramientas"}
          </DialogTitle>
          <DialogDescription>
            Calculadoras auxiliares para gestión de stake, cuotas y mercados.
          </DialogDescription>
        </DialogHeader>
        {renderToolContent()}
      </DialogContent>
    </Dialog>
  );
}
