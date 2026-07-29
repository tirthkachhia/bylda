import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import {
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Settings as SettingsIcon,
  Check,
  Search,
  Zap,
  HelpCircle,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { NotificationBell } from "@/components/app/NotificationBell";
import { useGuest } from "@/lib/guest";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { ThemePaletteButton } from "./ThemePaletteButton";

const PAGE_TITLES: Record<string, string> = {
  "/app/launchpad/history": "Run History",
  "/app/launchpad/first-customers": "First Customers",
  "/app/launchpad": "Workbench",
  "/app/playbook": "Playbook",
  "/app/mission-control": "Home",
  "/app/bylda-home": "Home",
  "/app/research": "Research",
  "/app/memory": "Memory",
  "/app/automations": "Automations",
  "/app/builder": "Builder",
  "/app/contacts": "Contacts",
  "/app/integrations": "Integrations",
  "/app/settings": "Settings",
  "/app/billing": "Billing",
  "/app/bylda/reports": "Reports",
  "/app/assets": "Assets",
  "/app/academy": "Course",
  "/app/tutorials": "Tutorials",
  "/app/mentor": "Ask Bylda",
  "/app/admin": "Admin",
  "/app/bylda/crm": "Pipeline",
  "/app/monitoring": "System Health",
  "/app/templates": "Templates",
  "/app/sop-library": "SOP Library",
  "/app/scale/campaigns": "Campaigns",
};

const SECTION_LABELS: Record<string, string> = {
  "/app/playbook": "Execute",
  "/app/mission-control": "Execute",
  "/app/bylda-home": "Operate",
  "/app/academy": "Learn",
  "/app/launchpad": "Workbench",
  "/app/research": "Workbench",
  "/app/bylda/crm": "Operate",
  "/app/contacts": "Operate",
  "/app/scale/campaigns": "Operate",
  "/app/automations": "Automate",
  "/app/builder": "Automate",
  "/app/integrations": "Automate",
  "/app/bylda/reports": "Intelligence",
  "/app/mentor": "Intelligence",
  "/app/monitoring": "Intelligence",
  "/app/assets": "Resources",
  "/app/templates": "Resources",
  "/app/sop-library": "Resources",
  "/app/memory": "Resources",
};

interface AppTopbarProps {
  onToggleRail?: () => void;
  railOpen?: boolean;
}

export function AppTopbar({ onToggleRail, railOpen }: AppTopbarProps) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { isGuest, disable } = useGuest();

  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  const initials = (profile?.full_name || user?.email || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Account";

  const pageTitle = Object.entries(PAGE_TITLES).find(([p]) => path.startsWith(p))?.[1] ?? "";
  const sectionLabel = Object.entries(SECTION_LABELS).find(([p]) => path.startsWith(p))?.[1] ?? "";

  const handleSignOut = async () => {
    if (isGuest) {
      disable();
      navigate({ to: "/" });
      return;
    }
    await signOut();
    navigate({ to: "/auth/sign-in" });
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!themeRef.current?.contains(e.target as Node)) setThemeOpen(false);
    };
    if (menuOpen || themeOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen, themeOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-[52px] items-center gap-4 border-b px-4 shrink-0"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        {/* ── Mobile logo ── */}
        <Link to="/app/mission-control" className="flex items-center gap-2 lg:hidden shrink-0">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--orbit-accent))" }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <circle cx="16" cy="8" r="3" fill="#fff" />
              <path
                d="M4 16c0-1.9 1.6-3.4 3.5-3.4.3 0 .6 0 .9.1A3.6 3.6 0 0 1 15 13a2.8 2.8 0 0 1 2.6 2.8c0 .2 0 .3-.1.5H4.3A2 2 0 0 1 4 16Z"
                fill="#fff"
              />
            </svg>
          </div>
        </Link>

        {/* ── Desktop breadcrumb ── */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0 min-w-0">
          {sectionLabel && (
            <>
              <span className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                {sectionLabel}
              </span>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 opacity-40"
                style={{ color: "var(--muted-foreground)" }}
              />
            </>
          )}
          {pageTitle && (
            <span
              className="text-[13px] font-semibold truncate"
              style={{ color: "var(--foreground)" }}
            >
              {pageTitle}
            </span>
          )}
        </div>

        {/* ── Search bar ── */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2 rounded-lg h-[34px] px-3 transition-all duration-150 shrink-0 w-[220px] sm:w-[280px]"
          style={{
            background: "var(--surface-2)",
            color: "var(--muted-foreground)",
            border: "1.5px solid var(--border)",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--ring)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px var(--primary-soft)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left text-[12.5px] hidden sm:block">Search anything...</span>
          <kbd
            className="hidden md:inline text-[10px] font-mono shrink-0 rounded px-1 py-px"
            style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
          >
            ⌘K
          </kbd>
        </button>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Right controls ── */}
        <div className="flex items-center gap-0.5">
          {/* New / Quick add */}
          <button
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-semibold transition-colors mr-1"
            style={{ background: "var(--primary)", color: "white" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--primary-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--primary)";
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>

          {/* Bell */}
          <NotificationBell />

          {/* Help */}
          <IconBtn title="Help & support">
            <HelpCircle className="h-4 w-4" />
          </IconBtn>

          {/* Custom 3-color palette (Base / Secondary / Text) */}
          <ThemePaletteButton />

          {/* Theme picker */}
          <div className="relative" ref={themeRef}>
            <IconBtn onClick={() => setThemeOpen((o) => !o)} title="Theme">
              {theme === "system" ? (
                <Monitor className="h-4 w-4" />
              ) : resolvedTheme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </IconBtn>

            {themeOpen && (
              <div
                className="absolute right-0 mt-1.5 w-36 rounded-xl border p-1 overflow-hidden"
                style={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-md)",
                  zIndex: 50,
                }}
              >
                {(
                  [
                    { id: "light", label: "Light", Icon: Sun },
                    { id: "dark", label: "Dark", Icon: Moon },
                    { id: "system", label: "System", Icon: Monitor },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setTheme(id);
                      setThemeOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors"
                    style={{
                      color: theme === id ? "var(--foreground)" : "var(--muted-foreground)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{label}</span>
                    {theme === id && (
                      <Check className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px mx-1.5" style={{ background: "var(--border)" }} />

          {/* Bylda AI toggle */}
          {onToggleRail && (
            <button
              onClick={onToggleRail}
              title={railOpen ? "Close Bylda AI" : "Open Bylda AI"}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-semibold transition-all duration-150"
              style={
                railOpen
                  ? { background: "var(--primary)", color: "white" }
                  : {
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                      border: "1px solid var(--primary-border)",
                    }
              }
              onMouseEnter={(e) => {
                if (!railOpen)
                  (e.currentTarget as HTMLElement).style.background = "var(--primary-border)";
              }}
              onMouseLeave={(e) => {
                if (!railOpen)
                  (e.currentTarget as HTMLElement).style.background = "var(--primary-soft)";
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bylda AI</span>
            </button>
          )}

          {/* User menu */}
          <div className="relative ml-1.5" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 h-8 rounded-lg px-2 transition-colors"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                style={{ background: "var(--primary)" }}
              >
                {initials}
              </span>
              <span
                className="hidden md:inline text-[12.5px] font-medium max-w-[90px] truncate"
                style={{ color: "var(--foreground)" }}
              >
                {firstName}
              </span>
              {isGuest && (
                <span
                  className="hidden md:inline text-[10px] font-semibold px-1.5 py-px rounded"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  Demo
                </span>
              )}
              <ChevronDown
                className="h-3 w-3 shrink-0 opacity-50"
                style={{ color: "var(--muted-foreground)" }}
              />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-56 rounded-xl border overflow-hidden"
                style={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-md)",
                  zIndex: 50,
                }}
              >
                {/* User info header */}
                <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: "var(--primary)" }}
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-[13px] font-semibold truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {profile?.full_name || "Account"}
                      </div>
                      <div
                        className="text-[11px] truncate"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {user?.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1.5">
                  <TopbarMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      navigate({ to: "/app/settings" });
                    }}
                    icon={UserIcon}
                  >
                    Profile
                  </TopbarMenuItem>
                  <TopbarMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      navigate({ to: "/app/settings" });
                    }}
                    icon={SettingsIcon}
                  >
                    Settings
                  </TopbarMenuItem>
                  <div className="my-1 h-px" style={{ background: "var(--border)" }} />
                  <TopbarMenuItem onClick={handleSignOut} icon={LogOut} destructive>
                    {isGuest ? "Exit demo" : "Sign out"}
                  </TopbarMenuItem>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}

/* ── Small icon button helper ── */
function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-100"
      style={{ color: "var(--muted-foreground)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
        (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
      }}
    >
      {children}
    </button>
  );
}

function TopbarMenuItem({
  onClick,
  icon: Icon,
  children,
  destructive,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors"
      style={{ color: destructive ? "var(--destructive)" : "var(--foreground)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = destructive
          ? "color-mix(in oklab, var(--destructive) 8%, transparent)"
          : "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </button>
  );
}
