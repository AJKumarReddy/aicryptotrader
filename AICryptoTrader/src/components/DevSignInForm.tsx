import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { devSignIn, devSuggestedEmail } from "@/lib/devAuth";

/**
 * Local development sign-in. Email is the username.
 *
 * The banner is not decoration. This form does not verify the password -
 * there is nothing local to verify it against - and anyone looking at the
 * screen should know that before they read anything into a successful
 * "login". It is only rendered when the dev issuer is configured, and the
 * whole component is dropped from production builds.
 */
const DevSignInForm = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(devSuggestedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await devSignIn(email);
      // A full load lets AuthContext pick the session up cleanly.
      window.location.assign("/portfolio");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-6">
      <div className="mb-4 flex items-start gap-2 text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">Local development sign-in.</span>{" "}
          Any email works and the password is <em>not</em> checked. This exists
          because the Clerk instance only offers Google and MetaMask. It is
          never included in a production build.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dev-email" className="text-gray-300">
            Email (your username)
          </Label>
          <Input
            id="dev-email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border-gray-700 bg-gray-900 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dev-password" className="text-gray-300">
            Password <span className="text-gray-500">(not verified)</span>
          </Label>
          <Input
            id="dev-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="anything"
            className="border-gray-700 bg-gray-900 text-white"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white"
        >
          {busy ? "Signing in…" : "Sign in locally"}
        </Button>
      </form>

      <p className="mt-4 text-xs text-gray-500">
        Each address is a separate user, so you can sign in as two different
        emails to confirm one cannot see the other's holdings.
      </p>
    </div>
  );
};

export default DevSignInForm;
