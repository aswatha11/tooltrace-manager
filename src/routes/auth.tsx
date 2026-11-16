import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/tt/app-shell";
import { ThemeToggle } from "@/components/tt/theme-toggle";
import heroImg from "@/assets/hero-workshop.jpg";

function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value, "http://x");
    if (!value.startsWith("/") && !value.startsWith("http")) return undefined;
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/auth") ? path : undefined;
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: safeRedirect(s["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ToolTrace" },
      { name: "description", content: "Sign in to ToolTrace to track tooling stages on the shop floor." },
      { property: "og:title", content: "Sign in — ToolTrace" },
      { property: "og:description", content: "Sign in to track tooling stages and history." },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const target = search.redirect ?? "/dashboard";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${target}`, data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: target });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "lovable") => {
    if (target !== "/dashboard") sessionStorage.setItem("tt-after-login", target);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: target });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-steel lg:block">
        <img src={heroImg} alt="Tooling workshop with moulds and dies" width={1600} height={1008} className="absolute inset-0 size-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-steel via-steel/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-10 text-steel-foreground">
          <Logo />
          <div>
            <p className="font-display text-5xl leading-tight font-bold">
              Every tool.<br />Every stage.<br />Every hand that touched it.
            </p>
            <p className="mt-4 max-w-md text-steel-foreground/75">
              Replace paper tooling records with live status, QR scanning and a complete audit trail.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blueprint flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-card">
            {sent ? (
              <div className="text-center">
                <h1 className="text-3xl font-bold">Check your email</h1>
                <p className="mt-2 text-muted-foreground">
                  We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.
                </p>
                <Button variant="outline" className="mt-6 w-full" onClick={() => { setSent(false); setMode("signin"); }}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "signin" ? "Sign in to the shop floor system." : "The first account becomes the Admin."}
                </p>

                <div className="mt-6 space-y-2.5">
                  <Button
                    type="button"
                    variant="google"
                    size="xl"
                    className="w-full"
                    onClick={() => oauth("google")}
                  >
                    <GoogleIcon /> Continue with Google
                  </Button>
                  <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                    Continue with Lovable
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground uppercase">
                  <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" placeholder="e.g. Ravi Kumar" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
                  </div>
                  <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </form>
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                  <button className="font-semibold text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
