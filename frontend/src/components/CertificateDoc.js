import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

/** Reserved placeholder box for logos / signatures to be supplied later. */
function Slot({ label, src, className = "" }) {
  return src ? (
    <img src={src} alt={label} className={`object-contain ${className}`} />
  ) : (
    <div className={`grid place-items-center rounded-md border border-dashed border-amber-700/40 text-[8px] uppercase tracking-widest text-amber-800/50 text-center leading-tight px-1 ${className}`}>
      {label}
    </div>
  );
}

/** Small gold diamond corner mark — the four appear at each corner of the outer frame. */
function CornerMark({ className }) {
  return <div className={`absolute w-2.5 h-2.5 border-2 border-amber-600 rotate-45 ${className}`} />;
}

/**
 * The certificate document itself — ivory/gold "certificate of completion"
 * styled, print-ready, with reserved slots for the Tredev Learnings logo,
 * Tredev Gems logo, and the head Pandit's signature. Pass logo/sign image
 * URLs later to fill the reserved space.
 */
export function CertificateDoc({ cert, logos = {} }) {
  const issued = cert.issued_at ? new Date(cert.issued_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";
  return (
    <div className="cert-print-area bg-[#faf5e6] text-amber-950 w-full max-w-[900px] aspect-[1.414/1] mx-auto relative p-[3%] overflow-hidden rounded-sm [container-type:inline-size]">
      {/* Ornamental frame */}
      <div className="absolute inset-[1.4%] border-2 border-amber-700/70 rounded-sm" />
      <div className="absolute inset-[2.1%] border border-amber-700/35 rounded-sm" />
      <CornerMark className="top-[1.1%] left-[1.1%]" />
      <CornerMark className="top-[1.1%] right-[1.1%]" />
      <CornerMark className="bottom-[1.1%] left-[1.1%]" />
      <CornerMark className="bottom-[1.1%] right-[1.1%]" />

      <div className="relative h-full flex flex-col items-center text-center px-[6%] py-[4%]">
        {/* Top: logos flank the wordmark */}
        <div className="w-full flex items-start justify-between gap-2">
          <Slot label="Tredev Learnings logo" src={logos.learnings} className="w-[clamp(2rem,8cqw,3.5rem)] h-[clamp(2rem,8cqw,3.5rem)] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[clamp(0.85rem,3cqw,1.25rem)] tracking-[0.15em] text-amber-900">TREDEVA LEARN</div>
            <div className="text-[8px] uppercase tracking-[0.3em] text-amber-800/70 mt-1">वेद विद्या · a credential worth holding</div>
          </div>
          <Slot label="Tredev Gems logo" src={logos.gems} className="w-[clamp(2rem,8cqw,3.5rem)] h-[clamp(2rem,8cqw,3.5rem)] shrink-0" />
        </div>

        <div className="font-display font-bold uppercase tracking-[0.06em] text-[clamp(1rem,4cqw,1.5rem)] text-amber-900 mt-[3%]">
          Certificate <span className="italic font-normal lowercase">of</span> Completion
        </div>

        <div className="mt-[3%] text-[10px] uppercase tracking-[0.3em] text-amber-800/70">This is to certify that</div>
        <div className="font-display font-bold text-[clamp(1.35rem,6cqw,2.25rem)] text-amber-950 mt-1">{cert.user_name}</div>

        <div className="mt-[2.5%] text-[10px] uppercase tracking-[0.3em] text-amber-800/70">has successfully completed the course</div>
        <div className="font-display font-bold uppercase tracking-wide text-[clamp(0.9rem,3.2cqw,1.25rem)] text-amber-900 mt-1">{cert.offering_title}</div>

        {/* Seal + Signatures */}
        <div className="mt-auto w-full flex items-end justify-between gap-6 pt-[3%]">
          <div className="flex-1 text-center">
            <div className="font-editorial italic text-[clamp(0.8rem,3cqw,1.125rem)] text-amber-900 border-b border-amber-800/40 pb-1 min-h-[2rem]">{cert.signature_name || cert.acharya_name}</div>
            <div className="text-[9px] uppercase tracking-widest text-amber-800/70 mt-1">Ācharya · signed for accuracy</div>
          </div>
          <div className="w-[clamp(2.25rem,9cqw,4rem)] h-[clamp(2.25rem,9cqw,4rem)] rounded-full bg-gradient-to-br from-amber-500 to-amber-700 grid place-items-center text-amber-50 shadow-lg shrink-0 mb-1">
            <span className="font-devanagari text-[clamp(1rem,4cqw,1.5rem)]">ॐ</span>
          </div>
          <div className="flex-1 text-center">
            <Slot label="Head Pandit's signature" src={logos.panditSign} className="h-[clamp(1.75rem,7cqw,2.5rem)] w-full border-b-0" />
            <div className="border-b border-amber-800/40" />
            <div className="text-[9px] uppercase tracking-widest text-amber-800/70 mt-1">Head Pandit · Tredev</div>
          </div>
        </div>

        {/* Footer meta */}
        <div className="w-full flex items-center justify-between text-[9px] uppercase tracking-widest text-amber-800/80 border-t border-amber-800/25 pt-2 mt-[4%]">
          <span>Issued on {issued}</span>
          <span>Verify at tredevlearn.com/verify</span>
          <span className="font-mono normal-case tracking-normal">Certificate ID: {cert.code}</span>
        </div>
      </div>
    </div>
  );
}

/** Modal wrapper with a Download (print-to-PDF) action. */
export default function CertificateModal({ cert, onClose, logos }) {
  if (!cert) return null;
  return createPortal((
    <div className="cert-portal fixed inset-0 z-[200] flex flex-col items-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="no-print w-full max-w-[900px] flex items-center justify-between mb-3" onClick={(e)=>e.stopPropagation()}>
        <span className="text-white/80 text-sm">Certificate · {cert.code}</span>
        <div className="flex gap-2">
          <Button onClick={()=>window.print()} className="rounded-full bg-gradient-hot text-white border-0" data-testid="cert-download">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div onClick={(e)=>e.stopPropagation()} className="w-full max-w-[900px] shadow-2xl">
        <CertificateDoc cert={cert} logos={logos} />
      </div>
      <p className="no-print text-white/60 text-xs mt-3 mb-4 text-center max-w-[900px]">
        Use “Download PDF”, then choose “Save as PDF”. Tip: enable “Background graphics” for full colour (or it prints automatically). Logo & Pandit-signature areas are reserved and will fill in once those assets are added.
      </p>
    </div>
  ), document.body);
}
