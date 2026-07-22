import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InvoiceDocument, type DocData } from "@/components/InvoiceDocument";
import { getSignedUrl, urlToDataUrl } from "@/lib/storage-helper";
import { exportNodeAsPdf, exportNodeAsPng } from "@/lib/export-invoice";
import { ArrowLeft, FileDown, ImageDown, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({
    meta: [
      { title: "Invoice · Drock Enterprise" },
      { name: "description", content: "View, download and manage this invoice." },
      { property: "og:title", content: "Invoice · Drock Enterprise" },
      { property: "og:description", content: "View, download and manage this invoice." },
    ],
  }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const [data, setData] = useState<DocData | null>(null);
  const [status, setStatus] = useState<string>("unpaid");
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
      kind: "INVOICE",
      number: q.number,
      date: q.created_at,
      status: q.status,
      business: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, logoUrl },
      customer: q.customer,
      items,
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/invoices" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={togglePaid}><Check className="h-4 w-4 mr-1" /> {status === "paid" ? "Mark unpaid" : "Mark paid"}</Button>
          <Button variant="outline" size="sm" onClick={() => ref.current && exportNodeAsPng(ref.current, `${data?.number}.png`)} disabled={!data}><ImageDown className="h-4 w-4 mr-1" /> PNG</Button>
          <Button size="sm" onClick={() => ref.current && exportNodeAsPdf(ref.current, `${data?.number}.pdf`)} disabled={!data}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </div>
      <div className="flex justify-center bg-muted/30 p-6 rounded-lg overflow-auto">
        {data && <InvoiceDocument ref={ref} data={data} />}
      </div>
    </div>
  );
}
