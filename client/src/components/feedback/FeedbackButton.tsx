import { useMemo, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FeedbackCategory = "bug" | "ux" | "verification" | "idea";

const categories: Array<{ id: FeedbackCategory; label: string; description: string }> = [
  { id: "bug", label: "Bug", description: "Algo falla o bloquea un flujo." },
  { id: "verification", label: "Verificación", description: "Hash, QR, prueba pública o share card." },
  { id: "ux", label: "UX", description: "Fricción visual, móvil o texto confuso." },
  { id: "idea", label: "Mejora", description: "Propuesta para la beta." },
];

export function FeedbackButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const selectedDescription = useMemo(
    () => categories.find((item) => item.id === category)?.description ?? "",
    [category],
  );

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 8) {
      toast({ title: "Añade algo más de contexto", description: "Con una frase corta no podremos reproducirlo.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await apiRequest("POST", "/api/feedback", {
        category,
        message: trimmed,
        path: `${window.location.pathname}${window.location.search}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      toast({ title: "Feedback enviado", description: "Queda registrado para la revisión de beta." });
      setMessage("");
      setOpen(false);
    } catch {
      toast({ title: "No se pudo enviar", description: "Inténtalo de nuevo en unos segundos.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-4 z-40 h-9 rounded-full border-border/70 bg-background/90 px-3 text-xs font-bold shadow-lg backdrop-blur lg:bottom-4 lg:left-5"
        data-testid="button-feedback"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Feedback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="surface-panel max-w-md rounded-lg border-border/70 p-0">
          <DialogHeader className="border-b border-border/70 px-4 py-4 text-left">
            <DialogTitle className="text-lg font-black">Feedback beta</DialogTitle>
            <DialogDescription>
              Reporta bugs, dudas de verificación o fricciones. No incluyas contraseñas ni datos sensibles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    category === item.id
                      ? "border-foreground/25 bg-foreground/[0.08] text-foreground"
                      : "border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="block text-xs font-black">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug opacity-80">{item.description}</span>
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="feedback-message" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                {selectedDescription}
              </label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1200}
                placeholder="Qué intentabas hacer, qué esperabas ver y qué ocurrió..."
                className="min-h-28 resize-none rounded-lg bg-muted/35 text-sm"
                data-testid="textarea-feedback-message"
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{message.length}/1200</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1 rounded-full font-bold" onClick={() => setOpen(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button className="h-10 flex-1 rounded-full font-black" onClick={handleSubmit} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
