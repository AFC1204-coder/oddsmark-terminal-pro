import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShieldCheck, ShieldAlert, Search, Hash, CalendarClock, FileCheck, Loader2, Share2, Copy, Check, MessageCircle, Send } from "lucide-react";

interface VerificationResult {
  status: string;
  hash: string;
  isPreEvent: boolean;
  editedAfterCreation?: boolean;
  originalHash?: string | null;
  editedAt?: string | null;
  event?: string;
  market?: string;
  odds?: number;
  sport?: string;
  league?: string;
  eventDate?: string;
  eventTime?: string;
  eventTimestampUtc?: string;
  recordedAt?: string;
  timeBefore?: string;
  ots?: {
    anchored: boolean;
    anchoredAt: string | null;
    downloadUrl: string | null;
  };
}

function formatTimeDiff(registered: Date, event: Date): string {
  const diffMs = event.getTime() - registered.getTime();
  if (diffMs < 0) return "Post-evento";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h antes`;
  if (hours > 0) return `${hours}h antes`;
  return `${Math.floor(diffMs / (1000 * 60))}m antes`;
}

export default function VerifyPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [searchCode, setSearchCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const code = params.get("code");
    if (code && code.length >= 8) {
      setSearchCode(code.toUpperCase());
      setSubmittedCode(code.trim().toUpperCase());
    }
  }, [searchString]);

  const verificationQuery = useQuery<VerificationResult | null>({
    queryKey: ["/api/verify", submittedCode],
    enabled: submittedCode.length >= 8,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/verify/${encodeURIComponent(submittedCode.toLowerCase())}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("verify_failed");
      const data = await res.json();
      const recordedAt = data.recordedAt ? new Date(data.recordedAt) : null;
      const eventDt = data.eventTimestampUtc ? new Date(data.eventTimestampUtc) : null;
      const timeBefore = recordedAt && eventDt ? formatTimeDiff(recordedAt, eventDt) : undefined;

      return {
        status: data.status,
        hash: data.hash,
        isPreEvent: data.isPreEvent,
        editedAfterCreation: data.editedAfterCreation || false,
        originalHash: data.originalHash || null,
        editedAt: data.editedAt || null,
        event: data.event,
        market: data.market,
        odds: data.odds,
        sport: data.sport,
        league: data.league,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        eventTimestampUtc: data.eventTimestampUtc,
        recordedAt: data.recordedAt ? new Date(data.recordedAt).toISOString() : undefined,
        timeBefore,
        ots: data.ots || { anchored: false, anchoredAt: null, downloadUrl: null },
      };
    },
  });

  const handleVerify = () => {
    const trimmed = searchCode.trim();
    if (!trimmed || trimmed.length < 8) {
      setInputError("Introduce un código de al menos 8 caracteres.");
      setSubmittedCode("");
      return;
    }
    setInputError(null);
    setSubmittedCode(trimmed.toUpperCase());
  };

  const result = verificationQuery.data ?? null;
  const searched = submittedCode.length >= 8 || !!inputError;
  const loading = verificationQuery.isFetching;
  const error = inputError || (verificationQuery.isError ? "Error al verificar. Intenta de nuevo." : null);
  const proofUrl = typeof window !== "undefined" && submittedCode.length >= 8
    ? `${window.location.origin}/verify?code=${submittedCode}`
    : "";
  const proofText = result
    ? `${result.isPreEvent ? "Apuesta verificada pre-evento" : "Apuesta registrada post-evento"}: ${result.event || "ticket"}${result.market ? ` | ${result.market}` : ""}${result.odds ? ` @${result.odds.toFixed(2)}` : ""}`
    : "Prueba pública de Oddsmark";

  const copyProofLink = async () => {
    if (!proofUrl) return;
    await navigator.clipboard.writeText(proofUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareProof = async () => {
    if (!proofUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Prueba Oddsmark", text: proofText, url: proofUrl });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    await copyProofLink();
  };

  const openShareUrl = (baseUrl: string) => {
    if (!proofUrl) return;
    window.open(baseUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="terminal-shell min-h-screen p-4 text-foreground md:p-6">
      <div className="max-w-md mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        {/* Header */}
        <div className="text-center py-4">
          <div className="surface-panel mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-black text-foreground">Verificar apuesta</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Introduce el código del ticket para comprobar el hash público y si fue registrado antes del evento.
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="Código (ej: A3F2B1C9)"
              className="border-border/70 bg-card/70 pl-10 font-mono uppercase placeholder:text-muted-foreground/70"
            />
          </div>
          <Button onClick={handleVerify} disabled={loading} className="bg-primary px-6 text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Result */}
        {searched && !loading && !error && (
          result ? (
            <div className="space-y-3">
              {/* Status Banner */}
              <div className={`rounded-lg border p-4 ${
                result.isPreEvent
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/20"
              }`}>
                <div className="flex items-center gap-3">
                  {result.isPreEvent ? (
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <p className={`text-sm font-bold ${result.isPreEvent ? "text-emerald-500" : "text-amber-500"}`}>
                      {result.isPreEvent ? "Verificado pre-evento" : "Registrado post-evento"}
                    </p>
                    {result.timeBefore && result.isPreEvent && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Registrada <span className="text-foreground font-mono">{result.timeBefore}</span> del evento
                      </p>
                    )}
                    {!result.isPreEvent && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tiene registro público, pero no prueba previa al evento.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Edited warning */}
              {result.editedAfterCreation && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">Apuesta editada</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Esta apuesta fue modificada después de su registro original.
                    {result.editedAt && <> Editada el {new Date(result.editedAt).toLocaleString("es-ES")}.</>}
                    {result.originalHash && <> Hash original: <span className="font-mono text-muted-foreground">{result.originalHash.substring(0, 8)}</span></>}
                  </p>
                </div>
              )}

              {/* Bet Details */}
              <div className="surface-panel divide-y divide-border/70 rounded-lg">
                {result.event && <DetailRow label="Evento" value={result.event} />}
                {result.market && <DetailRow label="Mercado" value={result.market} />}
                {result.odds && <DetailRow label="Cuota" value={`@${result.odds.toFixed(2)}`} highlight />}
                {result.sport && <DetailRow label="Deporte" value={`${result.sport}${result.league ? ` — ${result.league}` : ""}`} />}
                {result.eventDate && <DetailRow label="Fecha evento" value={result.eventDate} />}
                {result.recordedAt && <DetailRow label="Registrada" value={new Date(result.recordedAt).toLocaleString("es-ES")} />}
              </div>

              {/* Hash */}
              <div className="surface-panel rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Hash SHA-256</p>
                <p className="text-[11px] font-mono text-muted-foreground break-all leading-relaxed">
                  {result.hash}
                </p>
              </div>

              <div className="surface-panel rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <FileCheck className={`w-4 h-4 mt-0.5 ${result.ots?.anchored ? "text-primary" : "text-muted-foreground/70"}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {result.ots?.anchored ? "Anclaje externo disponible" : "Anclaje externo pendiente"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Esta página prueba que el payload público coincide con el hash y si fue registrado antes del evento.
                      No prueba que la apuesta se haya cobrado ni que el resultado sea correcto.
                    </p>
                    {result.ots?.anchoredAt && (
                      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        OTS: {new Date(result.ots.anchoredAt).toLocaleString("es-ES")}
                      </p>
                    )}
                    {result.ots?.downloadUrl && (
                      <a
                        href={result.ots.downloadUrl}
                        className="inline-flex mt-2 text-[11px] font-bold text-primary hover:text-primary/80"
                      >
                        Descargar prueba .ots
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 p-3">
                  <p className="text-xs font-bold text-emerald-500 mb-1">Qué prueba</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    El hash corresponde a un payload guardado y, si aparece como pre-evento, fue registrado antes de la hora del partido.
                  </p>
                </div>
                <div className="surface-panel rounded-lg p-3">
                  <p className="text-xs font-bold text-foreground mb-1">Qué no prueba</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    No certifica que el pick se haya apostado en una casa, ni valida el resultado final. Eso pertenece al historial y settlement del tipster.
                  </p>
                </div>
              </div>

              <div className="surface-panel rounded-lg p-3">
                <p className="text-xs font-bold text-foreground mb-2">Compartir esta prueba</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={shareProof} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    Compartir
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyProofLink}>
                    {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openShareUrl(`https://wa.me/?text=${encodeURIComponent(`${proofText}\n${proofUrl}`)}`)}
                    className="text-green-400 border-green-500/20 hover:bg-green-500/10"
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openShareUrl(`https://t.me/share/url?url=${encodeURIComponent(proofUrl)}&text=${encodeURIComponent(proofText)}`)}
                    className="text-sky-400 border-sky-500/20 hover:bg-sky-500/10"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Telegram
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="surface-panel rounded-lg p-6 text-center">
              <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-bold text-muted-foreground">No encontrado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                No existe prueba pública para ese código. Revisa que el ticket incluya QR o código real.
              </p>
            </div>
          )
        )}

        {/* How it works */}
        {!searched && (
          <div className="surface-panel rounded-lg p-4">
            <h3 className="text-xs font-bold text-foreground mb-3">Cómo funciona</h3>
            <div className="space-y-3">
              {[
                "Cuando una apuesta tiene prueba pública, se guarda un hash SHA-256 con los datos y la hora de registro.",
                "Al compartir un ticket verificable, el código de 8 caracteres aparece en la imagen junto al QR.",
                "Cualquiera puede comprobar el registro pre-evento. La prueba no valida el resultado final ni el cobro.",
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-xs font-bold text-muted-foreground/70 shrink-0 w-4 text-right">{i + 1}.</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="surface-panel rounded-lg p-4 text-center">
          <p className="text-sm font-bold text-foreground">Publica apuestas con prueba previa</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Oddsmark convierte tu historial en un ledger verificable para compartir en Telegram, WhatsApp y X.
          </p>
          <Button onClick={() => setLocation("/auth")} className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
            Crear mi ledger
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-mono ${highlight ? "text-amber-400" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
