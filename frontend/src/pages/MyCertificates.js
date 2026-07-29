import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import CertificateModal from "@/components/CertificateDoc";

export default function MyCertificates() {
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [viewing, setViewing] = useState(null);
  useEffect(() => { if (user) api.get("/certificates/mine").then((r)=>setCerts(r.data)); }, [user?.id]);

  return (
    <div className="site-container py-16">
      <div className="overline mb-3">My credentials</div>
      <h1 className="text-5xl font-serif tracking-tight mb-10">Certificates.</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {certs.map((c) => (
          <div key={c.id}
            className="rounded-lg border border-border p-10 bg-card/60 relative overflow-hidden"
            data-testid={`mycert-${c.code}`}>
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
            <div className="overline text-primary mb-3">Certificate of Study</div>
            <div className="font-serif text-2xl leading-tight">{c.offering_title}</div>
            <div className="mt-4 text-sm text-muted-foreground">Awarded to <strong className="text-foreground">{c.user_name}</strong></div>
            {c.acharya_name && <div className="text-sm text-muted-foreground">Signed by Ācharya <strong className="text-foreground">{c.acharya_name}</strong></div>}
            <div className="mt-6 font-mono text-xs text-muted-foreground">{c.code}</div>
            {c.revoked && <Badge variant="destructive" className="mt-3">Revoked</Badge>}
            <div className="mt-6 flex gap-3">
              <Button onClick={()=>setViewing(c)} className="rounded-full bg-gradient-hot text-white border-0" data-testid={`mycert-download-${c.code}`}>
                <Download className="w-4 h-4 mr-2" /> View / Download
              </Button>
              <Link to={`/verify/${c.code}`} className="text-primary link-underline text-sm self-center">Verify →</Link>
            </div>
          </div>
        ))}
        {certs.length === 0 && (
          <div className="col-span-full text-center py-20 text-muted-foreground text-sm">
            Complete a course to earn your first credential.
          </div>
        )}
      </div>
      <CertificateModal cert={viewing} onClose={()=>setViewing(null)} />
    </div>
  );
}
