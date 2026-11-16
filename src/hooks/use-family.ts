import { createContext, useContext } from "react";
import type { Role } from "@/integrations/supabase/types";

export type FamilyCtx = {
  userId: string;
  familyId: string;
  familyName: string;
  role: Role;
  isParent: boolean;
};

export const FamilyContext = createContext<FamilyCtx | null>(null);

export function useFamily(): FamilyCtx {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used inside <AuthGate>");
  return ctx;
}
