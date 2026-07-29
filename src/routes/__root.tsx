import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { applyStoredPalette } from "@/lib/theme-palette";
import { Toaster } from "@/components/ui/sonner";
import { Sentry } from "@/lib/observability";
import appCss from "../styles.css?url";

const themeBootScript = `(function(){try{var t=localStorage.getItem('bylda-theme');var r=document.documentElement;r.classList.remove('light','dark');if(t==='dark'){r.classList.add('dark');r.style.colorScheme='dark';}else{r.style.colorScheme='light';}}catch(e){}})();`;

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bylda — Build your business in the clouds" },
      {
        name: "description",
        content: "Build. Launch. Operate. The AI sky-island operating system for founders.",
      },
      { property: "og:title", content: "Bylda — Build your business in the clouds" },
      { name: "twitter:title", content: "Bylda — Build your business in the clouds" },
      {
        property: "og:description",
        content: "Build. Launch. Operate. The AI sky-island operating system for founders.",
      },
      {
        name: "twitter:description",
        content: "Build. Launch. Operate. The AI sky-island operating system for founders.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/VZji9IHswxTUZ3I7CRrnmLLHw093/social-images/social-1776887659447-generated-image_(4).webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/VZji9IHswxTUZ3I7CRrnmLLHw093/social-images/social-1776887659447-generated-image_(4).webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://api.fontshare.com" },
      {
        rel: "stylesheet",
        href: "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&f[]=satoshi@400,500,600&display=swap",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Re-apply the user's custom 3-color palette (Base/Secondary/Text) on load.
  useEffect(() => {
    applyStoredPalette();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Sentry.ErrorBoundary fallback={<RootErrorFallback />}>
            <Outlet />
          </Sentry.ErrorBoundary>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
