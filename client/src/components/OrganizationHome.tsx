import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import BrandHeader from "./BrandHeader";
import SpaceCard from "./SpaceCard";

interface Space {
  id: string;
  name: string;
  purpose: string;
  status: "draft" | "open" | "closed" | "processing";
  hidden: boolean;
  participantCount: number;
}

interface OrganizationHomeProps {
  orgName: string;
  orgLogo?: string;
  userName?: string;
  userRole?: "publisher" | "org_admin" | "facilitator" | "participant";
  spaces: Space[];
  onEnterSpace?: (spaceId: string) => void;
  onCreateSpace?: () => void;
  onManageOrg?: () => void;
}

export default function OrganizationHome({
  orgName,
  orgLogo,
  userName,
  userRole,
  spaces,
  onEnterSpace,
  onCreateSpace,
  onManageOrg,
}: OrganizationHomeProps) {
  const canManage = userRole === "org_admin" || userRole === "publisher";
  const canSeeFacilitatorContent = userRole === "facilitator" || canManage;
  
  // Filter hidden spaces based on user role
  const visibleSpaces = spaces.filter(space => 
    !space.hidden || canSeeFacilitatorContent
  );

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader
        orgName={orgName}
        orgLogo={orgLogo}
        userName={userName}
        userRole={userRole}
      />

      <main className="container mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {orgName} Spaces
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Select an envisioning space to join or create a new one
            </p>
          </div>
          <div className="flex gap-3">
            {canManage && (
              <>
                <Button
                  variant="outline"
                  onClick={onManageOrg}
                  data-testid="button-manage-org"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Organization
                </Button>
                <Button onClick={onCreateSpace} data-testid="button-create-space">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Space
                </Button>
              </>
            )}
          </div>
        </div>

        {visibleSpaces.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <p className="text-lg font-medium">No spaces yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {canManage
                  ? "Create your first envisioning space to get started"
                  : "Contact your administrator to create spaces"}
              </p>
              {canManage && (
                <Button className="mt-6" onClick={onCreateSpace}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Space
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSpaces.map((space) => (
              <SpaceCard
                key={space.id}
                name={space.name}
                purpose={space.purpose}
                status={space.status}
                participantCount={space.participantCount}
                isHidden={space.hidden}
                onEnter={() => onEnterSpace?.(space.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
