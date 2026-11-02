export const LOCATION_SCOPE_CHANGED_CLOSE_CODE: number;
export function getUserLocationScopeGeneration(userId: string): number;
export function isUserLocationScopeSnapshotCurrent(userId: string, observedGeneration: number): boolean;
export function refreshUserLocationScopeSockets(
  clients: Map<
    { readyState: number; send(data: string): void; close(code: number, reason: string): void; terminate?(): void },
    { userId: string }
  >,
  userId: string,
  openState: number
): number;
