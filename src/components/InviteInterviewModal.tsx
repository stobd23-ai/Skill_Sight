import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PRESET_PACKS } from "@/lib/presetPacks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useData";
import { toast } from "@/hooks/use-toast";
import { Mail, Info, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string; job_title: string | null; avatar_initials: string | null; avatar_color: string | null };
  onSent: () => void;
}

export function InviteInterviewModal({ open, onOpenChange, employee, onSent }: Props) {
  const { profile } = useAuth();
  const { data: roles } = useRoles();
  const [roleId, setRoleId] = useState("");
  const [presetPack, setPresetPack] = useState("");
  const [message, setMessage] = useState("");
  const [expiresIn, setExpiresIn] = useState("7");
  const [sending, setSending] = useState(false);

  const selectedPack = PRESET_PACKS.find(p => p.id === presetPack);
  const selectedRole = roles?.find(r => r.id === roleId);

  const handleSend = async () => {
    if (!roleId || !presetPack) return;
    setSending(true);
    try {
      // Create interview record
      const { data: interview, error: intErr } = await supabase.from("interviews").insert({
        employee_id: employee.id,
        target_role_id: roleId,
        interview_type: "employee",
        status: "pending",
      }).select().single();
      if (intErr) throw intErr;

      // Create invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));

      const { error: invErr } = await supabase.from("interview_invitations" as any).insert({
        interview_id: interview.id,
        employee_id: employee.id,
        invited_by_manager: profile?.full_name || "Manager",
        target_role_id: roleId,
        status: "pending",
        message: message.trim() || null,
        preset_pack: presetPack,
        expires_at: expiresAt.toISOString(),
      } as any);
      if (invErr) throw invErr;

      toast({ title: "Invitation sent", description: `${employee.name} will see it when they next log in.` });
      onOpenChange(false);
      onSent();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: employee.avatar_color || "#1c69d3" }}>
              {employee.avatar_initials}
            </div>
            <div>
              <DialogTitle className="text-base">Invite {employee.name} to Interview</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Career Assessment Invitation</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Target Role */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Target Role <span className="text-destructive">*</span></label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select the role you are assessing for..." /></SelectTrigger>
              <SelectContent>
                {roles?.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span>{r.title}</span>
                    {r.department && <Badge variant="outline" className="ml-2 text-[10px]">{r.department}</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset Pack */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[13px] font-medium">Interview Focus <span className="text-destructive">*</span></label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">This gives the AI starting inspiration — not a fixed script. The AI will adapt based on how the employee responds.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_PACKS.map(pack => {
                const Icon = pack.icon;
                const selected = presetPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    onClick={() => setPresetPack(pack.id)}
                    className={`text-left p-3 rounded-lg border transition-all ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}
                  >
                    <Icon className={`h-6 w-6 mb-1.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-[13px] font-semibold leading-tight">{pack.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{pack.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal Message */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Personal Message <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="relative">
              <Textarea
                value={message}
                onChange={e => { if (e.target.value.length <= 200) setMessage(e.target.value); }}
                rows={3}
                placeholder="Hi Thomas, this is a career development conversation — not a performance review. Just be yourself."
                className="text-sm resize-none"
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">{message.length}/200</span>
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Expires In</label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="bg-secondary rounded-lg p-4 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">The employee will see:</p>
            <div className="bg-background rounded-lg border-l-[3px] border-l-primary p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-semibold">You have a career assessment invitation</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">From {profile?.full_name || "Manager"} · Strategic Development Role</p>
              {message && <p className="text-[11px] italic text-muted-foreground mt-1.5 border-l-2 border-border pl-2">"{message}"</p>}
              {selectedPack && (
                <div className="flex items-center gap-1 mt-2">
                  <selectedPack.icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Interview Focus: {selectedPack.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSend} disabled={!roleId || !presetPack || sending} className="flex-1">
              {sending ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
