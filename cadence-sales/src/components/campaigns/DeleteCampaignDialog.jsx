import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

export default function DeleteCampaignDialog({ campaign, open, onOpenChange, onConfirm, deleting }) {
  if (!campaign) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Delete target list
          </DialogTitle>
          <DialogDescription>
            Do you want to delete <span className="font-medium text-slate-900">{campaign.name}</span>?
            Companies linked to this list stay in your workspace, but the list and its grouping will be removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full border-slate-300">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting} className="rounded-full">
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}