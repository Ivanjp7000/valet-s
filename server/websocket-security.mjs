export function isAllowedWebSocketOrigin(origin, host, isProduction) {
  return !isProduction || !origin || origin === `https://${host}`;
}

export function clearLogoutSessionCookies(res, isProduction) {
  res.clearCookie("connect.sid", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
  if (isProduction) {
    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
    });
  }
}
