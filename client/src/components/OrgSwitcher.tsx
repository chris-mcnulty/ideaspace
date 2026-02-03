import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, FolderKanban, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Organization {
  id: string;
  name: string;
  slug: string;
  projectCount: number;
  workspaceCount: number;
}

interface OrgSwitcherProps {
  selectedOrgId: string | null;
  onOrgChange: (orgId: string | null) => void;
}

export function OrgSwitcher({ selectedOrgId, onOrgChange }: OrgSwitcherProps) {
  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/my-organizations"],
  });

  if (isLoading) {
    return <Skeleton className="h-9 w-40" data-testid="skeleton-org-switcher" />;
  }

  if (!organizations || organizations.length === 0) {
    return null;
  }

  const selectedOrg = selectedOrgId 
    ? organizations.find(org => org.id === selectedOrgId) 
    : null;

  const displayName = selectedOrg ? selectedOrg.name : "All Organizations";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 min-w-[160px] justify-between"
          data-testid="button-org-switcher"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate max-w-[120px]">{displayName}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {organizations.length > 1 && (
          <>
            <DropdownMenuItem
              onClick={() => onOrgChange(null)}
              className={!selectedOrgId ? "bg-accent" : ""}
              data-testid="menu-item-all-orgs"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              <span>All Organizations</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onOrgChange(org.id)}
            className={selectedOrgId === org.id ? "bg-accent" : ""}
            data-testid={`menu-item-org-${org.slug}`}
          >
            <div className="flex flex-col w-full gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{org.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                <FolderKanban className="h-3 w-3" />
                <span>{org.projectCount} projects</span>
                <span className="text-border">|</span>
                <span>{org.workspaceCount} workspaces</span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
