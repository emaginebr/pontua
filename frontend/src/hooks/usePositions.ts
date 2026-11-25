import { useContext } from "react";
import PositionContext from "../Contexts/PositionContext";

/** Acesso ao `PositionContext`. Lança fora do `PositionProvider`. */
export const usePositions = () => {
  const context = useContext(PositionContext);
  if (!context) throw new Error("usePositions must be used within a PositionProvider");
  return context;
};

export default usePositions;
