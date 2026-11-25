import { useContext } from "react";
import ApprovalContext from "../Contexts/ApprovalContext";

/** Acesso ao `ApprovalContext`. Lança fora do `ApprovalProvider`. */
export const useApprovals = () => {
  const context = useContext(ApprovalContext);
  if (!context) throw new Error("useApprovals must be used within an ApprovalProvider");
  return context;
};

export default useApprovals;
