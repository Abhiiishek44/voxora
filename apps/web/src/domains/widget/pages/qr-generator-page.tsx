import { useMemo } from "react";
import { Download, Smartphone, Building2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { authApi } from "@/domains/auth/api/auth.api";
import { useWidget } from "@/domains/widget/hooks";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Loader } from "@/shared/ui/loader";
const QR_CANVAS_ID = "InteraOne-qr-code-canvas";
const PAGE_TITLE = "Chat Access QR";

export default function QRCodeGeneratorPage() {
  const { data: widget, isLoading } = useWidget();
  const orgRole = authApi.getOrgRole();

  const publicKey = widget?._id;
  const companyName = widget?.displayName || "Your Company";
  const brandLabel = `${companyName}`;

  const destinationUrl = useMemo(() => {
    if (!publicKey) return "";
    return `${window.location.origin}/c/${publicKey}`;
  }, [publicKey]);

  const handleDownload = () => {
    const canvas = document.getElementById(QR_CANVAS_ID) as HTMLCanvasElement | null;
    if (!canvas || !publicKey) return;

    const qrSize = 360;
    const qrRadius = 28;
    const padding = 32;
    const titleHeight = 48;
    const footerHeight = 40;
    const exportWidth = qrSize + padding * 2;
    const exportHeight = padding + titleHeight + qrSize + footerHeight + padding;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    const qrX = (exportWidth - qrSize) / 2;
    const qrY = padding + titleHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    ctx.fillStyle = "#111111";
    ctx.font = '700 32px "Geist Variable", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brandLabel, exportWidth / 2, padding + titleHeight / 2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(qrX + qrRadius, qrY);
    ctx.arcTo(qrX + qrSize, qrY, qrX + qrSize, qrY + qrSize, qrRadius);
    ctx.arcTo(qrX + qrSize, qrY + qrSize, qrX, qrY + qrSize, qrRadius);
    ctx.arcTo(qrX, qrY + qrSize, qrX, qrY, qrRadius);
    ctx.arcTo(qrX, qrY, qrX + qrSize, qrY, qrRadius);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(canvas, qrX, qrY, qrSize, qrSize);
    ctx.restore();


    const dataUrl = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `InteraOne-chat-qr-${publicKey}.png`;
    link.click();
  };

  if (orgRole !== "owner") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">QR Code Access</h1>
        <p className="text-sm text-muted-foreground">
          Only workspace owners can manage branded chat access QR codes.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{PAGE_TITLE}</h1>
        <p className="text-sm text-muted-foreground">
          Create your widget first to generate a scan-ready chat QR code.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">QR Code</h1>
        <p className="text-sm text-muted-foreground">
          Share this branded code in physical spaces so customers can open your chat in one scan.
        </p>
      </div>

      <Card className="border-border bg-card/90 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 md:p-8 border-b border-border lg:border-b-0 lg:border-r">
            <CardHeader className="p-0">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Standalone Chat QR
              </CardTitle>
              <CardDescription>
                High-quality QR code for your chat widget.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 mt-6 space-y-4">
              <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Building2 className="h-4 w-4" />
                  {companyName}
                </div>
                <p className="text-sm text-muted-foreground">
                  Branded export includes rounded QR corners, centered logo, and your company AI label.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDownload} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </Button>
              </div>
            </CardContent>
          </div>

          <div className="p-6 md:p-8 bg-muted/20">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background p-6">
              <div className="text-lg font-semibold tracking-tight text-foreground">{brandLabel}</div>
              <div className="relative inline-block">
                <div className="rounded-3xl overflow-hidden border border-border/70 shadow-sm">
                  <QRCodeCanvas
                    id={QR_CANVAS_ID}
                    value={destinationUrl}
                    size={320}
                    includeMargin
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#111111"
                    imageSettings={{
                      src: "/assets/interaone-logo-base64.png",
                      height: 52,
                      width: 52,
                      excavate: true,
                      crossOrigin: "anonymous",
                    }}
                    style={{ display: "block" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
