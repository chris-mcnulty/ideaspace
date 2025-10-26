import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<Omit<User, 'password'>>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: user || null,
    isAuthenticated: !!user,
    isLoading,
    error,
    isAdmin: user?.role === "global_admin" || user?.role === "company_admin",
    isFacilitator: user?.role === "facilitator",
    isGlobalAdmin: user?.role === "global_admin",
    isCompanyAdmin: user?.role === "company_admin",
  };
}
