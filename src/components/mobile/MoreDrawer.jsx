import { NavLink } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export default function MoreDrawer({ open, onOpenChange, items = [], title = "More" }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="pb-safe max-h-[85dvh] md:hidden">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>Additional FastAmps Connect destinations</DrawerDescription>
        </DrawerHeader>
        <nav className="px-3 pb-6 overflow-y-auto overscroll-contain" aria-label={title}>
          <ul className="space-y-1">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  onClick={() => onOpenChange(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-foreground hover:bg-muted/70"
                    }`
                  }
                >
                  {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                  <span className="font-medium">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
