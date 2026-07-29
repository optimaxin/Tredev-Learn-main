import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { uploadCourseMedia } from "@/lib/upload";
import { Save, UploadCloud, Globe, EyeOff } from "lucide-react";

const TYPES = ["masterclass","webinar","workshop","recorded_course","live_course","sadhana","ebook"];

/** Edit an existing offering's details + cover image, and publish/unpublish it. */
export default function OfferingEditor({ offering, onSaved }) {
  const [f, setF] = useState({
    title: offering.title || "", subtitle: offering.subtitle || "",
    description: offering.description || "", subject: offering.subject || "",
    type: offering.type || "recorded_course", duration: offering.duration || "",
    price_inr: offering.price_inr || 0, price_usd: offering.price_usd || 0,
    image_url: offering.image_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [coverPct, setCoverPct] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const set = (p) => setF((s) => ({ ...s, ...p }));

  const onCover = async (file) => {
    if (!file) return;
    setCoverPct(0);
    try {
      const { public_url } = await uploadCourseMedia(file, setCoverPct);
      set({ image_url: public_url });
      toast.success("Cover image uploaded.");
    } catch (e) { toast.error(formatApiError(e) || e.message || "Upload failed"); }
    setCoverPct(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/offerings/${offering.id}`, {
        ...f, price_inr: parseInt(f.price_inr || 0), price_usd: parseInt(f.price_usd || 0),
      });
      toast.success("Course details saved.");
      onSaved && onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const setPublished = async (val) => {
    setPublishing(true);
    try {
      await api.patch(`/offerings/${offering.id}`, { is_published: val });
      toast.success(val ? "Published — now live in the Courses section." : "Unpublished — hidden from learners.");
      onSaved && onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
    setPublishing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-background/50 p-5 space-y-4" data-testid={`offering-editor-${offering.id}`}>
      <h4 className="font-display font-semibold">Course details</h4>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="overline">Title</label>
          <Input value={f.title} onChange={(e)=>set({title:e.target.value})} className="mt-2 h-11" data-testid={`edit-title-${offering.id}`} />
        </div>
        <div className="md:col-span-2">
          <label className="overline">Subtitle</label>
          <Input value={f.subtitle} onChange={(e)=>set({subtitle:e.target.value})} className="mt-2 h-11" />
        </div>
        <div className="md:col-span-2">
          <label className="overline">Description</label>
          <Textarea value={f.description} onChange={(e)=>set({description:e.target.value})} className="mt-2 min-h-[90px]" />
        </div>
        <div>
          <label className="overline">Type</label>
          <Select value={f.type} onValueChange={(v)=>set({type:v})}>
            <SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t=><SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="overline">Subject</label>
          <Input value={f.subject} onChange={(e)=>set({subject:e.target.value})} className="mt-2 h-11" />
        </div>
        <div>
          <label className="overline">Duration</label>
          <Input value={f.duration} onChange={(e)=>set({duration:e.target.value})} className="mt-2 h-11" placeholder="e.g. 8-week cohort" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="overline">Price (INR)</label>
            <Input type="number" value={f.price_inr} onChange={(e)=>set({price_inr:e.target.value})} className="mt-2 h-11" data-testid={`edit-price-${offering.id}`} />
          </div>
          <div>
            <label className="overline">Price (USD)</label>
            <Input type="number" value={f.price_usd} onChange={(e)=>set({price_usd:e.target.value})} className="mt-2 h-11" />
          </div>
        </div>
      </div>

      {/* Cover image */}
      <div>
        <label className="overline">Cover image / thumbnail</label>
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          {f.image_url
            ? <img src={f.image_url} alt="cover" className="w-40 h-24 rounded-lg object-cover border border-border" />
            : <div className="w-40 h-24 rounded-lg border border-dashed border-border grid place-items-center text-xs text-muted-foreground">No cover</div>}
          <label className="inline-flex items-center gap-2 text-sm rounded-full border border-border px-4 h-10 cursor-pointer hover:bg-muted transition-colors">
            <UploadCloud className="w-4 h-4" />
            {f.image_url ? "Replace image" : "Upload image"}
            <input type="file" accept="image/*" className="hidden" onChange={(e)=>onCover(e.target.files?.[0])} data-testid={`edit-cover-${offering.id}`} />
          </label>
          {coverPct != null && <span className="text-xs text-primary tabular">Uploading… {coverPct}%</span>}
        </div>
        <Input value={f.image_url} onChange={(e)=>set({image_url:e.target.value})} className="mt-2 h-10" placeholder="…or paste an image URL" />
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <Button size="sm" onClick={save} disabled={saving} className="rounded-full bg-gradient-hot text-white border-0" data-testid={`edit-save-${offering.id}`}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save details"}
        </Button>

        {/* Publish control — gated on Ācharya sign-off */}
        {!offering.approved_by_acharya ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Publish after Ācharya sign-off</Badge>
        ) : offering.is_published ? (
          <Button size="sm" variant="outline" onClick={()=>setPublished(false)} disabled={publishing} className="rounded-full" data-testid={`unpublish-${offering.id}`}>
            <EyeOff className="w-4 h-4 mr-1" /> Unpublish
          </Button>
        ) : (
          <Button size="sm" onClick={()=>setPublished(true)} disabled={publishing} className="rounded-full bg-primary text-primary-foreground border-0" data-testid={`publish-${offering.id}`}>
            <Globe className="w-4 h-4 mr-1" /> Publish to Courses
          </Button>
        )}
        {offering.is_published && <span className="inline-flex items-center gap-1 text-xs text-primary"><Globe className="w-3.5 h-3.5" /> Live in Courses</span>}
      </div>
    </div>
  );
}
