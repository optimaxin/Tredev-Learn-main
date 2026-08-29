import React, { useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Search } from "lucide-react";

export default function CertificateVerify() {
  const { code: initialCode } = useParams();
  const [code, setCode] = useState(initialCode || "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const verify = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.get(`/certificates/verify/${code.trim()}`);
      setResult(data);
    } catch { setResult({ valid: false, message: "Error verifying" }); }
    setBusy(false);
  };
  React.useEffect(() => { if (initialCode) verify(); /* eslint-disable-next-line */ }, [initialCode]);

  return (
    <div className="max-w-3xl mx-auto py-24 px-6">
      <div className="eyebrow mb-3">Public verification</div>
      <h1 className="text-5xl font-serif mb-4">Verify a certificate.</h1>
      <p className="text-foreground/70 mb-10">Every Tredev Learn certificate has a public verification page. A revoked certificate says so, rather than vanishing.</p>
      <form onSubmit={verify} className="flex gap-3">
        <Input value={code} onChange={(e)=>setCode(e.target.value)} placeholder="TDL-XXXX-YYYY"
          data-testid="verify-input" className="h-12 flex-1 font-mono" />
        <Button type="submit" disabled={busy} data-testid="verify-submit" className="rounded-full px-6 h-12">
          <Search className="w-4 h-4 mr-2" />Verify
        </Button>
      </form>

      {result && (
        <div className="mt-10 rounded-lg border border-border p-10 bg-card/60" data-testid="verify-result">
          {result.valid ? (
            <>
              <div className="flex items-center gap-3 mb-4"><CheckCircle2 className="w-8 h-8 text-primary" /><Badge className="bg-primary text-primary-foreground">Valid</Badge></div>
              <h2 className="font-serif text-3xl">{result.certificate.offering_title}</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div><span className="eyebrow mr-3">Awarded to</span> <strong>{result.certificate.user_name}</strong></div>
                {result.certificate.acharya_name && <div><span className="eyebrow mr-3">Signed by Ācharya</span> {result.certificate.acharya_name}</div>}
                <div><span className="eyebrow mr-3">Code</span> <span className="font-mono">{result.certificate.code}</span></div>
                <div><span className="eyebrow mr-3">Issued</span> {new Date(result.certificate.issued_at).toLocaleDateString()}</div>
              </div>
            </>
          ) : result.revoked ? (
            <>
              <div className="flex items-center gap-3 mb-4"><XCircle className="w-8 h-8 text-destructive" /><Badge variant="destructive">Revoked</Badge></div>
              <h2 className="font-serif text-2xl">{result.certificate?.offering_title}</h2>
              <p className="mt-2 text-muted-foreground">This certificate has been revoked.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4"><XCircle className="w-8 h-8 text-muted-foreground" /><Badge variant="outline">Not found</Badge></div>
              <p className="text-muted-foreground">{result.message}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
