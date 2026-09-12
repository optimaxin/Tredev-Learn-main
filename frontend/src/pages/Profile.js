import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/** Self-service profile — the one screen a user edits their own details from.
 * Name and email are identity-owned (Firebase + admin-only) and stay read-only. */
export default function Profile() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [parampara, setParampara] = useState(user?.parampara || "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/users/me", { phone, bio, parampara });
      await refresh();
      toast.success(t("profile.saved"));
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <div className="eyebrow mb-3">{t("profile.title")}</div>
      <h1 className="text-4xl font-serif mb-2">{user.name}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t("profile.subtitle")}</p>

      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="eyebrow">{t("profile.name")}</label>
          <Input value={user.name} disabled className="mt-2 h-12" data-testid="profile-name" />
        </div>
        <div>
          <label className="eyebrow">{t("profile.email")}</label>
          <Input value={user.email} disabled className="mt-2 h-12" data-testid="profile-email" />
        </div>
        <p className="text-xs text-muted-foreground -mt-2">{t("profile.identityNotice")}</p>

        <div>
          <label className="eyebrow">{t("profile.phone")}</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder={t("profile.phonePlaceholder")} className="mt-2 h-12" data-testid="profile-phone" />
        </div>
        <div>
          <label className="eyebrow">{t("profile.bio")}</label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder={t("profile.bioPlaceholder")} className="mt-2" data-testid="profile-bio" />
        </div>
        {(user.role === "acharya" || parampara) && (
          <div>
            <label className="eyebrow">{t("profile.parampara")}</label>
            <Input value={parampara} onChange={(e) => setParampara(e.target.value)}
              placeholder={t("profile.paramparaPlaceholder")} className="mt-2 h-12" data-testid="profile-parampara" />
          </div>
        )}

        <Button type="submit" disabled={saving} className="w-full h-12 rounded-full" data-testid="profile-save">
          {saving ? t("profile.saving") : t("profile.save")}
        </Button>
      </form>
    </div>
  );
}
