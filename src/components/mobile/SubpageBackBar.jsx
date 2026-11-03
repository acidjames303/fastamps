import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Mobile-only back control for non-primary (More) destinations.
 * Uses history when available, otherwise returns to the role home tab.
 */
export default function SubpageBackBar({ title, fallbackTo = "/" }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <div className="md:hidden sticky top-[calc(5rem+env(safe-area-inset-top,0px))] z-30 -mx-5 mb-4 border-b border-border bg-background/95 px-2 backdrop-blur-xl">
      <div className="flex h-12 items-center gap-1">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        {title ? (
          <div className="min-w-0 flex-1 truncate pr-3 text-sm font-semibold text-foreground">
            {title}
          </div>
        ) : null}
      </div>
    </div>
  );
}
