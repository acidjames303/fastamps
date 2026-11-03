import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Mobile-friendly select that opens a bottom sheet instead of a native <select>.
 * Desktop keeps the same control for consistency with store guidelines.
 */
export default function SheetSelect({
  id,
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select",
  disabled = false,
  className = "",
  triggerClassName = "",
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  );

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted-foreground">
          {label}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || label || placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:mx-auto md:max-w-lg"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{label || placeholder}</SheetTitle>
            <SheetDescription>Choose an option</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 max-h-[55dvh] space-y-1 overflow-y-auto overscroll-contain pr-1">
            {options.map((option) => {
              const active = String(option.value) === String(value);
              return (
                <li key={String(option.value)}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange?.(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors",
                      active ? "bg-primary text-white" : "hover:bg-muted/70",
                      option.disabled && "opacity-50",
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
