import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import CertificateModal from "@/components/CertificateDoc";

const IN_PROGRESS_STATUS_KEY = {
  requested: "statusRequested",
  pending_signature: "statusPendingSignature",
  rejected: "statusRejected",
};

export default function MyCertificates() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [inProgress, setInProgress] = useState([]);
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    if (!user) return;
    api.get("/certificates/mine").then((r)=>setCerts(Array.isArray(r.data) ? r.data : [])).catch(() => setCerts([]));
    api.get("/certificates/mine-all").then((r)=>{
      const all = Array.isArray(r.data) ? r.data : [];
      setInProgress(all.filter((c) => (c.signature_status || "published") !== "published"));
    }).catch(() => setInProgress([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="site-container py-16">
      <div className="eyebrow mb-3">{t("myCertificates.heading")}</div>
      <h1 className="text-5xl font-serif tracking-tight mb-10">{t("myCertificates.title")}</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {certs.map((c) => (
          <div key={c.id}
            className="rounded-lg border border-border p-10 bg-card/60 relative overflow-hidden"
            data-testid={`mycert-${c.code}`}>
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
            <div className="eyebrow text-primary mb-3">{t("myCertificates.certOfStudy")}</div>
            <div className="font-serif text-2xl leading-tight">{c.offering_title}</div>
            <div className="mt-4 text-sm text-muted-foreground">{t("myCertificates.awardedTo")} <strong className="text-foreground">{c.user_name}</strong></div>
            {c.acharya_name && <div className="text-sm text-muted-foreground">{t("myCertificates.signedBy")} <strong className="text-foreground">{c.acharya_name}</strong></div>}
            <div className="mt-6 font-mono text-xs text-muted-foreground">{c.code}</div>
            {c.revoked && <Badge variant="destructive" className="mt-3">{t("myCertificates.revoked")}</Badge>}
            <div className="mt-6 flex gap-3">
              <Button onClick={()=>setViewing(c)} className="rounded-full bg-gradient-hot text-white border-0" data-testid={`mycert-download-${c.code}`}>
                <Download className="w-4 h-4 mr-2" /> {t("myCertificates.viewDownload")}
              </Button>
              <Link to={`/verify/${c.code}`} className="text-primary link-underline text-sm self-center">{t("myCertificates.verify")} →</Link>
            </div>
          </div>
        ))}
        {certs.length === 0 && inProgress.length === 0 && (
          <div className="col-span-full text-center py-20 text-muted-foreground text-sm">
            {t("myCertificates.empty")}
          </div>
        )}
      </div>

      {inProgress.length > 0 && (
        <div className="mt-10">
          <div className="eyebrow mb-3">{t("myCertificates.inProgressHeading")}</div>
          <div className="space-y-2">
            {inProgress.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-4 flex items-center justify-between text-sm" data-testid={`mycert-progress-${c.code}`}>
                <span>{c.offering_title}</span>
                <span className={`text-xs ${c.signature_status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                  {t(`myCertificates.${IN_PROGRESS_STATUS_KEY[c.signature_status] || "statusRequested"}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <CertificateModal cert={viewing} onClose={()=>setViewing(null)} />
    </div>
  );
}
