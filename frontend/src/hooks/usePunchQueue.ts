import { useContext } from "react";
import PunchQueueContext from "../Contexts/PunchQueueContext";

/** Acesso ao `PunchQueueContext`. Lança fora do `PunchQueueProvider`. */
export const usePunchQueue = () => {
  const context = useContext(PunchQueueContext);
  if (!context) throw new Error("usePunchQueue must be used within a PunchQueueProvider");
  return context;
};

export default usePunchQueue;
