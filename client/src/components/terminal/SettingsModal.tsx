import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { useTheme, themeOptions } from "@/lib/theme-provider";
import { ReferralCard } from "./ReferralCard";
import { TelegramConfig } from "./TelegramConfig";
import type { UserConfig } from "@shared/schema";

const settingsSchema = z.object({
  unitValue: z.coerce.number().min(0.01, "Valor minimo 0.01"),
  initialCapital: z.coerce.number().min(0),
  targetBankroll: z.coerce.number().min(0),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: Partial<UserConfig>) => void;
  config: UserConfig | null;
}

export function SettingsModal({ open, onClose, onSave, config }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      unitValue: config?.unitValue || 10,
      initialCapital: config?.initialCapital || 0,
      targetBankroll: config?.targetBankroll || 0,
    },
  });

  useEffect(() => {
    if (open && config) {
      form.reset({
        unitValue: config.unitValue || 10,
        initialCapital: config.initialCapital || 0,
        targetBankroll: config.targetBankroll || 0,
      });
    }
  }, [open, config, form]);

  const onSubmit = (values: SettingsFormValues) => {
    onSave(values);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] max-w-md overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <DialogTitle>Configuración</DialogTitle>
            <DialogDescription>
              Ajusta unidad, bankroll objetivo, tema visual e integraciones.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" data-testid="button-close-settings">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="unitValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    Valor de 1 unidad (€)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      className="font-mono"
                      data-testid="input-unit-value"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Para convertir unidades a dinero real
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="initialCapital"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    Capital inicial (€)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      className="font-mono"
                      data-testid="input-initial-capital"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Tu bankroll inicial para calcular el crecimiento
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetBankroll"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    Objetivo de bankroll (€)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      {...field}
                      className="font-mono"
                      data-testid="input-target-bankroll"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Meta para seguir tu progreso
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Theme Selector */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Tema Visual</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {themeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    data-testid={`button-theme-${opt.value}`}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      theme === opt.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mx-auto mb-1 ${
                      opt.value === "dark" ? "bg-zinc-800 border border-zinc-600" :
                      "bg-white border border-zinc-300"
                    }`} />
                    <span className="text-[9px] font-medium text-muted-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" data-testid="button-save-settings">
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <div className="mt-4 border-t pt-4 space-y-4">
          <TelegramConfig />
          <ReferralCard />
        </div>
      </DialogContent>
    </Dialog>
  );
}
