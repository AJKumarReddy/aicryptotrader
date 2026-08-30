/**
 * Local development sign-in, with the email address as the username.
 *
 * The Clerk instance only offers Google and MetaMask, which cannot be
 * automated and is awkward to work behind locally. This provides an
 * email-and-password form that issues a real, correctly signed token from
 * the local dev issuer (`scripts/dev_auth.py`).
 *
 * Be clear about what this is: the password is **not verified**. There is no
 * local credential store to check it against, and inventing one would only
 * make a fake check look like a real one. It is accepted so the form matches
 * the shape of the real thing; the email is what actually identifies you.
 *
 * Two things stop this becoming a security hole:
 *   - `import.meta.env.DEV` is false in any production build, so these
 *     checks fold to a constant false and the bundler drops the branches.
 *     No env var can switch it on in a deployed app.
 *   - The backend is not weakened to accept it. The token is a genuine RS256
 *     JWT that still passes full signature, issuer and expiry verification.
 *     Only `CLERK_ISSUER` differs.
 */

const STORAGE_KEY = "dev-auth-session";

export interface DevSession {
  token: string;
  userId: string;
  email: string;
}

const issuer = import.meta.env.VITE_DEV_AUTH_ISSUER as string | undefined;

/** True only during `vite dev` with the local issuer configured. */
export const devAuthEnabled = Boolean(import.meta.env.DEV && issuer);

export const devSuggestedEmail =
  (import.meta.env.VITE_DEV_AUTH_EMAIL as string) ?? "dummy@localhost.dev";

export function getDevSession(): DevSession | null {
  if (!devAuthEnabled) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevSession;
    return parsed?.token && parsed?.userId ? parsed : null;
  } catch {
    // Private windows and cleared site data both land here.
    return null;
  }
}

/**
 * "Sign in" as the given email. Asks the local issuer for a token whose
 * subject is derived from the address, so the same email always means the
 * same user - and two different addresses are two different users, which is
 * what makes it useful for checking that one cannot see the other's data.
 */
export async function devSignIn(email: string): Promise<DevSession> {
  if (!devAuthEnabled) {
    throw new Error("Local dev sign-in is not enabled.");
  }

  const response = await fetch(
    `${issuer}/token?email=${encodeURIComponent(email.trim().toLowerCase())}`,
  );

  if (!response.ok) {
    let message = "Local sign-in failed.";
    try {
      message = (await response.json())?.error ?? message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }

  const payload = await response.json();
  const session: DevSession = {
    token: payload.token,
    userId: payload.user_id,
    email: payload.email,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* the session still works for this page load */
  }
  return session;
}

export function devSignOut(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function devUserFromSession(session: DevSession) {
  return {
    id: session.userId,
    email: session.email,
    user_metadata: {
      full_name: session.email.split("@")[0],
      avatar_url: null as string | null,
    },
  };
}

if (devAuthEnabled) {
  // Loud on purpose: nobody should mistake this for a real session.
  console.warn(
    "[dev-auth] Local email sign-in is active and passwords are NOT verified. " +
      "Delete AICryptoTrader/.env.local to restore the real Clerk flow.",
  );
}
