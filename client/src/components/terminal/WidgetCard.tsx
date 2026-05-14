import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Minus } from "lucide-react";
import { useWidgets, type WidgetId } from "@/contexts/WidgetContext";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  id: WidgetId;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export function WidgetCard({ id, children, className, testId }: WidgetCardProps) {
  const { hideWidget, isVisible } = useWidgets();

  if (!isVisible(id)) {
    return null;
  }

  return (
    <Card className={cn("py-3 relative group", className)} data-testid={testId}>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-5 w-5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
        onClick={() => hideWidget(id)}
        data-testid={`button-hide-${id}`}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <CardContent className="px-4 py-0">
        {children}
      </CardContent>
    </Card>
  );
}
