import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

export default function useFeatureToggles() {
  const [toggles, setToggles] = useState({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    api.get("/feature-toggles")
      .then(({ data }) => {
        const map = {};
        (Array.isArray(data) ? data : []).forEach((t) => { map[t.key] = t.enabled; });
        setToggles(map);
      })
      .catch(() => setToggles({}))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const isEnabled = (key) => toggles[key] !== undefined ? toggles[key] : true;

  return { toggles, isEnabled, loading, reload };
}
