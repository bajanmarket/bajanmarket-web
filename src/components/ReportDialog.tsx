import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TargetType = "listing" | "profile";

const REASONS: Record<TargetType, { value: string; label: string }[]> = {
  listing: [
    { value: "prohibited", label: "Prohibited or illegal item" },
    { value: "scam", label: "Scam or fraudulent listing" },
    { value: "miscategorised", label: "Wrong category or misleading" },
    { value: "duplicate", label: "Duplicate or spam" },
    { value: "offensive", label: "Offensive content" },
    { value: "other", label: "Other" },
  ],
  profile: [
    { value: "scam", label: "Scammer or fraudulent seller" },
    { value: "harassment", label: "Harassment or abusive behaviour" },
    { value: "impersonation", label: "Impersonation or fake account" },
    { value: "spam", label: "Spam" },
    { value: "offensive", label: "Offensive profile content" },
    { value: "other", label: "Other" },
  ],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: TargetType;
  targetId: string;
  redirectPath?: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId, redirectPath }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const label = targetType === "listing" ? "listing" : "seller";

  const submit = async () => {
    if (!user) {
      onOpenChange(false);
      nav({ to: "/auth", search: redirectPath ? { redirect: redirectPath } : undefined });
      return;
    }
    if (!reason) { toast.error("Please choose a reason"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error("Could not submit report"); return; }
    toast.success("Report submitted. Our team will review it.");
    setReason(""); setDetails("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this {label}</DialogTitle>
          <DialogDescription>
            Tell us what's wrong. Reports are reviewed by our moderation team and kept confidential.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="gap-2 my-2">
          {REASONS[targetType].map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label htmlFor={`reason-${r.value}`} className="text-sm font-normal cursor-pointer">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>

        <Textarea
          placeholder="Add any extra detail (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          rows={3}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !reason}>
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
