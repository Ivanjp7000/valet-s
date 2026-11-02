export function shouldRefreshStaffTicketData(type: string): boolean;
export function shouldRefreshGuestServicesCount(type: string): boolean;
export function shouldFetchRealtimeUpdate(visibilityState: string): boolean;
export function createRealtimeInvalidationQueue(
  queryClient: { invalidateQueries(filters: { queryKey: readonly unknown[]; refetchType?: "active" | "inactive" | "all" | "none" }): unknown },
  getVisibilityState: () => string,
  schedule?: (callback: () => void, delayMs: number) => unknown,
  cancel?: (timer: unknown) => void,
): { invalidate(queryKey: readonly unknown[]): void; dispose(): void };
