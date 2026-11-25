import { useContext } from "react";
import AuthContext from "../Contexts/AuthContext";

/** Acesso ao `AuthContext`. Lança fora do `AuthProvider`. */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export default useAuth;
