import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import BrandHeader from "@/components/BrandHeader";
import SpaceCard from "@/components/SpaceCard";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useParams } from "wouter";
import type { Organization, Space } from "@shared/schema";

export default function OrganizationHomePage() {
  const params = useParams() as { org: string };
  const [, setLocation] = useLocation();

  const { data: org, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  const { data: spaces = [], isLoading: spacesLoading } = useQuery<Space[]>({
    queryKey: [`/api/organizations/${org?.id}/spaces`],
    enabled: !!org?.id,
  });

  if (orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Organization not found</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // For demo purposes, assume guest participant role (no hidden spaces)
  const userRole = "participant";
  const canManage = false;
  const canSeeFacilitatorContent = false;

  const visibleSpaces = spaces.filter(space => 
    !space.hidden || canSeeFacilitatorContent
  );

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader
        orgName={org.name}
        orgLogo={org.logoUrl || undefined}
        userRole={userRole}
      />

      {/* Hero Section */}
      <section className="border-b bg-gradient-to-br from-background via-primary/5 to-background">
        <div className="container mx-auto px-6 py-12 md:py-16">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Envisioning Spaces
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
                Select a space to join collaborative sessions and contribute to shaping the future of {org.name}
              </p>
            </div>
            {canManage && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  data-testid="button-manage-org"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage
                </Button>
                <Button data-testid="button-create-space">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Space
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="container mx-auto px-6 py-12 md:py-16">

        <div>
          {spacesLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <p className="text-muted-foreground">Loading spaces...</p>
            </div>
          ) : visibleSpaces.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
              <div className="text-center">
                <p className="text-lg font-medium">No spaces available</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {canManage 
                    ? "Create your first envisioning space to get started" 
                    : "Contact your administrator to create spaces"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Available Sessions</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {visibleSpaces.length} {visibleSpaces.length === 1 ? 'space' : 'spaces'} ready to join
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSpaces.map(space => (
                  <SpaceCard
                    key={space.id}
                    name={space.name}
                    purpose={space.purpose}
                    status={space.status as any}
                    participantCount={0}
                    isHidden={space.hidden}
                    onEnter={() => setLocation(`/o/${params.org}/s/${space.id}`)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
