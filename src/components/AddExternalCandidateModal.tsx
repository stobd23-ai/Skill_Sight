import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Target } from "lucide-react";

export function AddExternalCandidateModal({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { data: roles } = useRoles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setRoleId("");
    setSaving(false);
    setGeneratedCode(null);
    setRoleName("");
    setCopiedCode(false);
    setCopiedMsg(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !roleId) return;
    setSaving(true);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const role = roles?.find(r => r.id === roleId);

    const { error } = await supabase.from("external_candidates").insert({
      name: name.trim(),
      email: email.trim() || null,
      role_id: roleId,
      interview_worthy: true,
      access_code: code,
      code_expires_at: expiresAt,
      status: "invited",
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    setGeneratedCode(code);
    setRoleName(role?.title || "");
    setSaving(false);
    onCreated();
  };

  const appUrl = window.location.origin;
  const expiresDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode || "");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyMessage = () => {
    const msg = `You have been invited to complete a SkillSight career assessment interview for ${roleName} at BMW Group. Please visit ${appUrl}/interview-access and enter your access code: ${generatedCode}. This code expires on ${expiresDate}. The interview takes approximately 15-20 minutes.`;
    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[440px]">
        {!generatedCode ? (
          <>
            <DialogHeader>
              <DialogTitle>Add External Candidate</DialogTitle>
              <DialogDescription>Enter the candidate's details and select a target role to generate an interview access code.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Candidate Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria Gonzalez" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email (optional)</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. maria@example.com" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target Role *</label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {roles?.filter(r => r.is_open).map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!name.trim() || !roleId || saving}>
                  {saving ? "Generating..." : "Generate Interview Code"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-5 text-center">
            <div className="flex items-center justify-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold">Interview Code Generated</span>
            </div>

            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Candidate:</span> {name}</p>
              <p><span className="text-muted-foreground">Role:</span> {roleName}</p>
              <p><span className="text-muted-foreground">Expires:</span> {expiresDate}</p>
            </div>

            <div className="flex justify-center gap-2">
              {generatedCode?.split("").map((d, i) => (
                <div key={i} className="w-[52px] h-[60px] border-2 border-border rounded-lg flex items-center justify-center text-[28px] font-mono font-bold">
                  {d}
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              Share this with the candidate:<br />
              <span className="text-primary font-medium">{appUrl}/interview-access</span>
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={copyCode}>
                {copiedCode ? <><Check className="w-3 h-3 mr-1" />Copied ✓</> : <><Copy className="w-3 h-3 mr-1" />Copy Code</>}
              </Button>
              <Button variant="outline" size="sm" onClick={copyMessage}>
                {copiedMsg ? <><Check className="w-3 h-3 mr-1" />Copied ✓</> : <><Copy className="w-3 h-3 mr-1" />Copy Full Message</>}
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
