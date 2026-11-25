import { useContext } from "react";
import HistoryContext from "../Contexts/HistoryContext";

/** Acesso ao `HistoryContext`. Lança fora do `HistoryProvider`. */
export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) throw new Error("useHistory must be used within a HistoryProvider");
  return context;
};

export default useHistory;
