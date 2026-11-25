import { useContext } from "react";
import CompanyContext from "../Contexts/CompanyContext";

/** Acesso ao `CompanyContext`. Lança fora do `CompanyProvider`. */
export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("useCompany must be used within a CompanyProvider");
  return context;
};

export default useCompany;
