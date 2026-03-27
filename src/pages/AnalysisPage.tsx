import { PageHeader } from "@/components/PageHeader";

export default function AnalysisPage() {
  return (
    <div>
      <PageHeader title="Analysis" subtitle="Skill gap analysis and readiness scoring" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Analysis results will appear here after interviews are completed.</p>
      </div>
    </div>
  );
}
