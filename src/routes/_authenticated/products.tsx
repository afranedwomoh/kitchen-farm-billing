import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { uploadToBucket, getSignedUrl } from "@/lib/storage-helper";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products & Stock · Drock Enterprise" },
      { name: "description", content: "Manage products, prices and stock levels for Drock Enterprise." },
      { property: "og:title", content: "Products & Stock · Drock Enterprise" },
      { property: "og:description", content: "Manage products, prices and stock levels." },
    ],
  }),
  component: ProductsPage,
});

type Product = {
  id: string; name: string; description: string | null; category: string | null; sku: string | null;
  price: number; quantity: number; image_url: string | null;
};

function ProductsPage() {
  const { isAdmin } = useSession();
  const [items, setItems] = useState<Product[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [symbol, setSymbol] = useState("GH₵");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Product[]);
    const map: Record<string, string> = {};
    await Promise.all((data ?? []).map(async (p) => {
      if (p.image_url) {
        const url = await getSignedUrl("product-images", p.image_url);
        if (url) map[p.id] = url;
      }
    }));
    setSigned(map);
    const { data: s } = await supabase.from("business_settings").select("currency_symbol").eq("id", 1).maybeSingle();
    if (s?.currency_symbol) setSymbol(s.currency_symbol);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  const filtered = items.filter((p) => (p.name + " " + (p.sku ?? "") + " " + (p.category ?? "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products & Stock</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Manage the product catalogue." : "Read-only view for workers."}</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          {isAdmin && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New product</Button></DialogTrigger>
              <ProductDialog product={editing} onSaved={() => { setOpen(false); setEditing(null); load(); }} />
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center">
              {signed[p.id] ? (
                <img src={signed[p.id]} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <PackageIcon className="h-10 w-10 text-muted-foreground/50" />
              )}
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.category || "Uncategorised"} · SKU {p.sku || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(p.price, symbol)}</div>
                  <div className={`text-xs ${p.quantity <= 5 ? "text-destructive" : "text-muted-foreground"}`}>{p.quantity} in stock</div>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No products yet.</p>}
      </div>
    </div>
  );
}

function ProductDialog({ product, onSaved }: { product: Product | null; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [quantity, setQuantity] = useState(String(product?.quantity ?? "0"));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      let image_url: string | null | undefined = undefined;
      if (file) image_url = await uploadToBucket("product-images", file, "");
      const payload = { name, description, category, sku, price: Number(price), quantity: Number(quantity), ...(image_url !== undefined ? { image_url } : {}) };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
      toast.success(product ? "Product updated" : "Product added");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kitchen / Agricultural" /></div>
          <div><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Unit price</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><Label>Quantity in stock</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><Label>Image</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy || !name}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
    </DialogContent>
  );
}
