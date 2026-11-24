import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ContactDeleteDialog({ contact, contacts, open, onOpenChange, onConfirm, deleting }) {
  const hasMultiple = contacts && contacts.length > 0;
  if (!contact && !hasMultiple) return null;

  const count = hasMultiple ? contacts.length : 1;
  const name = hasMultiple ? `${count} contacts` : contact.full_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Delete {count > 1 ? "contacts" : "contact"}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-medium text-slate-900">{name}</span>
            {hasMultiple ? "" : (contact.company ? ` from ${contact.company}` : "")}? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full border-slate-300">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting} className="rounded-full">
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Delete{count > 1 ? ` ${count}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}