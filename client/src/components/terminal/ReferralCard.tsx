import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Users, Link2, Share2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function ReferralCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const referralCode = user?.id?.slice(0, 8).toUpperCase() || "TERMINAL";
  const referralUrl = `${window.location.origin}?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
	    if (navigator.share) {
	      try {
	        await navigator.share({
	          title: "Oddsmark - Historial de apuestas verificable",
	          text: "Te comparto Oddsmark para registrar apuestas, revisar el historial y verificar tickets con más transparencia.",
	          url: referralUrl,
	        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="surface-panel rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">Compartir enlace</h3>
      </div>
      <p className="mb-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
	        Invita a otros usuarios a probar Oddsmark.
      </p>

      <div className="flex gap-2 mb-3">
        <Input
          value={referralUrl}
          readOnly
          className="h-9 rounded-full border-border/70 bg-card/70 font-mono text-xs text-foreground"
        />
        <Button
          onClick={handleCopy}
          size="sm"
          variant="outline"
          className="h-9 shrink-0 rounded-full border-border/70 px-3"
          aria-label="Copiar enlace"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-win" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <Button
        onClick={handleShare}
        size="sm"
        className="h-9 w-full rounded-full bg-primary text-xs text-primary-foreground hover:bg-primary/90"
      >
        <Share2 className="w-3.5 h-3.5 mr-1.5" />
        Compartir enlace
      </Button>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Users className="w-3 h-3" />
        <span>Tu código: <span className="font-mono font-bold text-foreground">{referralCode}</span></span>
      </div>
    </div>
  );
}
