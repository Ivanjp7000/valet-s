import { useQuery } from "@tanstack/react-query";
import type { SafeUser } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
