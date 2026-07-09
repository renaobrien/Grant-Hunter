import "./globals.css";
import type { ReactNode, CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient, authDisabled } from "@/lib/supabase/server";
import HealthHeader from "@/components/HealthHeader";
import FeedbackButton from "@/components/FeedbackButton";
import ConsoleCapture from "@/components/ConsoleCapture";
import ThemeToggle from "@/components/ThemeToggle";

// Applies the stored theme before first paint so dark mode doesn't flash
// light. No stored choice = follow the OS (handled in CSS).
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Grant Hunter",
  description: "Grant discovery + application workspace",
};

interface BrandProfile {
  org_name: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  brand_bg: string | null;
}

async function loadBrand(): Promise<BrandProfile | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile")
      .select("org_name, logo_url, brand_primary, brand_accent, brand_bg")
      .eq("id", 1)
      .maybeSingle();
    return (data as BrandProfile) ?? null;
  } catch {
    return null;
  }
}

async function hasSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // In no-login mode there's no session, but the app is fully usable - show the nav.
  const [brand, sessionAuthed] = await Promise.all([loadBrand(), hasSession()]);
  const authed = authDisabled() || sessionAuthed;

  const brandVars: CSSProperties = {};
  if (brand?.brand_primary)
    (brandVars as Record<string, string>)["--brand-primary"] =
      brand.brand_primary;
  if (brand?.brand_accent)
    (brandVars as Record<string, string>)["--brand-accent"] =
      brand.brand_accent;
  if (brand?.brand_bg)
    (brandVars as Record<string, string>)["--brand-bg"] = brand.brand_bg;

  // Brand reads "{Org} Grant Hunter" once a profile exists, plain product name before.
  const org = brand?.org_name?.trim();
  const orgName = org ? `${org} Grant Hunter` : "Grant Hunter";

  return (
    // Brand vars live on <html> so body { background: var(--page-bg) } and
    // everything below can resolve them.
    <html lang="en" style={brandVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ConsoleCapture />
        <div>
          <nav className="app-nav">
            <Link href="/" className="brand">
              {brand?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt={orgName} />
              ) : (
                <span className="brand-dot" aria-hidden="true" />
              )}
              <span>{orgName}</span>
            </Link>
            <div className="nav-links">
              <Link href="/">Board</Link>
              <Link href="/runs">Runs</Link>
              <Link href="/profile">Profile</Link>
              <Link href="/settings">Settings</Link>
              <ThemeToggle />
            </div>
          </nav>
          <HealthHeader />
          <main>{children}</main>
          {authed ? <FeedbackButton /> : null}
        </div>
      </body>
    </html>
  );
}
