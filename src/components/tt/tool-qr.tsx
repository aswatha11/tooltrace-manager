import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function toolQrValue(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/update?code=${encodeURIComponent(code)}`;
}

export function ToolQr({ code, name, size = 160 }: { code: string; name?: string; size?: number }) {
  const print = () => {
    const svg = document.getElementById(`qr-${code}`)?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return;
    w.document.write(
      `<html><head><title>${code}</title></head><body style="font-family:sans-serif;text-align:center;padding:24px">${svg}<h2 style="font-family:monospace;margin:12px 0 4px">${code}</h2><p style="margin:0">${name ?? ""}</p><script>window.onload=function(){window.print()}</script></body></html>`,
    );
    w.document.close();
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border bg-card p-3 shadow-card">
        <div className="rounded-md bg-primary-foreground p-2 dark:bg-foreground">
          <QRCodeSVG id={`qr-${code}`} value={toolQrValue(code)} size={size} level="M" />
        </div>
      </div>
      <p className="font-mono text-lg font-bold tracking-wider">{code}</p>
      <Button variant="outline" size="sm" onClick={print}>
        <Printer /> Print label
      </Button>
    </div>
  );
}
