import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Check, FileDown, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { DocumentBuilder } from "@/components/DocumentBuilder";
import { InvoiceDocument, type DocData } from "@/components/InvoiceDocument";
import { getSignedUrl, urlToDataUrl } from "@/lib/storage-helper";
import { exportNodeAsPdf, exportNodeAsPng } from "@/lib/export-invoice";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices · Drock Enterprise" },
      { name: "description", content: "Create, download and track paid/unpaid invoices." },
      { property: "og:title", content: "Invoices · Drock Enterprise" },
      { property: "og:description", content: "Create, download and track paid/unpaid invoices." },
    ],
  }),
  component: InvoicesPage,
});

type Row = { id: string; number: string; total: number; status: string; created_at: string; customer: { name: string } | null };

function InvoicesPage() {
  const { user, isAdmin } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [symbol, setSymbol] = useState("GH₵");
  const [vat, setVat] = useState(20);
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    const { data } = await supabase.from("invoices").select("id,number,total,status,created_at,customer:customers(name)").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    const { data: s } = await supabase.from("business_settings").select("currency_symbol,vat_rate").eq("id", 1).maybeSingle();
    if (s) { setSymbol(s.currency_symbol); setVat(Number(s.vat_rate)); }
  }
  useEffect(() => { load(); }, []);

  async function togglePaid(id: string, current: string) {
    const next = current === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("invoices").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${next}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "All sales across the business." : "Your sales only."}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New invoice</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
            <DocumentBuilder kind="invoice" userId={user?.id ?? ""} defaultVatRate={vat} symbol={symbol}
              onSaved={async (id) => { setOpen(false); await router.invalidate(); await load(); setViewId(id); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setViewId(r.id)}>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell>{r.customer?.name ?? "—"}</TableCell>
                <TableCell>{formatDate(r.created_at)}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {r.status.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatMoney(r.total, symbol)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); togglePaid(r.id, r.status); }}>
                    <Check className="h-3 w-3 mr-1" /> {r.status === "paid" ? "Mark unpaid" : "Mark paid"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          {viewId && <InvoicePreview id={viewId} onStatusChanged={load} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoicePreview({ id, onStatusChanged }: { id: string; onStatusChanged: () => void }) {
  const [data, setData] = useState<DocData | null>(null);
  const [status, setStatus] = useState<string>("unpaid");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    const { data: q, error } = await supabase.from("invoices")
      .select("*, customer:customers(*), items:invoice_items(*)").eq("id", id).single();
    if (error) return toast.error(error.message);
    const { data: settings } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings) return;
    const logoUrl = settings.logo_url ? await getSignedUrl("business-assets", settings.logo_url).then((u) => (u ? urlToDataUrl(u) : null)) : null;
    const items = await Promise.all((q.items ?? []).map(async (it: any) => ({
      product_name: it.product_name,
      product_image_url_signed: it.product_image_url ? await getSignedUrl("product-images", it.product_image_url).then((u) => (u ? urlToDataUrl(u) : null)) : null,
      unit_price: Number(it.unit_price), quantity: it.quantity, line_total: Number(it.line_total),
    })));
    setStatus(q.status);
    setData({
      kind: "INVOICE", number: q.number, date: q.created_at, status: q.status,
      business: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, logoUrl },
      customer: q.customer, items,
      subtotal: Number(q.subtotal), vat_rate: Number(q.vat_rate), vat_amount: Number(q.vat_amount), total: Number(q.total),
      currency_symbol: settings.currency_symbol, notes: q.notes,
    });
  }

  async function togglePaid() {
    const next = status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("invoices").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${next}`);
    load();
    onStatusChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto max-h-[60vh]">
        {data && <InvoiceDocument ref={ref} data={data} />}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={togglePaid} disabled={!data}><Check className="h-4 w-4 mr-1" /> {status === "paid" ? "Mark unpaid" : "Mark paid"}</Button>
        <Button variant="outline" size="sm" onClick={() => ref.current && exportNodeAsPng(ref.current, `${data?.number}.png`)} disabled={!data}><ImageDown className="h-4 w-4 mr-1" /> PNG</Button>
        <Button size="sm" onClick={() => ref.current && exportNodeAsPdf(ref.current, `${data?.number}.pdf`)} disabled={!data}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
      </div>
    </div>
  );
}
