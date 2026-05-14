import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useWidgets, WIDGET_REGISTRY, type WidgetId } from "@/contexts/WidgetContext";

interface AddWidgetModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddWidgetModal({ open, onClose }: AddWidgetModalProps) {
  const { isVisible, toggleWidget } = useWidgets();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gestionar widgets</DialogTitle>
          <DialogDescription>
            Activa o desactiva módulos del dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {WIDGET_REGISTRY.map((widget) => (
            <label
              key={widget.id}
              className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md"
              data-testid={`toggle-widget-${widget.id}`}
            >
              <Checkbox
                checked={isVisible(widget.id)}
                onCheckedChange={() => toggleWidget(widget.id)}
              />
              <span className="text-sm">{widget.label}</span>
              {widget.span === "full" && (
                <span className="text-xs text-muted-foreground ml-auto">(ancho completo)</span>
              )}
            </label>
          ))}
        </div>
        <Button onClick={onClose} className="w-full mt-2" data-testid="button-close-widget-modal">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
