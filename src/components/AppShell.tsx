import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Store,
  MessageSquareText,
  FileText,
  Package,
  Receipt,
  CircleUser,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useEnquiryList } from "@/lib/enquiry-list";
import { Spinner } from "@/components/ui/spinner";
import { SetCredentialsPrompt } from "@/components/SetCredentialsPrompt";

/** Header shortcut to the enquiry list (requested in place of a floating action button) --
 * visible on every screen, not just the catalog pages the full-width EnquiryListLink banner
 * already covers. The icon itself is always there for discoverability; the count badge only
 * shows once something's actually been added. */
function EnquiryListHeaderLink() {
  const lines = useEnquiryList();
  return (
    <Link
      to="/enquiry"
      aria-label={`Enquiry list${lines.length > 0 ? ` (${lines.length} item${lines.length === 1 ? "" : "s"})` : ""}`}
      title="Enquiry list"
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-zinc-600"
    >
      <ClipboardList className="h-5 w-5" />
      {lines.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold leading-none text-white">
          {lines.length}
        </span>
      )}
    </Link>
  );
}

const NAV_ITEMS = [
  { to: "/catalog", label: "Catalog", icon: Store },
  { to: "/inquiries", label: "Enquiries", icon: MessageSquareText },
  { to: "/quotations", label: "Quotes", icon: FileText },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/invoices", label: "Invoices", icon: Receipt },
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
          <span className="flex items-center gap-2">
            <EnquiryListHeaderLink />
            <span className="text-sm text-zinc-500">{user.name}</span>
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <SetCredentialsPrompt />

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
