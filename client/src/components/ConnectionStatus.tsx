import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectionStatusProps {
  isConnected: boolean;
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  const { toast } = useToast();
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (isConnected) {
      if (hasEverConnected && !wasConnectedRef.current) {
        toast({
          title: "Back online",
          description: "Reconnected to the live session.",
          duration: 2500,
        });
      }
      if (!hasEverConnected) setHasEverConnected(true);
      wasConnectedRef.current = true;
    } else {
      wasConnectedRef.current = false;
    }
  }, [isConnected, hasEverConnected, toast]);

  if (isConnected || !hasEverConnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="banner-reconnecting"
      className="fixed left-1/2 top-20 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-md border bg-background/95 px-3 py-1.5 text-sm shadow-md backdrop-blur"
    >
      <WifiOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span data-testid="text-reconnecting">Reconnecting…</span>
    </div>
  );
}
