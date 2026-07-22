import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, Users, FileText, Receipt, Settings, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, user, isAdmin } = useSession();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/products", label: "Products & Stock", icon: Package },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/quotations", label: "Quotations", icon: FileText },
    { to: "/invoices", label: "Invoices", icon: Receipt },
    ...(isAdmin ? [{ to: "/settings", label: "Settings", icon: Settings }] : []),
  ];

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r flex flex-col transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-16 flex items-center px-5 border-b">
          <div>
            <div className="font-semibold tracking-tight">Drock Enterprise</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Invoicing & Stock</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="px-3 text-xs">
            <div className="truncate font-medium">{user?.email}</div>
            <div className="text-muted-foreground capitalize">{role ?? "—"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex-1 md:ml-64 min-w-0">
        <header className="h-16 bg-card border-b flex items-center px-4 md:px-8 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Menu /></Button>
          <span className="ml-3 font-semibold">Drock Enterprise</span>
        </header>
        <main className="p-4 md:p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
