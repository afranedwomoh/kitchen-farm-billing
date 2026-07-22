import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { DocumentBuilder } from "@/components/DocumentBuilder";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title: "Quotations · Drock Enterprise" },
      { name: "description", content: "Create and manage customer quotations." },
      { property: "og:title", content: "Quotations · Drock Enterprise" },
      { property: "og:description", content: "Create and manage customer quotations." },
    ],
  }),
  component: QuotationsPage,
});

type Row = { id: string; number: string; total: number; status: string; created_at: string; customer: { name: string } | null };

function QuotationsPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [symbol, setSymbol] = useState("GH₵");
  const [vat, setVat] = useState(20);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function load() {
    const { data } = await supabase.from("quotations").select("id,number,total,status,created_at,customer:customers(name)").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    const { data: s } = await supabase.from("business_settings").select("currency_symbol,vat_rate").eq("id", 1).maybeSingle();
    if (s) { setSymbol(s.currency_symbol); setVat(Number(s.vat_rate)); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">Convert accepted quotations to invoices.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New quotation</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New quotation</DialogTitle></DialogHeader>
            <DocumentBuilder kind="quotation" userId={user?.id ?? ""} defaultVatRate={vat} symbol={symbol}
              onSaved={(id) => { setOpen(false); navigate({ to: "/quotations/$id", params: { id } }); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate({ to: "/quotations/$id", params: { id: r.id } })}>
                <TableCell className="font-medium"><Link to="/quotations/$id" params={{ id: r.id }}>{r.number}</Link></TableCell>
                <TableCell>{r.customer?.name ?? "—"}</TableCell>
                <TableCell>{formatDate(r.created_at)}</TableCell>
                <TableCell className="capitalize">{r.status}</TableCell>
                <TableCell className="text-right">{formatMoney(r.total, symbol)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No quotations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
