import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PRESET_PACKS } from "@/lib/presetPacks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useData";
import { toast } from "@/hooks/use-toast";
import { Mail, Info, Clock, PenLine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string; job_title: string | null; avatar_initials: string | null; avatar_color: string | null };
  onSent: () => void;
}

export function InviteInterviewModal({ open, onOpenChange, employee, onSent }: Props) {
  const { profile } = useAuth();
  const { data: allRoles } = useRoles();
  const roles = allRoles?.filter(r => r.is_open && r.hiring_status !== "stable");
  const [roleId, setRoleId] = useState("");
  const [presetPack, setPresetPack] = useState("");
  const [customFocus, setCustomFocus] = useState("");
  const [message, setMessage] = useState("");
  const [expiresIn, setExpiresIn] = useState("7");
  const [sending, setSending] = useState(false);

  const selectedPack = PRESET_PACKS.find(p => p.id === presetPack);
  const selectedRole = roles?.find(r => r.id === roleId);

  const handleSend = async () => {
    if (!roleId || !presetPack || (presetPack === "custom" && !customFocus.trim())) return;
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

      const invPayload = {
        interview_id: interview.id,
        employee_id: employee.id,
        invited_by_manager: profile?.full_name || "Manager",
        target_role_id: roleId,
        status: "pending",
        message: message.trim() || null,
        preset_pack: presetPack,
        expires_at: expiresAt.toISOString(),
      };
      
      const { error: invErr, data: invData } = await supabase.from("interview_invitations" as any).insert(invPayload as any).select();
      console.log("Invitation insert result:", { invData, invErr, invPayload });
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
      <DialogContent className="max-w-[440px] p-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: employee.avatar_color || "#1c69d3" }}>
              {employee.avatar_initials}
            </div>
            <div>
              <DialogTitle className="text-sm">Invite {employee.name}</DialogTitle>
              <p className="text-[11px] text-muted-foreground">Career Assessment</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-3">
          {/* Target Role */}
          <div className="space-y-1">
            <label className="text-[12px] font-medium">Target Role <span className="text-destructive">*</span></label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select role..." /></SelectTrigger>
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
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <label className="text-[12px] font-medium">Interview Focus <span className="text-destructive">*</span></label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">The AI adapts based on responses — this is a starting direction.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_PACKS.map(pack => {
                const Icon = pack.icon;
                const selected = presetPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    onClick={() => setPresetPack(pack.id)}
                    className={`text-left p-2 rounded-md border transition-all ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}
                  >
                    <Icon className={`h-4 w-4 mb-1 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-[11px] font-semibold leading-tight">{pack.name}</p>
                  </button>
                );
              })}
              <button
                onClick={() => { setPresetPack("custom"); setCustomFocus(""); }}
                className={`text-left p-2 rounded-md border transition-all ${presetPack === "custom" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}
              >
                <PenLine className={`h-4 w-4 mb-1 ${presetPack === "custom" ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-[11px] font-semibold leading-tight">Other</p>
              </button>
            </div>
            {presetPack === "custom" && (
              <Input
                value={customFocus}
                onChange={e => setCustomFocus(e.target.value)}
                placeholder="e.g. Cross-functional collaboration"
                className="h-8 text-xs mt-1.5"
                maxLength={100}
              />
            )}
          </div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-[12px] font-medium">Message <span className="text-muted-foreground font-normal">(optional)</span></label>
              <div className="relative">
                <Textarea
                  value={message}
                  onChange={e => { if (e.target.value.length <= 200) setMessage(e.target.value); }}
                  rows={2}
                  placeholder="Short note to the employee..."
                  className="text-xs resize-none"
                />
                <span className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground">{message.length}/200</span>
              </div>
            </div>
            <div className="space-y-1 w-[110px] shrink-0">
              <label className="text-[12px] font-medium">Expires In</label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={!roleId || !presetPack || sending} className="flex-1">
              {sending ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}