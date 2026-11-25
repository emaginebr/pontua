import { useContext } from "react";
import PunchContext from "../Contexts/PunchContext";

/** Acesso ao `PunchContext`. Lança fora do `PunchProvider`. */
export const usePunch = () => {
  const context = useContext(PunchContext);
  if (!context) throw new Error("usePunch must be used within a PunchProvider");
  return context;
};

export default usePunch;
