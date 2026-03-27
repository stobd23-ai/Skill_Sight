import { PageHeader } from "@/components/PageHeader";

export default function BootcampPage() {
  return (
    <div>
      <PageHeader title="Bootcamps" subtitle="Personalized upskilling programs" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Bootcamp programs will be generated from analysis results.</p>
      </div>
    </div>
  );
}
