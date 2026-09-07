import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const CurrencyContext = createContext({ currency: "INR" });

/** Detects visitor currency (INR for India, USD elsewhere) once per session
 * via a server-side IP lookup, cached in sessionStorage so it isn't re-fetched
 * on every page. Defaults to INR until resolved. */
export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => sessionStorage.getItem("tredev_currency") || "INR");

  useEffect(() => {
    if (sessionStorage.getItem("tredev_currency")) return;
    api.get("/geo").then(({ data }) => {
      const c = data?.currency === "USD" ? "USD" : "INR";
      sessionStorage.setItem("tredev_currency", c);
      setCurrency(c);
    }).catch(() => {});
  }, []);

  return <CurrencyContext.Provider value={{ currency }}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

/** Picks price_inr vs price_usd off an offering/webinar-shaped object and
 * formats it with the right symbol. */
export function formatPrice(obj, currency) {
  if (currency === "USD") return `$${(obj.price_usd ?? 0).toLocaleString()}`;
  return `₹${(obj.price_inr ?? 0).toLocaleString()}`;
}
