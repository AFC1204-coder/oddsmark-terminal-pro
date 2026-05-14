import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function calcMatchProbs(homeExpected: number, awayExpected: number) {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      const prob = poissonProbability(h, homeExpected) * poissonProbability(a, awayExpected);
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;
    }
  }

  return {
    homeWin: homeWin * 100,
    draw: draw * 100,
    awayWin: awayWin * 100,
  };
}

function calcOverUnder(lambda: number, line: number) {
  let under = 0;
  const maxK = Math.floor(line);

  for (let k = 0; k <= maxK; k++) {
    under += poissonProbability(k, lambda);
  }

  const over = 1 - under;
  return {
    over: over * 100,
    under: under * 100,
  };
}

export function PoissonCalculator() {
  const [homeExpected, setHomeExpected] = useState(1.5);
  const [awayExpected, setAwayExpected] = useState(1.2);
  const [lambda, setLambda] = useState(2.5);
  const [line, setLine] = useState(2.5);

  const matchProbs = useMemo(() => calcMatchProbs(homeExpected, awayExpected), [homeExpected, awayExpected]);
  const overUnder = useMemo(() => calcOverUnder(lambda, line), [lambda, line]);

  return (
    <Tabs defaultValue="match" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="match" data-testid="tab-match">Match / 1X2</TabsTrigger>
            <TabsTrigger value="props" data-testid="tab-props">Props / Líneas</TabsTrigger>
          </TabsList>

          <TabsContent value="match" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Expectativa Local</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={homeExpected}
                  onChange={(e) => setHomeExpected(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  data-testid="input-home-expected"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Expectativa Visitante</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={awayExpected}
                  onChange={(e) => setAwayExpected(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  data-testid="input-away-expected"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <Card className={cn("py-3", matchProbs.homeWin > 40 && "border-win")}>
                <CardContent className="px-3 py-0 text-center">
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="text-xl font-mono font-semibold text-win">
                    {matchProbs.homeWin.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    @{matchProbs.homeWin > 0.5 ? (100 / matchProbs.homeWin).toFixed(2) : "-"}
                  </p>
                </CardContent>
              </Card>
              <Card className={cn("py-3", matchProbs.draw > 30 && "border-pending")}>
                <CardContent className="px-3 py-0 text-center">
                  <p className="text-xs text-muted-foreground">Empate</p>
                  <p className="text-xl font-mono font-semibold text-pending">
                    {matchProbs.draw.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    @{matchProbs.draw > 0.5 ? (100 / matchProbs.draw).toFixed(2) : "-"}
                  </p>
                </CardContent>
              </Card>
              <Card className={cn("py-3", matchProbs.awayWin > 40 && "border-loss")}>
                <CardContent className="px-3 py-0 text-center">
                  <p className="text-xs text-muted-foreground">Visitante</p>
                  <p className="text-xl font-mono font-semibold text-loss">
                    {matchProbs.awayWin.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    @{matchProbs.awayWin > 0.5 ? (100 / matchProbs.awayWin).toFixed(2) : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="props" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Media Esperada (Lambda)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={lambda}
                  onChange={(e) => setLambda(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  data-testid="input-lambda"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Linea de la Casa</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={line}
                  onChange={(e) => setLine(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  data-testid="input-line"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Card className="py-4">
                <CardContent className="px-4 py-0 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Over {line}</p>
                  <p className="text-2xl font-mono font-semibold text-win">
                    {overUnder.over.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    Cuota Justa: @{overUnder.over > 0.5 ? (100 / overUnder.over).toFixed(2) : "-"}
                  </p>
                </CardContent>
              </Card>
              <Card className="py-4">
                <CardContent className="px-4 py-0 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Under {line}</p>
                  <p className="text-2xl font-mono font-semibold text-loss">
                    {overUnder.under.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    Cuota Justa: @{overUnder.under > 0.5 ? (100 / overUnder.under).toFixed(2) : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
    </Tabs>
  );
}
