import { getQueryFn } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { SafeUser } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<SafeUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
