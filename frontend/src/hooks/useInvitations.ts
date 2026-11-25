import { useContext } from "react";
import InvitationContext from "../Contexts/InvitationContext";

/** Acesso ao `InvitationContext`. Lança fora do `InvitationProvider`. */
export const useInvitations = () => {
  const context = useContext(InvitationContext);
  if (!context) throw new Error("useInvitations must be used within an InvitationProvider");
  return context;
};

export default useInvitations;
