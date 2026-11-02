export const LOCATION_SCOPE_CHANGED_CLOSE_CODE: number;
export function refreshUserLocationScopeSockets(
  clients: Iterable<[
    { readyState: number; send(data: string): void; close(code: number, reason: string): void },
    { userId: string }
  ]>,
  userId: string,
  openState: number
): number;
