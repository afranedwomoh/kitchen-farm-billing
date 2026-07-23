import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileDown, ImageDown, ArrowRightCircle, Pencil, Trash2 } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { DocumentBuilder, type EditInitial } from "@/components/DocumentBuilder";
import { InvoiceDocument, type DocData } from "@/components/InvoiceDocument";
import { getSignedUrl, urlToDataUrl } from "@/lib/storage-helper";
import { exportNodeAsPdf, exportNodeAsPng } from "@/lib/export-invoice";
import { useSession } from "@/hooks/useSession";
import { toast } from "sonner";

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
  const { user, isAdmin } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [symbol, setSymbol] = useState("GH₵");
  const [vat, setVat] = useState(20);
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();

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
              onSaved={async (id) => { setOpen(false); await router.invalidate(); await load(); setViewId(id); }} />
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
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewId(r.id)}>
                <TableCell className="font-medium">{r.number}</TableCell>
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
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          {viewId && (
            <QuotationPreview
              id={viewId}
              isAdmin={isAdmin}
              userId={user?.id ?? ""}
              defaultVatRate={vat}
              symbol={symbol}
              onConverted={() => { setViewId(null); navigate({ to: "/invoices" }); }}
              onDeleted={() => { setViewId(null); load(); }}
              onUpdated={() => { load(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fileBaseName(data: DocData | null) {
  if (!data) return "document";
  const kindLabel = data.kind === "INVOICE" ? "Invoice" : "Quotation";
  const custName = data.customer?.name?.trim() || "Customer";
  return `${custName} - ${kindLabel}`;
}

function QuotationPreview({ id, isAdmin, userId, defaultVatRate, symbol, onConverted, onDeleted, onUpdated }: {
  id: string; isAdmin: boolean; userId: string; defaultVatRate: number; symbol: string;
  onConverted: (invoiceId: string) => void; onDeleted: () => void; onUpdated: () => void;
}) {
  const [data, setData] = useState<DocData | null>(null);
  const [converted, setConverted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<EditInitial | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    const { data: q, error } = await supabase.from("quotations")
      .select("*, customer:customers(*), items:quotation_items(*)").eq("id", id).single();
    if (error) return toast.error(error.message);
    const { data: settings } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings) return;
    const logoUrl = settings.logo_url ? await getSignedUrl("business-assets", settings.logo_url).then((u) => (u ? urlToDataUrl(u) : null)) : null;
    const items = await Promise.all((q.items ?? []).map(async (it: any) => ({
      product_name: it.product_name,
      product_image_url_signed: it.product_image_url ? await getSignedUrl("product-images", it.product_image_url).then((u) => (u ? urlToDataUrl(u) : null)) : null,
      unit_price: Number(it.unit_price), quantity: it.quantity, line_total: Number(it.line_total),
    })));
    setConverted(q.converted_invoice_id ?? null);
    setData({
      kind: "QUOTATION", number: q.number, date: q.created_at,
      business: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, logoUrl },
      customer: q.customer, items,
      subtotal: Number(q.subtotal), vat_rate: Number(q.vat_rate), vat_amount: Number(q.vat_amount), total: Number(q.total),
      currency_symbol: settings.currency_symbol, notes: q.notes,
    });
    setEditInitial({
      editId: q.id,
      customerId: q.customer_id,
      lines: (q.items ?? []).map((it: any) => ({
        product_id: it.product_id, product_name: it.product_name, product_image_url: it.product_image_url,
        unit_price: Number(it.unit_price), quantity: it.quantity,
      })),
      applyVat: Number(q.vat_rate) > 0,
      vatRate: Number(q.vat_rate) || defaultVatRate,
      notes: q.notes ?? "",
    });
  }

  async function convert() {
    if (!data) return;
    setBusy(true);
    try {
      const { data: q } = await supabase.from("quotations").select("*, items:quotation_items(*)").eq("id", id).single();
      if (!q) throw new Error("Missing quotation");
      const { data: user } = await supabase.auth.getUser();
      const { data: inv, error } = await supabase.from("invoices").insert({
        customer_id: q.customer_id, created_by: user.user!.id,
        subtotal: q.subtotal, vat_rate: q.vat_rate, vat_amount: q.vat_amount, total: q.total,
        notes: q.notes, from_quotation_id: q.id,
      }).select("id").single();
      if (error) throw error;
      const items = (q.items ?? []).map((it: any) => ({
        invoice_id: inv.id, product_id: it.product_id, product_name: it.product_name,
        product_image_url: it.product_image_url, unit_price: it.unit_price, quantity: it.quantity, line_total: it.line_total,
      }));
      const { error: ie } = await supabase.from("invoice_items").insert(items);
      if (ie) throw ie;
      await supabase.from("quotations").update({ status: "converted", converted_invoice_id: inv.id }).eq("id", id);
      toast.success("Converted to invoice");
      onConverted(inv.id);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("Delete this quotation? This cannot be undone.")) return;
    const { error } = await supabase.from("quotations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Quotation deleted");
    onDeleted();
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap gap-2 justify-end border-b pb-3">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
        </div>
      )}
      <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto max-h-[60vh]">
        {data && <InvoiceDocument ref={ref} data={data} />}
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => ref.current && exportNodeAsPng(ref.current, `${fileBaseName(data)}.png`)} disabled={!data}><ImageDown className="h-4 w-4 mr-1" /> PNG</Button>
        <Button variant="outline" size="sm" onClick={() => ref.current && exportNodeAsPdf(ref.current, `${fileBaseName(data)}.pdf`)} disabled={!data}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
        {!converted && <Button size="sm" onClick={convert} disabled={busy || !data}><ArrowRightCircle className="h-4 w-4 mr-1" /> Convert to invoice</Button>}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit quotation</DialogTitle></DialogHeader>
          {editInitial && (
            <DocumentBuilder kind="quotation" userId={userId} defaultVatRate={defaultVatRate} symbol={symbol}
              initial={editInitial}
              onSaved={async () => { setEditOpen(false); await load(); onUpdated(); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
