import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

// For an academic_staff user, GET /capabilities returns only their own grants.
export default function useCapabilities() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    api.get("/capabilities")
      .then(({ data }) => setGrants(data))
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const hasCapability = (cap) => grants.some((g) => g.capability === cap);

  return { grants, hasCapability, loading, reload };
}
