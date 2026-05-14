import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const transactionSchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().positive("La cantidad debe ser mayor a 0")
  ),
  date: z.string().min(1, "Fecha requerida"),
  note: z.string().optional(),
});

type TransactionFormValues = {
  type: "deposit" | "withdrawal";
  amount: number | undefined;
  date: string;
  note?: string;
};

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (transaction: { type: "deposit" | "withdrawal"; amount: number; date: string; note?: string }) => void;
  unitValue: number;
}

export function TransactionModal({ open, onClose, onSave, unitValue }: TransactionModalProps) {
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "deposit",
      amount: undefined,
      date: new Date().toISOString().split("T")[0],
      note: "",
    },
  });

  const watchType = form.watch("type");
  const watchAmount = form.watch("amount") ?? 0;

  const onSubmit = (values: TransactionFormValues) => {
    onSave({
      type: values.type,
      amount: values.amount!,
      date: values.date,
      note: values.note,
    });
    form.reset({
      type: "deposit",
      amount: undefined,
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    onClose();
  };

  const safeUnitValue = unitValue > 0 ? unitValue : 1;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
	          <DialogTitle className="flex items-center gap-2">
            {watchType === "deposit" ? (
              <ArrowDownToLine className="h-5 w-5 text-win" />
            ) : (
              <ArrowUpFromLine className="h-5 w-5 text-loss" />
            )}
	            {watchType === "deposit" ? "Depositar Fondos" : "Retirar Fondos"}
	          </DialogTitle>
	          <DialogDescription className="sr-only">
	            Registra un depósito o una retirada para mantener la banca actualizada.
	          </DialogDescription>
	        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Tipo de Transacción</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={field.value === "deposit" ? "default" : "outline"}
                      className={field.value === "deposit" ? "bg-win/20 text-win border-win/30" : ""}
                      onClick={() => field.onChange("deposit")}
                      data-testid="button-type-deposit"
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Depósito
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "withdrawal" ? "default" : "outline"}
                      className={field.value === "withdrawal" ? "bg-loss/20 text-loss border-loss/30" : ""}
                      onClick={() => field.onChange("withdrawal")}
                      data-testid="button-type-withdrawal"
                    >
                      <ArrowUpFromLine className="h-4 w-4 mr-2" />
                      Retirada
                    </Button>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Cantidad (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={field.value === undefined ? "" : field.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? undefined : parseFloat(val));
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      data-testid="input-transaction-amount"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    = {(watchAmount / safeUnitValue).toFixed(2)} U
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Fecha</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      data-testid="input-transaction-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Bono bienvenida, retiro mensual..."
                      className="resize-none"
                      rows={2}
                      {...field}
                      data-testid="input-transaction-note"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="flex-1"
                data-testid="button-cancel-transaction"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className={watchType === "deposit" ? "flex-1 bg-win text-win-foreground" : "flex-1 bg-loss text-loss-foreground"}
                data-testid="button-save-transaction"
              >
                {watchType === "deposit" ? "Depositar" : "Retirar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
