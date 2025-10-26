import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface BrandHeaderProps {
  orgName?: string;
  orgLogo?: string;
  userName?: string;
  userRole?: "publisher" | "org_admin" | "facilitator" | "participant";
  onToggleDarkMode?: () => void;
}

export default function BrandHeader({
  orgName = "Synozur",
  orgLogo,
  userName,
  userRole,
}: BrandHeaderProps) {
  const getRoleBadge = () => {
    if (!userRole) return null;
    const roleMap = {
      publisher: { label: "Publisher", variant: "default" as const },
      org_admin: { label: "Admin", variant: "secondary" as const },
      facilitator: { label: "Facilitator", variant: "default" as const },
      participant: { label: "Participant", variant: "outline" as const },
    };
    const role = roleMap[userRole];
    return <Badge variant={role.variant} className="text-xs">{role.label}</Badge>;
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            <img src={orgLogo} alt={orgName} className="h-8 w-auto object-contain" data-testid="img-org-logo" />
          ) : (
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8 w-auto object-contain"
              data-testid="img-default-logo"
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          {getRoleBadge()}
          {userName && (
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </header>
  );
}
