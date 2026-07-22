import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InvoiceDocument, type DocData } from "@/components/InvoiceDocument";
import { getSignedUrl, urlToDataUrl } from "@/lib/storage-helper";
import { exportNodeAsPdf, exportNodeAsPng } from "@/lib/export-invoice";
import { ArrowLeft, FileDown, ImageDown, ArrowRightCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quotations/$id")({
  head: () => ({
    meta: [
      { title: "Quotation · Drock Enterprise" },
      { name: "description", content: "View, export or convert this quotation." },
      { property: "og:title", content: "Quotation · Drock Enterprise" },
      { property: "og:description", content: "View, export or convert this quotation." },
    ],
  }),
  component: QuotationDetail,
});

function QuotationDetail() {
  const { id } = Route.useParams();
  const [data, setData] = useState<DocData | null>(null);
  const [convertingBusy, setConvertingBusy] = useState(false);
  const [converted, setConverted] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
      kind: "QUOTATION",
      number: q.number,
      date: q.created_at,
      business: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, logoUrl },
      customer: q.customer,
      items,
      subtotal: Number(q.subtotal), vat_rate: Number(q.vat_rate), vat_amount: Number(q.vat_amount), total: Number(q.total),
      currency_symbol: settings.currency_symbol, notes: q.notes,
    });
  }

  async function convert() {
    if (!data) return;
    setConvertingBusy(true);
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
      navigate({ to: "/invoices/$id", params: { id: inv.id } });
    } catch (e: any) { toast.error(e.message); } finally { setConvertingBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/quotations" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => ref.current && exportNodeAsPng(ref.current, `${data?.number}.png`)} disabled={!data}><ImageDown className="h-4 w-4 mr-1" /> PNG</Button>
          <Button variant="outline" size="sm" onClick={() => ref.current && exportNodeAsPdf(ref.current, `${data?.number}.pdf`)} disabled={!data}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          {!converted && <Button size="sm" onClick={convert} disabled={convertingBusy || !data}><ArrowRightCircle className="h-4 w-4 mr-1" /> Convert to invoice</Button>}
          {converted && <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/invoices/$id", params: { id: converted } })}>View invoice</Button>}
        </div>
      </div>
      <div className="flex justify-center bg-muted/30 p-6 rounded-lg overflow-auto">
        {data && <InvoiceDocument ref={ref} data={data} />}
      </div>
    </div>
  );
}
