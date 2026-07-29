import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, ScrollText, GraduationCap, Users } from "lucide-react";

export default function AboutUs() {
  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">ABOUT</div>
      <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
        A place to <span className="text-gradient-cosmic">study</span> —<br />not to buy predictions.
      </h1>
      <p className="mt-6 text-xl text-foreground/85 max-w-3xl leading-relaxed">
        Tredev Learn is a credentialed digital learning platform for the Vedic knowledge systems — the Vedas, Upaniṣads, Bhagavad Gītā, the epics, Purāṇas, Sanskrit, and allied disciplines. Structured like a university, accessible like a streaming site, credentialed like a professional course.
      </p>

      <div className="mt-16 grid md:grid-cols-4 gap-6">
        {[
          { icon: ShieldCheck, title: "Ācharya sign-off", body: "Nothing published under a scholar's name they haven't approved." },
          { icon: ScrollText, title: "Everything cited", body: "Every claim about a text points to the text — and its interpreter." },
          { icon: GraduationCap, title: "Verifiable credentials", body: "Every certificate has a public verification page." },
          { icon: Users, title: "Moderated by humans", body: "A published charter. Disagreement welcome; contempt is not." },
        ].map((f, i) => (
          <div key={i} className="rounded-2xl border border-border p-6 bg-card card-elevated">
            <div className="w-12 h-12 rounded-xl bg-gradient-hot flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-white" />
            </div>
            <div className="font-display text-xl font-bold">{f.title}</div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="font-display text-4xl font-bold">One distinction governs every decision.</h2>
          <p className="mt-6 text-lg text-foreground/80 leading-relaxed">
            We teach astrology and numerology as <em>disciplines with a history and a method</em>. Never as fortune-telling. That line is what makes the credential worth holding and the platform worth trusting.
          </p>
          <p className="mt-4 text-lg text-foreground/80 leading-relaxed">
            Every interpretation is attributed to a named school or scholar — never presented as "what the tradition says." Where traditions disagree, the disagreement is shown, not resolved.
          </p>
        </div>
        <div className="rounded-2xl border border-border p-10 bg-gradient-cosmic text-white relative overflow-hidden">
          <div className="orb orb-gold w-64 h-64 -top-20 -right-20" />
          <div className="relative">
            <div className="text-6xl font-display font-bold text-gradient-cosmic">🕉️</div>
            <blockquote className="mt-6 font-editorial italic text-2xl leading-relaxed">
              "Structured like a university, accessible like a streaming site, credentialed like a professional course."
            </blockquote>
          </div>
        </div>
      </div>

      <div className="mt-24 text-center">
        <h2 className="font-display text-4xl font-bold">Ready to begin?</h2>
        <p className="mt-3 text-muted-foreground">Start with a free masterclass — or ask a human where to start.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/courses"><Button size="lg" className="rounded-full h-12 px-8 bg-gradient-hot text-white border-0 btn-glow">Explore courses <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
          <Link to="/consultation"><Button size="lg" variant="outline" className="rounded-full h-12 px-8">Free consultation</Button></Link>
        </div>
      </div>
    </div>
  );
}
