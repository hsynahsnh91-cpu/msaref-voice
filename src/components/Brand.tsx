import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-[26%] ring-1 ring-mint/25 shadow-[0_12px_34px_-16px_rgba(61,220,151,0.9)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image src="/app-icon.png" alt="" width={size} height={size} priority className="h-full w-full object-cover" />
    </span>
  );
}

export function Brand({ size = 56, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={size} />
      <div className="leading-tight">
        <p className="text-xl font-extrabold tracking-tight text-ink">صَرفي · Sarfi</p>
        <p className="text-xs font-medium text-faint">{subtitle}</p>
      </div>
    </div>
  );
}
