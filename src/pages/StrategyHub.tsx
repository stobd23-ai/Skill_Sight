import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSkillsCatalog } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { FileText, Upload, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function StrategyHub() {
  const { data: roles } = useRoles();
  const { data: skillsCatalog } = useSkillsCatalog();
  const { data: stratDocs, refetch } = useQuery({
    queryKey: ["strategy_documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategy_documents").select("*").order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Aggregate future skills from active strategy documents
  const futureSkills = useMemo(() => {
    if (!stratDocs) return [];
    const skillMap: Record<string, { importance: string; timeHorizon: string; docCount: number; currentWeight: number; suggestedWeight: number }> = {};

    stratDocs.filter(d => d.is_active).forEach(doc => {
      const extracted = (doc.extracted_future_skills || []) as Array<{ skill: string; importance?: string; time_horizon?: string; weight_adjustment?: number }>;
      extracted.forEach(fs => {
        if (!skillMap[fs.skill]) {
          const catalogEntry = skillsCatalog?.find(s => s.name === fs.skill);
          const currentWeight = catalogEntry?.strategic_priority ? catalogEntry.strategic_priority / 5 : 0.5;
          skillMap[fs.skill] = {
            importance: fs.importance || 'HIGH',
            timeHorizon: fs.time_horizon || '2025-2027',
            docCount: 0,
            currentWeight,
            suggestedWeight: currentWeight + (fs.weight_adjustment || 0.05),
          };
        }
        skillMap[fs.skill].docCount++;
        if (fs.importance === 'CRITICAL') skillMap[fs.skill].importance = 'CRITICAL';
      });
    });

    return Object.entries(skillMap).map(([skill, d]) => ({ skill, importance: d.importance, timeHorizon: d.timeHorizon, docCount: d.docCount, currentWeight: d.currentWeight, suggestedWeight: d.suggestedWeight }))
      .sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (order[a.importance as keyof typeof order] ?? 9) - (order[b.importance as keyof typeof order] ?? 9);
      });
  }, [stratDocs, skillsCatalog]);

  const toggleDoc = async (docId: string, isActive: boolean) => {
    await supabase.from("strategy_documents").update({ is_active: isActive }).eq("id", docId);
    refetch();
  };

  const updateStrategicWeights = async () => {
    if (!roles) return;
    for (const role of roles) {
      const weights = Object.assign({}, (role.strategic_weights || {})) as Record<string, number>;
      futureSkills.forEach(fs => {
        weights[fs.skill] = Math.min(fs.suggestedWeight, 1.0);
      });
      await supabase.from("roles").update({ strategic_weights: weights as any }).eq("id", role.id);
    }
    toast.success("Strategic weights updated across all roles.");
  };

  return (
    <div>
      <PageHeader title="Strategy Hub" subtitle="Strategic document management and future skill extraction" />
      <div className="px-8 pb-8 space-y-6">
        {/* Active Documents */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Strategy Documents
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {stratDocs?.length ? (
              <div className="space-y-3">
                {stratDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <h4 className="text-sm font-medium">{doc.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{doc.document_type || 'Strategy'}</span>
                          {doc.time_horizon && <Badge variant="outline" className="text-[10px]">{doc.time_horizon}</Badge>}
                          {doc.processed && <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200">Processed</Badge>}
                        </div>
                        {doc.summary && <p className="text-xs text-muted-foreground mt-1 max-w-lg">{doc.summary}</p>}
                      </div>
                    </div>
                    <Switch checked={doc.is_active ?? false} onCheckedChange={(v) => toggleDoc(doc.id, v)} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No strategy documents uploaded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Aggregated Future Skill Requirements */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Aggregated Future Skill Requirements
              </CardTitle>
              <Button size="sm" variant="outline" onClick={updateStrategicWeights} disabled={futureSkills.length === 0}>
                <TrendingUp className="h-3.5 w-3.5" /> Update Strategic Weights
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Compiled from all active strategy documents</p>
          </CardHeader>
          <CardContent>
            {futureSkills.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Skill</th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Importance</th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Time Horizon</th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Docs</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Strategic Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureSkills.map(fs => (
                      <tr key={fs.skill} className="border-b border-border/50">
                        <td className="py-2 font-medium">{fs.skill.replace(/([A-Z])/g, ' $1').trim()}</td>
                        <td className="py-2">
                          <Badge variant={fs.importance === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {fs.importance}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{fs.timeHorizon}</td>
                        <td className="py-2 text-xs text-muted-foreground">{fs.docCount} document{fs.docCount > 1 ? 's' : ''}</td>
                        <td className="py-2 text-right font-mono text-xs">
                          {fs.currentWeight.toFixed(2)} → {fs.suggestedWeight.toFixed(2)}
                          <span className="text-green-600 ml-1">(+{(fs.suggestedWeight - fs.currentWeight).toFixed(2)})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No active documents with extracted skills.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
