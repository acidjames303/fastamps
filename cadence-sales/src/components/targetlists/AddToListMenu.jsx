import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ListPlus, Loader2, Check } from "lucide-react";
import { assignCompaniesToList } from "@/lib/targetLists";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Reusable menu that assigns a set of company IDs to a chosen Target List.
// Used on Contacts (assign filtered companies) and Import (assign imported).
export default function AddToListMenu({ companyIds, label = "Add to list", onDone, disabled }) {
  const { user } = useAuth();
  const [lists, setLists] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const loadLists = () => base44.entities.Campaign.list("-created_date", 100).then(setLists);
  useEffect(() => { loadLists(); }, []);

  const assign = async (listId, listName) => {
    if (!companyIds || !companyIds.length) return;
    setBusy(true);
    setDone("");
    try {
      const res = await assignCompaniesToList(listId, companyIds, user.organisation_id, user.id);
      setDone(`${res.added} added to ${listName}`);
      onDone && onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || busy || !companyIds?.length} className="rounded-full border-slate-300">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListPlus className="w-4 h-4 mr-2" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
        {lists && lists.length === 0 && <DropdownMenuItem disabled>No target lists yet</DropdownMenuItem>}
        {lists && lists.map((l) => (
          <DropdownMenuItem key={l.id} className="cursor-pointer justify-start" onSelect={() => assign(l.id, l.name)}>
            {l.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
      {done && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 ml-2">
          <Check className="w-3 h-3" /> {done}
        </span>
      )}
    </DropdownMenu>
  );
}