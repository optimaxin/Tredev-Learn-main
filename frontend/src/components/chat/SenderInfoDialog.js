import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SenderInfoDialog({ open, onOpenChange, info }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sender info — staff only</DialogTitle>
        </DialogHeader>
        {info && (
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {info.name}</div>
            <div><span className="text-muted-foreground">Email:</span> {info.email}</div>
            <div><span className="text-muted-foreground">Role:</span> {info.role}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
