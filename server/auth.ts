import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import type { Express, RequestHandler } from "express";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const useDbSessionStore =
    process.env.ENABLE_DB_SESSION_STORE === "true" ||
    process.env.NODE_ENV !== "production";
  const sessionStore = useDbSessionStore
    ? new (connectPg(session))({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        pruneSessionInterval: false,
        ttl: sessionTtl,
        tableName: "sessions",
      })
    : new (createMemoryStore(session))({
        checkPeriod: sessionTtl,
      });

  if (!useDbSessionStore) {
    console.log("[Auth] Using in-memory session store; set ENABLE_DB_SESSION_STORE=true to use Postgres sessions");
  }

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Check for local session authentication (username/password or OTP login)
  if (req.session?.user?.claims?.sub) {
    req.user = req.session.user;
    return next();
  }

  // Fallback: check req.isAuthenticated() if passport is still attached
  if (req.isAuthenticated?.()) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};
