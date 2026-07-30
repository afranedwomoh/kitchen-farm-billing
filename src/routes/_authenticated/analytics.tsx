import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { TrendingUp, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Drock Enterprise" },
      { name: "description", content: "Revenue and top-selling items by month and year." },
      { property: "og:title", content: "Analytics · Drock Enterprise" },
      { property: "og:description", content: "Revenue and top-selling items by month and year." },
    ],
  }),
  component: AnalyticsPage,
});

type ItemStat = { name: string; quantity: number; revenue: number };

function AnalyticsPage() {
  const [symbol, setSymbol] = useState("GH₵");
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [revenueYear, setRevenueYear] = useState(0);
  const [topMonth, setTopMonth] = useState<ItemStat[]>([]);
  const [topYear, setTopYear] = useState<ItemStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
      const nextYearStart = new Date(now.getFullYear() + 1, 0, 1).toISOString();

      const [{ data: monthInv }, { data: yearInv }] = await Promise.all([
        supabase.from("invoices").select("total").eq("status", "paid").gte("created_at", monthStart).lt("created_at", nextMonthStart),
        supabase.from("invoices").select("total").eq("status", "paid").gte("created_at", yearStart).lt("created_at", nextYearStart),
      ]);
      setRevenueMonth((monthInv ?? []).reduce((a, r) => a + Number(r.total), 0));
      setRevenueYear((yearInv ?? []).reduce((a, r) => a + Number(r.total), 0));

      const [{ data: itemsMonth }, { data: itemsYear }] = await Promise.all([
        supabase.from("invoice_items").select("product_name,quantity,line_total,invoices!inner(created_at,status)")
          .eq("invoices.status", "paid").gte("invoices.created_at", monthStart).lt("invoices.created_at", nextMonthStart),
        supabase.from("invoice_items").select("product_name,quantity,line_total,invoices!inner(created_at,status)")
          .eq("invoices.status", "paid").gte("invoices.created_at", yearStart).lt("invoices.created_at", nextYearStart),
      ]);
      setTopMonth(aggregate(itemsMonth ?? []));
      setTopYear(aggregate(itemsYear ?? []));

      const { data: settings } = await supabase.from("business_settings").select("currency_symbol").eq("id", 1).maybeSingle();
      if (settings) setSymbol(settings.currency_symbol);
      setLoading(false);
    })();
  }, []);

  function aggregate(rows: any[]): ItemStat[] {
    const map = new Map<string, ItemStat>();
    rows.forEach((r) => {
      const cur = map.get(r.product_name) ?? { name: r.product_name, quantity: 0, revenue: 0 };
      cur.quantity += r.quantity;
      cur.revenue += Number(r.line_total);
      map.set(r.product_name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }

  return (
    <div className="space-y-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Revenue and top-selling items, by month and year.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle>Revenue this month</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-semibold text-primary">{formatMoney(revenueMonth, symbol)}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent-foreground/50 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: "80ms" }}>
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent-foreground" />
            <CardTitle>Revenue this year</CardTitle>
          </CardHeader>
          <CardContent><div className="text-3xl font-semibold">{formatMoney(revenueYear, symbol)}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: "160ms" }}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <CardTitle>Top sellers this month</CardTitle>
          </CardHeader>
          <CardContent>
            {!loading && topMonth.length === 0 && <p className="text-sm text-muted-foreground">No sales yet this month.</p>}
            <ul className="divide-y">
              {topMonth.map((it, i) => (
                <li key={it.name} className="flex justify-between py-2 text-sm">
                  <span className="flex items-center gap-2"><span className="text-muted-foreground">#{i + 1}</span>{it.name}</span>
                  <span className="font-medium">{it.quantity} sold · {formatMoney(it.revenue, symbol)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: "240ms" }}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <CardTitle>Top sellers this year</CardTitle>
          </CardHeader>
          <CardContent>
            {!loading && topYear.length === 0 && <p className="text-sm text-muted-foreground">No sales yet this year.</p>}
            <ul className="divide-y">
              {topYear.map((it, i) => (
                <li key={it.name} className="flex justify-between py-2 text-sm">
                  <span className="flex items-center gap-2"><span className="text-muted-foreground">#{i + 1}</span>{it.name}</span>
                  <span className="font-medium">{it.quantity} sold · {formatMoney(it.revenue, symbol)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
