import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Bell, History, QrCode, ScanLine, Workflow, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/tt/app-shell";
import { ThemeToggle } from "@/components/tt/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero-workshop.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ToolTrace — Digital Tooling Process Management & Traceability" },
      {
        name: "description",
        content:
          "ToolTrace replaces paper tooling records with live stage tracking, QR scanning, full traceability and delay alerts for Industry 4.0 shop floors.",
      },
      { property: "og:title", content: "ToolTrace — Digital Tooling Traceability" },
      {
        property: "og:description",
        content: "Live tooling stage tracking, QR scanning, history timelines and delay alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: ScanLine, title: "Tap-to-update", text: "Scan a tool's QR and tap the next stage. Done in seconds, with gloves on." },
  { icon: History, title: "Full traceability", text: "Every stage change, operator and timestamp kept forever and searchable." },
  { icon: Bell, title: "Delay alerts", text: "Tools stuck too long in a stage are flagged before they hold up production." },
  { icon: Workflow, title: "Your process", text: "Admins add, rename and reorder stages to match the real workflow." },
  { icon: QrCode, title: "Auto Tool IDs", text: "Each new tool gets a unique ID and a printable QR label." },
  { icon: FileSpreadsheet, title: "CSV reports", text: "Filter by tool, stage, date or operator and export in one click." },
];

function Landing() {
  const navigate = useNavigate();

  // Returning from Google / Lovable sign-in lands here; continue into the app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const stored = sessionStorage.getItem("tt-after-login");
      sessionStorage.removeItem("tt-after-login");
      navigate({ to: stored && stored.startsWith("/") && !stored.startsWith("//") ? stored : "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-steel text-steel-foreground">
        <img src={heroImg} alt="Precision moulds and dies in a modern tooling workshop" width={1600} height={1008} className="absolute inset-0 size-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-steel via-steel/85 to-steel/20" />
        <div className="relative mx-auto max-w-7xl px-6">
          <header className="flex items-center justify-between py-6">
            <Logo />
            <div className="flex items-center gap-2">
              <ThemeToggle className="text-steel-foreground hover:bg-steel-foreground/10 hover:text-steel-foreground" />
              <Button asChild variant="secondary">
                <Link to="/auth" search={{ redirect: undefined }}>Sign in</Link>
              </Button>
            </div>
          </header>
          <div className="max-w-2xl pt-16 pb-28 sm:pt-24 sm:pb-36">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-steel-foreground/20 bg-steel-foreground/5 px-3 py-1 text-xs font-bold tracking-[0.2em] uppercase">
              Industry 4.0 · Tooling
            </p>
            <h1 className="text-5xl leading-[0.95] font-bold sm:text-7xl">
              Paperless tooling.
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">Total traceability.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-steel-foreground/80">
              ToolTrace tracks every die, mould and fixture through design, machining, inspection and dispatch — live, on any device on the shop floor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/dashboard">
                  Open dashboard <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="border-steel-foreground/30 bg-transparent text-steel-foreground hover:bg-steel-foreground/10 hover:text-steel-foreground">
                <Link to="/update">
                  <ScanLine /> Update a tool
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blueprint">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 shadow-card">
              <div className="mb-4 grid size-11 place-items-center rounded-lg bg-secondary text-primary">
                <f.icon className="size-5" />
              </div>
              <h2 className="text-2xl font-bold">{f.title}</h2>
              <p className="mt-1 text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        ToolTrace · Digital Tooling Process Management and Traceability System
      </footer>
    </div>
  );
}
