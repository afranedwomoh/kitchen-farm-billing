import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, FileText, Receipt, AlertTriangle, Sparkles } from "lucide-react";
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
  const [stats, setStats] = useState({
    products: 0, customers: 0, quotations: 0, invoices: 0,
    unpaid: 0, revenueMonth: 0, revenueYear: 0, symbol: "GH₵",
    lowStock: [] as { id: string; name: string; quantity: number }[],
  });
  const [revenuePeriod, setRevenuePeriod] = useState<"month" | "year">("month");

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
      const nextYearStart = new Date(now.getFullYear() + 1, 0, 1).toISOString();

      const [{ count: products }, { count: customers }, { count: quotations }, { count: invoices }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("quotations").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
      ]);
      const { data: unpaidRows } = await supabase.from("invoices").select("total,status");
      const unpaid = (unpaidRows ?? []).filter((r) => r.status === "unpaid").reduce((a, r) => a + Number(r.total), 0);

      const [{ data: monthRows }, { data: yearRows }] = await Promise.all([
        supabase.from("invoices").select("total").eq("status", "paid").gte("created_at", monthStart).lt("created_at", nextMonthStart),
        supabase.from("invoices").select("total").eq("status", "paid").gte("created_at", yearStart).lt("created_at", nextYearStart),
      ]);
      const revenueMonth = (monthRows ?? []).reduce((a, r) => a + Number(r.total), 0);
      const revenueYear = (yearRows ?? []).reduce((a, r) => a + Number(r.total), 0);

      const { data: settings } = await supabase.from("business_settings").select("currency_symbol").eq("id", 1).maybeSingle();
      const { data: low } = await supabase.from("products").select("id,name,quantity").lte("quantity", 5).order("quantity").limit(5);
      setStats({
        products: products ?? 0,
        customers: customers ?? 0,
        quotations: quotations ?? 0,
        invoices: invoices ?? 0,
        unpaid,
        revenueMonth,
        revenueYear,
        symbol: settings?.currency_symbol ?? "GH₵",
        lowStock: low ?? [],
      });
    })();
  }, [user?.id]);

  const cards = [
    { label: "Products", value: stats.products, icon: Package, to: "/products" as const, tone: "primary" as const },
    { label: "Customers", value: stats.customers, icon: Users, to: "/customers" as const, tone: "accent" as const },
    { label: "Quotations", value: stats.quotations, icon: FileText, to: "/quotations" as const, tone: "primary" as const },
    { label: isAdmin ? "Invoices" : "My invoices", value: stats.invoices, icon: Receipt, to: "/invoices" as const, tone: "accent" as const },
  ];

  const revenueValue = revenuePeriod === "month" ? stats.revenueMonth : stats.revenueYear;

  return (
    <div className="space-y-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          Dashboard <Sparkles className="h-5 w-5 text-accent-foreground" />
        </h1>
        <p className="text-sm text-muted-foreground">{isAdmin ? "Business-wide overview." : "Your sales activity."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Link
            key={c.label}
            to={c.to}
            className="block animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Card className="transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 cursor-pointer active:scale-[0.98]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center ${c.tone === "primary" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent><div className="text-2xl font-semibold">{c.value}</div></CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: "320ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Revenue (paid)</CardTitle>
            <div className="flex rounded-md border p-0.5 text-xs">
              <button
                onClick={() => setRevenuePeriod("month")}
                className={`px-2.5 py-1 rounded transition-colors ${revenuePeriod === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Month
              </button>
              <button
                onClick={() => setRevenuePeriod("year")}
                className={`px-2.5 py-1 rounded transition-colors ${revenuePeriod === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Year
              </button>
            </div>
          </CardHeader>
          <CardContent><div className="text-3xl font-semibold text-primary transition-all">{formatMoney(revenueValue, stats.symbol)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: "400ms" }}>
          <CardHeader><CardTitle>Outstanding (unpaid)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-destructive">{formatMoney(stats.unpaid, stats.symbol)}</div></CardContent>
        </Card>
      </div>
      {isAdmin && (
        <Card className="border-l-4 border-l-accent-foreground/40 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: "480ms" }}>
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
