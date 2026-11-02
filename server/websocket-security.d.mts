export function isAllowedWebSocketOrigin(origin: string | undefined, host: string | undefined, isProduction: boolean): boolean;
export function clearLogoutSessionCookies(res: { clearCookie(name: string, options: Record<string, unknown>): unknown }, isProduction: boolean): void;
