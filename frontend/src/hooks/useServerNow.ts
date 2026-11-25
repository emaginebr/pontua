import { useEffect, useMemo, useState } from "react";
import { applyServerOffset } from "../utils/dateTime";
import { useConnectivity } from "./useConnectivity";

/**
 * Hora "oficial" (relógio do aparelho corrigido pelo `serverOffset`, research R-08),
 * atualizada a cada `intervalMs`.
 */
export const useServerNow = (intervalMs = 1_000): Date => {
  const { serverOffset } = useConnectivity();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return useMemo(() => applyServerOffset(serverOffset, now), [serverOffset, now]);
};

export default useServerNow;
