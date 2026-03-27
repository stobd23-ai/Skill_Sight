import { PageHeader } from "@/components/PageHeader";

export default function StrategyHub() {
  return (
    <div>
      <PageHeader title="Strategy Hub" subtitle="Strategic document management and future skill extraction" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Upload strategy documents to extract future skill requirements.</p>
      </div>
    </div>
  );
}
