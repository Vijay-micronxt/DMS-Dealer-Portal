import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Store, MessageSquareText, Package, CircleUser } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const NAV_ITEMS = [
  { to: "/catalog", label: "Catalog", icon: Store },
  { to: "/inquiries", label: "Enquiries", icon: MessageSquareText },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/profile", label: "Profile", icon: CircleUser },
] as const;

/** Wraps every authenticated route. Not a route-loader guard (this is a client-only
 * SPA, so there's no server-side redirect to do it there) -- instead it waits for
 * auth hydration to resolve, then bounces to /login the first render after that if
 * there's no session. See lib/auth.ts's useAuth() docstring for why "pending" has to
 * be a distinct third state from "logged out" here. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, authPending } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  React.useEffect(() => {
    if (!authPending && !user) {
      navigate({ to: "/login", search: { redirect: pathname } });
    }
  }, [authPending, user, navigate, pathname]);

  if (authPending || !user) {
    return <Spinner className="h-screen" />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            Pacific Dealer Portal
          </span>
          <span className="text-sm text-zinc-500">{user.name}</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl border-t border-zinc-200 bg-white">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
                active ? "text-zinc-900" : "text-zinc-400",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
