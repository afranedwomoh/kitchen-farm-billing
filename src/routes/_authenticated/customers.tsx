import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers · Drock Enterprise" },
      { name: "description", content: "Manage customer records for Drock Enterprise." },
      { property: "og:title", content: "Customers · Drock Enterprise" },
      { property: "og:description", content: "Manage customer records." },
    ],
  }),
  component: CustomersPage,
});

type Customer = { id: string; name: string; phone: string | null; email: string | null; address: string | null; created_by: string | null };

function CustomersPage() {
  const { user, isAdmin } = useSession();
  const [items, setItems] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Customer[]);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Delete this customer?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">All customer records are visible to everyone.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New customer</Button></DialogTrigger>
          <CustomerDialog customer={editing} userId={user?.id ?? ""} onSaved={() => { setOpen(false); setEditing(null); load(); }} />
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Address</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const canEdit = isAdmin || c.created_by === user?.id;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{c.address || "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>}
                    {isAdmin && <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No customers yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CustomerDialog({ customer, userId, onSaved }: { customer: Customer | null; userId: string; onSaved: () => void }) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const payload = { name, phone, email, address };
      if (customer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div><Label>Address</Label><Textarea value={address ?? ""} onChange={(e) => setAddress(e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy || !name}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
    </DialogContent>
  );
}
