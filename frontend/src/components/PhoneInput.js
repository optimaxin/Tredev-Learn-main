import React, { useState } from "react";
import { Input } from "@/components/ui/input";

// Small, common set of dialing codes — India first/default so users don't
// have to type it. Add more here if a market needs it; not exhaustive by design.
export const COUNTRY_CODES = [
  { code: "+91", label: "India", flag: "🇮🇳" },
  { code: "+1", label: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", label: "UK", flag: "🇬🇧" },
  { code: "+61", label: "Australia", flag: "🇦🇺" },
  { code: "+971", label: "UAE", flag: "🇦🇪" },
  { code: "+65", label: "Singapore", flag: "🇸🇬" },
  { code: "+66", label: "Thailand", flag: "🇹🇭" },
  { code: "+977", label: "Nepal", flag: "🇳🇵" },
  { code: "+94", label: "Sri Lanka", flag: "🇱🇰" },
  { code: "+880", label: "Bangladesh", flag: "🇧🇩" },
  { code: "+27", label: "South Africa", flag: "🇿🇦" },
  { code: "+49", label: "Germany", flag: "🇩🇪" },
];

/** Phone number input with a country-code dropdown (defaults to India).
 * Reports the combined E.164 string (e.g. "+919876543210") via onChange. */
export default function PhoneInput({ value, onChange, testId }) {
  const [countryCode, setCountryCode] = useState("+91");
  const number = value?.startsWith(countryCode) ? value.slice(countryCode.length) : value || "";

  const emit = (nextCode, nextNumber) => onChange(`${nextCode}${nextNumber.replace(/\D/g, "")}`);

  return (
    <div className="mt-2 flex gap-2">
      <select
        value={countryCode}
        onChange={(e) => { setCountryCode(e.target.value); emit(e.target.value, number); }}
        className="h-12 rounded-md border border-input bg-card text-card-foreground px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
        ))}
      </select>
      <Input
        type="tel"
        inputMode="numeric"
        value={number}
        onChange={(e) => emit(countryCode, e.target.value)}
        placeholder="9876543210"
        required
        data-testid={testId}
        className="h-12 flex-1"
      />
    </div>
  );
}
