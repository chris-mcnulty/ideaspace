import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareLinksDialogProps {
  orgSlug: string;
  spaceCode: string;
}

const WORKSPACE_SECTIONS = [
  { value: "waiting", label: "Waiting Room", path: "" },
  { value: "participate", label: "Ideation (Participant View)", path: "/participate" },
  { value: "vote", label: "Pairwise Voting", path: "/vote" },
  { value: "rank", label: "Stack Ranking", path: "/rank" },
  { value: "marketplace", label: "Marketplace Allocation", path: "/marketplace" },
  { value: "survey", label: "Survey", path: "/survey" },
  { value: "results", label: "Results", path: "/results" },
  { value: "public-results", label: "Public Results (No Login)", path: "/public-results" },
] as const;

export function ShareLinksDialog({ orgSlug, spaceCode }: ShareLinksDialogProps) {
  const [selectedSection, setSelectedSection] = useState<string>(WORKSPACE_SECTIONS[0].value);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Generate URL based on selected section
  const generateUrl = () => {
    const baseUrl = window.location.origin;
    const section = WORKSPACE_SECTIONS.find(s => s.value === selectedSection);
    return `${baseUrl}/o/${orgSlug}/s/${spaceCode}${section?.path || ""}`;
  };

  const currentUrl = generateUrl();

  // Generate QR code whenever URL changes
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(currentUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (err) {
        console.error("Error generating QR code:", err);
        toast({
          title: "QR Code Generation Failed",
          description: "Could not generate QR code. Please try again.",
          variant: "destructive",
        });
      }
    };

    generateQRCode();
  }, [currentUrl, toast]);

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast({
        title: "URL Copied",
        description: "The link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
      toast({
        title: "Copy Failed",
        description: "Could not copy URL. Please try manually.",
        variant: "destructive",
      });
    }
  };

  // Download QR code as PNG
  const handleDownloadQR = () => {
    if (!qrCodeDataUrl) return;

    const section = WORKSPACE_SECTIONS.find(s => s.value === selectedSection);
    const sectionName = section?.label.replace(/[^a-z0-9]/gi, '_') || "workspace";
    const fileName = `Nebula_${spaceCode}_${sectionName}_QR.png`;

    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "QR Code Downloaded",
      description: `Saved as ${fileName}`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" data-testid="button-share-links">
          <Share2 className="h-4 w-4 mr-2" />
          Share Links
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Share Workspace Links</DialogTitle>
          <DialogDescription>
            Generate shareable URLs and QR codes for different sections of this workspace.
            Participants can scan or click these links to navigate directly to specific areas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section Selector */}
          <div className="space-y-2">
            <Label htmlFor="section-select">Select Section</Label>
            <Select
              value={selectedSection}
              onValueChange={setSelectedSection}
            >
              <SelectTrigger id="section-select" data-testid="select-workspace-section">
                <SelectValue placeholder="Choose a workspace section" />
              </SelectTrigger>
              <SelectContent>
                {WORKSPACE_SECTIONS.map((section) => (
                  <SelectItem key={section.value} value={section.value}>
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL Display and Copy */}
          <div className="space-y-2">
            <Label htmlFor="generated-url">Generated URL</Label>
            <div className="flex gap-2">
              <Input
                id="generated-url"
                value={currentUrl}
                readOnly
                className="font-mono text-sm"
                data-testid="input-generated-url"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyUrl}
                data-testid="button-copy-url"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* QR Code Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>QR Code</Label>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Join Code</span>
                <span className="font-mono text-2xl font-bold tracking-wider text-primary">{spaceCode}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 p-6 bg-card rounded-lg border">
              {qrCodeDataUrl ? (
                <>
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code"
                    className="w-64 h-64"
                    data-testid="img-qr-code"
                  />
                  <Button
                    variant="outline"
                    onClick={handleDownloadQR}
                    data-testid="button-download-qr"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </>
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                  <p className="text-muted-foreground text-sm">Generating QR code...</p>
                </div>
              )}
            </div>
          </div>

          {/* Helper Text */}
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Print QR codes on posters or display them on screens for easy participant access.
            The URL is based on your current server, so it will work correctly in production.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
