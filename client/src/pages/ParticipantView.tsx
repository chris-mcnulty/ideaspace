import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BrandHeader from "@/components/BrandHeader";
import type { Organization, Space } from "@shared/schema";

export default function ParticipantView() {
  const params = useParams() as { org: string; space: string };

  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  return (
    <div className="min-h-screen bg-background">
      {org && (
        <BrandHeader
          orgName={org.name}
          orgLogo={org.logoUrl || undefined}
          userName="Participant"
          userRole="participant"
        />
      )}

      <main className="container mx-auto px-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{space?.name}</h1>
          <p className="mt-4 text-muted-foreground">
            You've successfully joined the session!
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Participant workspace coming soon...
          </p>
        </div>
      </main>
    </div>
  );
}
