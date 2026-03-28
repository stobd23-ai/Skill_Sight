import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useRoles, useAlgorithmResults } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Eye, X, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SkillBadge } from "@/components/SkillBadge";
import type { SkillVector } from "@/lib/algorithms";

interface SkillReq { name: string; required: number; weight: number | string }

const hiringStatusConfig: Record<string, { dot: string; label: string; labelColor: string }> = {
  actively_hiring: { dot: '#dc3545', label: 'Actively Hiring', labelColor: '#dc3545' },
  internal_development: { dot: '#1c69d3', label: 'Internal Development', labelColor: '#1c69d3' },
  stable: { dot: '#22c55e', label: 'Stable — Filled', labelColor: '#6e6e73' },
};

export default function RolesPage() {
  const { data: roles, refetch } = useRoles();
  const { data: allResults } = useAlgorithmResults();
  const navigate = useNavigate();

  const { data: openApps, refetch: refetchApps } = useQuery({
    queryKey: ["open_applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("open_applications").select("*");
      if (error) throw error;
      return data;
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [hiringStatus, setHiringStatus] = useState("actively_hiring");
  const [skillReqs, setSkillReqs] = useState<SkillReq[]>([]);
  const [detailRole, setDetailRole] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const openNew = () => {
    setEditId(null); setTitle(""); setDepartment(""); setDescription(""); setHeadcount(1); setHiringStatus("actively_hiring"); setSkillReqs([]);
    setEditOpen(true);
  };

  const openEdit = (role: any) => {
    setEditId(role.id); setTitle(role.title); setDepartment(role.department || ""); setDescription(role.description || "");
    setHeadcount(role.headcount_needed || 1); setHiringStatus((role as any).hiring_status || 'actively_hiring');
    const req = (role.required_skills || {}) as Record<string, number>;
    const w = (role.strategic_weights || {}) as Record<string, number>;
    setSkillReqs(Object.entries(req).map(([name, required]) => ({ name, required, weight: w[name] || 0.5 })));
    setEditOpen(true);
  };

  const addSkill = () => setSkillReqs([...skillReqs, { name: "", required: 2, weight: "" as any }]);
  const removeSkill = (i: number) => setSkillReqs(skillReqs.filter((_, j) => j !== i));
  const updateSkill = (i: number, field: keyof SkillReq, value: string | number) => {
    setSkillReqs(skillReqs.map((s, j) => j === i ? { ...s, [field]: value } : s));
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const required_skills: Record<string, number> = {};
    const strategic_weights: Record<string, number> = {};
    skillReqs.forEach(s => {
      if (s.name.trim()) { required_skills[s.name.trim()] = s.required; strategic_weights[s.name.trim()] = Number(s.weight) || 0.6; }
    });

    const payload = {
      title, department, description, headcount_needed: headcount,
      is_open: hiringStatus !== 'stable',
      hiring_status: hiringStatus,
      required_skills: required_skills as any,
      strategic_weights: strategic_weights as any,
    };
    if (editId) {
      await supabase.from("roles").update(payload as any).eq("id", editId);
    } else {
      await supabase.from("roles").insert(payload as any);
    }
    toast.success(editId ? "Role updated" : "Role created");
    setEditOpen(false); refetch();
  };

  return (
    <div>
      <PageHeader title="Roles Manager" subtitle="Define strategic skill requirements for open positions" />
      <div className="px-8 pb-8 space-y-6">
        <div className="flex justify-end">
          <Button onClick={openNew} size="sm"><Plus className="h-3.5 w-3.5" /> Add New Role</Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {roles?.map(role => {
            const reqSkills = Object.keys((role.required_skills || {}) as Record<string, number>);
            const assessedCount = allResults?.filter(r => r.role_id === role.id).length || 0;
            const status = (role as any).hiring_status || 'actively_hiring';
            const statusCfg = hiringStatusConfig[status] || hiringStatusConfig.actively_hiring;
            return (
              <Card key={role.id}>
                <CardHeader className="pb-2">
                  <div>
                    <CardTitle className="text-sm font-bold">{role.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">{role.department}</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusCfg.dot }} />
                      <span className="text-[12px] font-medium" style={{ color: statusCfg.labelColor }}>{statusCfg.label}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mb-2">{role.description?.substring(0, 80)}{(role.description?.length || 0) > 80 ? '…' : ''}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span>{reqSkills.length} required skills</span>
                    <span>·</span>
                    <span>{assessedCount} employees assessed</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {reqSkills.slice(0, 5).map(s => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s.replace(/([A-Z])/g, ' $1').trim()}</Badge>
                    ))}
                    {reqSkills.length > 5 && <Badge variant="secondary" className="text-[10px]">+{reqSkills.length - 5} more</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setDetailRole(role); setDetailOpen(true); }}>
                      <Eye className="h-3 w-3" /> View Details
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openEdit(role)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-7">
                          <Share2 className="h-3 w-3" /> Share
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3 space-y-3">
                        <p className="text-xs font-medium">Public application link for {role.title}:</p>
                        <div className="flex gap-1.5">
                          <Input
                            readOnly
                            value={`${window.location.origin}/apply?role=${role.id}`}
                            className="text-[11px] h-8 font-mono"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/apply?role=${role.id}`);
                              setCopiedLink(role.id);
                              setTimeout(() => setCopiedLink(null), 2000);
                            }}
                          >
                            {copiedLink === role.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={openApps?.find((a: any) => a.role_id === role.id)?.is_accepting ?? true}
                            onCheckedChange={async (v) => {
                              const existing = openApps?.find((a: any) => a.role_id === role.id);
                              if (existing) {
                                await supabase.from("open_applications").update({ is_accepting: v } as any).eq("id", existing.id);
                              } else {
                                await supabase.from("open_applications").insert({ role_id: role.id, is_accepting: v } as any);
                              }
                              refetchApps();
                            }}
                          />
                          <Label className="text-xs">Accepting Applications</Label>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ maxWidth: '720px', width: '90vw' }}>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Role' : 'Add New Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><Label>Department</Label><Input value={department} onChange={e => setDepartment(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Headcount Needed</Label><Input type="number" value={headcount} onChange={e => setHeadcount(Number(e.target.value))} min={1} /></div>
              <div>
                <Label>Hiring Status</Label>
                <Select value={hiringStatus} onValueChange={setHiringStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actively_hiring">Actively Hiring — external and internal candidates sought</SelectItem>
                    <SelectItem value="internal_development">Internal Development — filling through upskilling</SelectItem>
                    <SelectItem value="stable">Stable — currently filled, succession monitoring only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Skill Requirements</Label>
                <Button variant="outline" size="sm" onClick={addSkill} className="text-xs h-7"><Plus className="h-3 w-3" /> Add Skill</Button>
              </div>
              <div className="space-y-3">
                {skillReqs.map((s, i) => {
                  const weightVal = s.weight;
                  const isInvalid = weightVal !== "" && (isNaN(Number(weightVal)) || Number(weightVal) < 0.1 || Number(weightVal) > 1.0);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input placeholder="Skill Name" value={s.name} onChange={e => updateSkill(i, 'name', e.target.value)} className="h-10" style={{ flex: 3 }} />
                        <Select value={String(s.required)} onValueChange={v => updateSkill(i, 'required', Number(v))}>
                          <SelectTrigger className="h-10" style={{ flex: 1.5 }}><SelectValue placeholder="Proficiency" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Beginner</SelectItem>
                            <SelectItem value="2">Intermediate</SelectItem>
                            <SelectItem value="3">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Weight (0.1 – 1.0)"
                          value={weightVal === 0 ? "" : weightVal}
                          onChange={e => updateSkill(i, 'weight', e.target.value as any)}
                          onBlur={() => {
                            const num = Number(weightVal);
                            if (weightVal === "" || weightVal === undefined) return;
                            if (isNaN(num) || num < 0.1 || num > 1.0) {
                              updateSkill(i, 'weight', 0.6);
                            } else {
                              updateSkill(i, 'weight', num);
                            }
                          }}
                          className="h-10"
                          style={{ flex: 1 }}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSkill(i)}><X className="h-3 w-3" /></Button>
                      </div>
                      {isInvalid && <p className="text-[11px] text-destructive pl-1">Enter a number between 0.1 and 1.0</p>}
                      {s.name && (
                        <div className="flex items-center gap-2 pl-1">
                          <SkillBadge skill={s.name} proficiency={s.required as 0 | 1 | 2 | 3} showLabel />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Strategic Weights Visualizer */}
              {skillReqs.filter(s => s.name.trim()).length > 0 && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Strategic Weight Distribution</Label>
                  <div className="flex h-5 rounded-md overflow-hidden border border-border">
                    {(() => {
                      const named = skillReqs.filter(s => s.name.trim());
                      const total = named.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
                      const weightColors: Record<string, string> = {
                        '0.3': 'hsl(var(--muted))',
                        '0.5': 'hsl(210 60% 80%)',
                        '0.6': 'hsl(var(--primary))',
                        '0.8': 'hsl(40 90% 55%)',
                        '0.95': 'hsl(0 70% 55%)',
                      };
                      return named.map((s, i) => {
                        const w = Number(s.weight) || 0;
                        const pct = total > 0 ? (w / total) * 100 : 0;
                        const color = weightColors[String(s.weight)] || 'hsl(var(--primary))';
                        return (
                          <div
                            key={i}
                            style={{ width: `${pct}%`, backgroundColor: color }}
                            className="relative group"
                            title={`${s.name}: ${s.weight}`}
                          >
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white opacity-0 group-hover:opacity-100 truncate px-0.5">
                              {s.name}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex gap-3 mt-1.5">
                    {[
                      { label: 'Low', color: 'hsl(var(--muted))' },
                      { label: 'Standard', color: 'hsl(var(--primary))' },
                      { label: 'High', color: 'hsl(40 90% 55%)' },
                      { label: 'Critical', color: 'hsl(0 70% 55%)' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[10px] text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailRole?.title}</DialogTitle>
          </DialogHeader>
          {detailRole && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{detailRole.description}</p>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Skill Requirements</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-1 text-xs">Skill</th>
                    <th className="text-center py-1 text-xs">Required Level</th>
                    <th className="text-center py-1 text-xs">Strategic Weight</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries((detailRole.required_skills || {}) as Record<string, number>).map(([skill, level]) => (
                      <tr key={skill} className="border-b border-border/50">
                        <td className="py-1.5">{skill.replace(/([A-Z])/g, ' $1').trim()}</td>
                        <td className="text-center font-mono">{level}/3</td>
                        <td className="text-center font-mono">{((detailRole.strategic_weights as Record<string, number>)?.[skill] || 0.5).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); navigate('/reorg'); }}>
                Run Reorg Scan →
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}