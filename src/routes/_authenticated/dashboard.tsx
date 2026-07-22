import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, FileText, Receipt, AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Drock Enterprise" },
      { name: "description", content: "Overview of sales, stock and quotations." },
      { property: "og:title", content: "Dashboard · Drock Enterprise" },
      { property: "og:description", content: "Overview of sales, stock and quotations." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin, user } = useSession();
  const [stats, setStats] = useState({ products: 0, customers: 0, quotations: 0, invoices: 0, unpaid: 0, revenue: 0, symbol: "GH₵", lowStock: [] as { id: string; name: string; quantity: number }[] });

  useEffect(() => {
    (async () => {
      const [{ count: products }, { count: customers }, { count: quotations }, { count: invoices }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("quotations").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
      ]);
      const { data: unpaidRows } = await supabase.from("invoices").select("total,status");
      const unpaid = (unpaidRows ?? []).filter((r) => r.status === "unpaid").reduce((a, r) => a + Number(r.total), 0);
      const revenue = (unpaidRows ?? []).filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.total), 0);
      const { data: settings } = await supabase.from("business_settings").select("currency_symbol").eq("id", 1).maybeSingle();
      const { data: low } = await supabase.from("products").select("id,name,quantity").lte("quantity", 5).order("quantity").limit(5);
      setStats({
        products: products ?? 0,
        customers: customers ?? 0,
        quotations: quotations ?? 0,
        invoices: invoices ?? 0,
        unpaid,
        revenue,
        symbol: settings?.currency_symbol ?? "GH₵",
        lowStock: low ?? [],
      });
    })();
  }, [user?.id]);

  const cards = [
    { label: "Products", value: stats.products, icon: Package, to: "/products" as const },
    { label: "Customers", value: stats.customers, icon: Users, to: "/customers" as const },
    { label: "Quotations", value: stats.quotations, icon: FileText, to: "/quotations" as const },
    { label: isAdmin ? "Invoices" : "My invoices", value: stats.invoices, icon: Receipt, to: "/invoices" as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{isAdmin ? "Business-wide overview." : "Your sales activity."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="block">
            <Card className="transition-colors hover:bg-muted/50 hover:border-primary/50 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-semibold">{c.value}</div></CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue (paid)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{formatMoney(stats.revenue, stats.symbol)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Outstanding (unpaid)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-destructive">{formatMoney(stats.unpaid, stats.symbol)}</div></CardContent>
        </Card>
      </div>
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle>Low stock (≤ 5)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All stock levels look healthy.</p>
            ) : (
              <ul className="divide-y">
                {stats.lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="font-medium">{p.quantity} left</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
