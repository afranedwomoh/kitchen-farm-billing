import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

type Line = { product_id: string | null; product_name: string; product_image_url: string | null; unit_price: number; quantity: number };
type Product = { id: string; name: string; price: number; image_url: string | null; quantity: number };
type Customer = { id: string; name: string };

export function DocumentBuilder({ kind, userId, defaultVatRate, symbol, onSaved }: {
  kind: "quotation" | "invoice";
  userId: string;
  defaultVatRate: number;
  symbol: string;
  onSaved: (id: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [applyVat, setApplyVat] = useState(true);
  const [vatRate, setVatRate] = useState(defaultVatRate);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from("products").select("id,name,price,image_url,quantity").order("name"),
        supabase.from("customers").select("id,name").order("name"),
      ]);
      setProducts((p ?? []) as Product[]);
      setCustomers((c ?? []) as Customer[]);
    })();
  }, []);

  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.unit_price * l.quantity, 0), [lines]);
  const vatAmount = applyVat ? subtotal * (Number(vatRate) / 100) : 0;
  const total = subtotal + vatAmount;

  function addLine() {
    setLines([...lines, { product_id: null, product_name: "", product_image_url: null, unit_price: 0, quantity: 1 }]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateLine(i, { product_id: p.id, product_name: p.name, product_image_url: p.image_url, unit_price: Number(p.price) });
  }
  function removeLine(i: number) { setLines(lines.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!customerId) return toast.error("Pick a customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    setBusy(true);
    try {
      const header = {
        customer_id: customerId,
        created_by: userId,
        subtotal,
        vat_rate: applyVat ? Number(vatRate) : 0,
        vat_amount: vatAmount,
        total,
        notes,
      };
      if (kind === "quotation") {
        const { data: q, error } = await supabase.from("quotations").insert(header).select("id").single();
        if (error) throw error;
        const items = lines.map((l) => ({ ...l, quotation_id: q.id, line_total: l.unit_price * l.quantity }));
        const { error: ie } = await supabase.from("quotation_items").insert(items);
        if (ie) throw ie;
        toast.success("Quotation created");
        onSaved(q.id);
      } else {
        const { data: inv, error } = await supabase.from("invoices").insert(header).select("id").single();
        if (error) throw error;
        const items = lines.map((l) => ({ ...l, invoice_id: inv.id, line_total: l.unit_price * l.quantity }));
        const { error: ie } = await supabase.from("invoice_items").insert(items);
        if (ie) throw ie;
        toast.success("Invoice created");
        onSaved(inv.id);
      }
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
            <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Label>VAT %</Label>
            <Input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} disabled={!applyVat} />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={applyVat} onCheckedChange={setApplyVat} />
            <span className="text-sm">Apply VAT</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add item</Button>
        </div>
        <div className="border rounded-md divide-y">
          {lines.map((l, i) => (
            <div key={i} className="p-3 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Label className="text-xs">Product</Label>
                <Select value={l.product_id ?? ""} onValueChange={(v) => pickProduct(i, v)}>
                  <SelectTrigger><SelectValue placeholder="Pick product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · stock {p.quantity}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Unit price</Label>
                <Input type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Qty</Label>
                <Input type="number" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
              </div>
              <div className="col-span-1 text-right text-sm">{formatMoney(l.unit_price * l.quantity, symbol)}</div>
              <div className="col-span-1 text-right">
                <Button variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          {lines.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No items yet.</div>}
        </div>
      </div>

      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" /></div>

      <div className="rounded-md border p-4 space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal, symbol)}</span></div>
        <div className="flex justify-between"><span>VAT ({applyVat ? vatRate : 0}%)</span><span>{formatMoney(vatAmount, symbol)}</span></div>
        <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span>{formatMoney(total, symbol)}</span></div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : `Create ${kind}`}</Button>
      </div>
    </div>
  );
}
