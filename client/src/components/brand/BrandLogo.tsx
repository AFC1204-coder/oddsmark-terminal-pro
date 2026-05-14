import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme-provider";

type BrandLogoVariant = "auto" | "light" | "dark";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
}

export function BrandLogo({ variant = "auto", className, imageClassName }: BrandLogoProps) {
  const { theme } = useTheme();
  const sharedClassName = cn("block h-auto w-full object-contain", imageClassName);

  if (variant === "light") {
    return (
      <span className={cn("block", className)}>
        <img src="/brand/oddsmark-horizontal-light.png" alt="Oddsmark" className={sharedClassName} />
      </span>
    );
  }

  if (variant === "dark") {
    return (
      <span className={cn("block", className)}>
        <img src="/brand/oddsmark-horizontal-dark.png" alt="Oddsmark" className={sharedClassName} />
      </span>
    );
  }

  const src = theme === "dark"
    ? "/brand/oddsmark-horizontal-light.png"
    : "/brand/oddsmark-horizontal-dark.png";

  return (
    <span className={cn("block", className)}>
      <img src={src} alt="Oddsmark" className={sharedClassName} />
    </span>
  );
}
