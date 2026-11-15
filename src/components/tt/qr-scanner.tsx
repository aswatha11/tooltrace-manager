import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const elId = "tt-qr-reader";

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void; isScanning?: boolean } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(elId);
        scanner = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (done.current) return;
            done.current = true;
            onResult(text);
          },
          () => {},
        );
      } catch {
        setError("Camera not available. Allow camera access or type the Tool ID instead.");
      }
    })();
    return () => {
      cancelled = true;
      if (scanner?.isScanning) scanner.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-steel/95 p-4">
      <p className="font-display text-2xl font-bold text-steel-foreground">Point camera at the tool's QR label</p>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border-4 border-primary bg-steel">
        <div id={elId} className="aspect-square w-full" />
      </div>
      {error && <p className="max-w-sm text-center text-warning">{error}</p>}
      <Button variant="secondary" size="touch" onClick={onClose}>
        <X /> Cancel
      </Button>
    </div>
  );
}
