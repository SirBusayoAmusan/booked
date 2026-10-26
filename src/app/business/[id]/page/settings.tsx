"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Business } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";

export function PageSettings({ business, pageUrl }: { business: Business; pageUrl: string }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: business.name,
    slug: business.slug,
    phone: business.phone ?? "",
    whatsapp_number: business.whatsapp_number ?? "",
    opening_hours: business.opening_hours ?? "",
    service_area: business.service_area ?? "",
    external_booking_url: business.external_booking_url ?? "",
    public_page_published: business.public_page_published,
    public_page_noindex: business.public_page_noindex,
    public_photos: business.public_photos ?? [],
  });
  const [contactOn, setContactOn] = useState(business.setup_checklist_state?.status?.contact_buttons !== "hidden");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoOk, setPhotoOk] = useState(false);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/business/${business.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          ...f,
          phone: f.phone || null,
          whatsapp_number: f.whatsapp_number || null,
          opening_hours: f.opening_hours || null,
          service_area: f.service_area || null,
        },
      }),
    });
    const checklist = (item: string, status: string) =>
      fetch(`/api/business/${business.id}/checklist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item, status }) });
    await checklist("contact_buttons", contactOn ? "done" : "hidden");
    if (f.public_page_published) await checklist("public_page_live", "done");
    setSaving(false);
    if (res.ok) {
      setMsg("Saved.");
      router.refresh();
    } else setMsg((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Your public page</h1>
        <p className="text-sm text-muted-foreground">
          A simple page with your services, photos and contact buttons. Use it as your link in bio, or as your mini site if you don&apos;t have a website. It won&apos;t
          necessarily show up on Google; that&apos;s up to Google.
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <CardTitle>Your link</CardTitle>
        <p className="break-all text-sm">{pageUrl}</p>
        <div className="flex gap-2">
          <CopyButton text={pageUrl} label="Copy link" />
          <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold">
            {business.public_page_published ? "Open" : "Preview"}
          </a>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <Checkbox label="Publish my page" checked={f.public_page_published} onChange={(e) => setF({ ...f, public_page_published: e.target.checked })} />
        <Checkbox label="Show Call, Text and WhatsApp buttons" checked={contactOn} onChange={(e) => setContactOn(e.target.checked)} />
        <Checkbox
          label="Hide from search engines (noindex)"
          checked={f.public_page_noindex}
          onChange={(e) => setF({ ...f, public_page_noindex: e.target.checked })}
        />
        <Label htmlFor="name">Business name</Label>
        <Input id="name" value={f.name} onChange={set("name")} />
        <Label htmlFor="slug">Page address</Label>
        <Input id="slug" value={f.slug} onChange={set("slug")} />
        <Label htmlFor="phone">Phone for Call and Text</Label>
        <Input id="phone" type="tel" value={f.phone} onChange={set("phone")} />
        <Label htmlFor="wa">WhatsApp number (optional)</Label>
        <Input id="wa" type="tel" value={f.whatsapp_number} onChange={set("whatsapp_number")} />
        <Label htmlFor="hours">Hours</Label>
        <Input id="hours" value={f.opening_hours} onChange={set("opening_hours")} />
        <Label htmlFor="area">Service area</Label>
        <Input id="area" value={f.service_area} onChange={set("service_area")} />
        <Label htmlFor="book">Booking link (Square, Jobber, Booksy, Fresha, Calendly…)</Label>
        <Input id="book" type="url" placeholder="https://" value={f.external_booking_url} onChange={set("external_booking_url")} />
        <p className="text-xs text-muted-foreground">With a booking link, your page shows a Book now button. Without one, people can call, text or send an enquiry.</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Photos</CardTitle>
        <CardDescription>Paste links to photos of your real work. Only add photos you have permission to show.</CardDescription>
        {f.public_photos.map((p, i) => (
          <div key={p.url} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <span className="flex-1 truncate text-sm">{p.url}</span>
            <Button variant="ghost" size="icon" aria-label="Remove photo" onClick={() => setF({ ...f, public_photos: f.public_photos.filter((_, j) => j !== i) })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Input type="url" placeholder="https://…/photo.jpg" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} aria-label="Photo link" />
        <Checkbox label="I have permission to show this photo" checked={photoOk} onChange={(e) => setPhotoOk(e.target.checked)} />
        <Button
          variant="outline"
          disabled={!photoUrl.startsWith("https://") || !photoOk || f.public_photos.length >= 12}
          onClick={() => {
            setF({ ...f, public_photos: [...f.public_photos, { url: photoUrl, caption: null }] });
            setPhotoUrl("");
            setPhotoOk(false);
          }}
        >
          <Plus className="h-4 w-4" /> Add photo
        </Button>
      </Card>

      {msg && <p className="text-sm" role="status">{msg}</p>}
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save page"}
      </Button>
    </div>
  );
}
