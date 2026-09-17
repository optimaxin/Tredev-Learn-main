import { useEffect, useRef, useState } from "react";

/** Counts down from `seconds` (default 60). Call start() when a code is sent.
 * `left` is the remaining seconds; resend is allowed once it hits 0. */
export default function useResendTimer(seconds = 60) {
  const [left, setLeft] = useState(seconds);
  const intervalRef = useRef(null);

  const start = () => {
    clearInterval(intervalRef.current);
    setLeft(seconds);
    intervalRef.current = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { left, start, canResend: left <= 0 };
}
