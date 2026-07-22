import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { uploadToBucket, getSignedUrl } from "@/lib/storage-helper";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Drock Enterprise" },
      { name: "description", content: "Business info, logo, VAT and team roles." },
      { property: "og:title", content: "Settings · Drock Enterprise" },
      { property: "og:description", content: "Business info, logo, VAT and team roles." },
    ],
  }),
  component: SettingsPage,
});

type Member = { id: string; email: string | null; full_name: string | null; role: "admin" | "worker" | null };

function SettingsPage() {
  const { isAdmin } = useSession();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [symbol, setSymbol] = useState("GH₵");
  const [currency, setCurrency] = useState("GHS");
  const [vat, setVat] = useState<number>(20);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
      if (s) {
        setName(s.name); setAddress(s.address ?? ""); setPhone(s.phone ?? ""); setEmail(s.email ?? "");
        setSymbol(s.currency_symbol); setCurrency(s.currency); setVat(Number(s.vat_rate));
        setLogoPath(s.logo_url ?? null);
        if (s.logo_url) setLogoPreview(await getSignedUrl("business-assets", s.logo_url));
      }
      const { data: profiles } = await supabase.from("profiles").select("id,email,full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      setMembers((profiles ?? []).map((p) => ({ ...p, role: (roleMap.get(p.id) as any) ?? null })));
    })();
  }, []);

  async function save() {
    setBusy(true);
    try {
      let newLogo = logoPath;
      if (file) newLogo = await uploadToBucket("business-assets", file, "logo/");
      const { error } = await supabase.from("business_settings").update({
        name, address, phone, email, currency, currency_symbol: symbol, vat_rate: vat,
        ...(file ? { logo_url: newLogo } : {}),
      }).eq("id", 1);
      if (error) throw error;
      toast.success("Settings saved");
      if (newLogo && file) {
        setLogoPath(newLogo);
        setLogoPreview(await getSignedUrl("business-assets", newLogo));
        setFile(null);
      }
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function setRole(userId: string, role: "admin" | "worker") {
    const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    // Ensure single role: delete other role
    await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", role);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    setMembers(members.map((m) => (m.id === userId ? { ...m, role } : m)));
  }

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Admins only.</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1></div>
      <Card>
        <CardHeader><CardTitle>Business info</CardTitle><CardDescription>These details appear on invoices and quotations.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Business name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div><Label>Address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Currency code</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
            <div><Label>Currency symbol</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
            <div><Label>Default VAT %</Label><Input type="number" value={vat} onChange={(e) => setVat(Number(e.target.value))} /></div>
          </div>
          <div>
            <Label>Business logo (used as watermark on invoices)</Label>
            <div className="flex items-center gap-4 mt-2">
              {logoPreview && <img src={logoPreview} alt="logo" className="h-16 w-16 object-contain border rounded p-1 bg-white" />}
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Team members & roles</CardTitle><CardDescription>Admins can view all sales and manage catalogue. Workers only see their own.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.full_name ?? "—"}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell className="capitalize">{m.role ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant={m.role === "admin" ? "default" : "outline"} onClick={() => setRole(m.id, "admin")}>Admin</Button>
                    <Button size="sm" variant={m.role === "worker" ? "default" : "outline"} onClick={() => setRole(m.id, "worker")}>Worker</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
