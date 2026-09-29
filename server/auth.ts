import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import type { Express, RequestHandler } from "express";

let sharedSession: ReturnType<typeof session> | undefined;

export function getSession() {
  if (sharedSession) return sharedSession;
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const useDbSessionStore =
    process.env.ENABLE_DB_SESSION_STORE === "true" ||
    process.env.NODE_ENV !== "production";
  const sessionStore = useDbSessionStore
    ? new (connectPg(session))({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        pruneSessionInterval: false,
        ttl: sessionTtl / 1000,
        tableName: "sessions",
      })
    : new (createMemoryStore(session))({
        checkPeriod: sessionTtl,
      });

  if (!useDbSessionStore) {
    console.log("[Auth] Using in-memory session store; set ENABLE_DB_SESSION_STORE=true to use Postgres sessions");
  }

  return sharedSession = session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      partitioned: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      // Only the owner's Studio may embed authenticated production screens.
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://studio-production-cb90.up.railway.app");
      // SameSite=None requires explicit browser-origin checks on mutations.
      // Requests made inside the iframe still originate from the Valet app.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.get('origin');
        const ownOrigin = `${req.protocol}://${req.get('host')}`;
        if ((origin && origin !== ownOrigin) || (!origin && ['cross-site', 'same-site'].includes(req.get('sec-fetch-site') || ''))) {
          return res.status(403).json({ message: 'Request origin is not allowed' });
        }
      }
    }
    next();
  });
  app.use(getSession());
  // Older open browser tabs may still use the former hosted-auth entry point.
  app.get("/api/login", (_req, res) => res.redirect(302, "/staff"));
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
