import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const lookupWorkspace = async () => {
      if (!params.code) {
        setLocation("/");
        return;
      }

      try {
        const response = await fetch(`/api/spaces/lookup/${params.code}`);
        
        if (response.ok) {
          const { space, organization } = await response.json();
          setLocation(`/o/${organization.slug}/s/${space.id}`);
        } else {
          console.error("Workspace not found for code:", params.code);
          setLocation("/?error=workspace-not-found");
        }
      } catch (err) {
        console.error("Failed to lookup workspace:", err);
        setLocation("/?error=connection-failed");
      }
    };

    lookupWorkspace();
  }, [params.code, setLocation]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Looking up workspace...</p>
      </div>
    </div>
  );
}
