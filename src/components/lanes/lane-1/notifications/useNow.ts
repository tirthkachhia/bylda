import { useEffect, useState } from "react";

/** Clock-dependent copy renders after mount — the server's clock/timezone isn't the viewer's. */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}
