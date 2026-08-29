import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import MentorCard from "@/components/MentorCard";

export default function Mentors() {
  const [mentors, setMentors] = useState([]);
  useEffect(() => { api.get("/mentors").then((r) => setMentors(r.data)); }, []);

  return (
    <div className="site-container py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">THE PARAMPARĀ</div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        Meet the <span className="text-gradient-cosmic">keepers</span> of ancient, timeless wisdom
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Every scholar you'll study with signs off on the accuracy of the content published under their name. That signature is the platform's trust surface.
      </p>

      <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mentors.map((m) => <MentorCard key={m.id} mentor={m} />)}
      </div>
    </div>
  );
}
