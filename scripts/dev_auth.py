"""A local token issuer, for working on the app without signing in.

This exists because the Clerk instance only offers Google and MetaMask
sign-in, which is a poor fit for local development and impossible in CI.

Deliberately *not* an auth bypass. The backend's verification code is
untouched and still does the full job: RS256 only, signature checked against
a JWKS document, issuer matched, expiry enforced. The single difference is
which issuer it trusts. Point `CLERK_ISSUER` back at Clerk and everything
works exactly as before, with no code to un-patch and nothing to forget.

    uv run scripts/dev_auth.py

It generates a keypair under .dev/ (gitignored), serves the JWKS on
127.0.0.1:8009, and mints a token for any email address on request. Email is
the username: the same address always maps to the same user id, so you can
switch addresses to check that one user cannot see another's rows.
"""

from __future__ import annotations

import json
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

HOST = "127.0.0.1"
PORT = 8009
ISSUER = f"http://{HOST}:{PORT}"
KID = "dev-local-key"

DEV_DIR = Path(__file__).resolve().parent.parent / ".dev"
KEY_PATH = DEV_DIR / "dev_signing_key.pem"

DUMMY_EMAIL = "dummy@localhost.dev"
TOKEN_LIFETIME_SECONDS = 12 * 3600

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def subject_for(email: str) -> str:
    """Derive a stable user id from an email address.

    Email is the username throughout the project, so the same address always
    maps to the same subject - which means the same rows, and lets you switch
    between two addresses to check that one dev user cannot see the other's
    data.
    """
    slug = re.sub(r"[^a-z0-9]+", "_", email.strip().lower()).strip("_")
    return f"user_dev_{slug[:60]}"


def load_or_create_key() -> rsa.RSAPrivateKey:
    DEV_DIR.mkdir(exist_ok=True)
    if KEY_PATH.exists():
        return serialization.load_pem_private_key(KEY_PATH.read_bytes(), password=None)

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    KEY_PATH.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    return key


def jwks_document(key: rsa.RSAPrivateKey) -> dict:
    jwk = json.loads(RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return {"keys": [jwk]}


def mint_token(key: rsa.RSAPrivateKey, subject: str, email: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": subject,
            "iss": ISSUER,
            "iat": now,
            "exp": now + TOKEN_LIFETIME_SECONDS,
            "email": email,
            "sid": f"sess_{subject}",
        },
        key,
        algorithm="RS256",
        headers={"kid": KID},
    )


class DevIssuerHandler(BaseHTTPRequestHandler):
    """Serves the JWKS, and mints a token for any email on request.

    Handing out a token for any address would be reckless on a real issuer.
    Here it is the point: this binds to 127.0.0.1 only, its key exists solely
    on this machine, and the app is pointed at it only while `CLERK_ISSUER`
    says so. It never sees a password, because there is nothing it could
    check one against - see the note in the sign-in form.
    """

    document: bytes = b"{}"
    signing_key = None

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # The dev server runs on a different port from Vite.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        parsed = urlparse(self.path)

        if parsed.path == "/.well-known/jwks.json":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(self.document)))
            self.end_headers()
            self.wfile.write(self.document)
            return

        if parsed.path == "/token":
            email = (parse_qs(parsed.query).get("email") or [""])[0].strip().lower()
            if not EMAIL_RE.match(email):
                self._json(400, {"error": "a valid email address is required"})
                return
            subject = subject_for(email)
            self._json(
                200,
                {
                    "token": mint_token(self.signing_key, subject, email),
                    "user_id": subject,
                    "email": email,
                },
            )
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, *_args) -> None:
        pass  # keep the dev console readable


def main() -> None:
    key = load_or_create_key()
    DevIssuerHandler.document = json.dumps(jwks_document(key)).encode()
    DevIssuerHandler.signing_key = key
    token = mint_token(key, subject_for(DUMMY_EMAIL), DUMMY_EMAIL)

    env_local = (
        Path(__file__).resolve().parent.parent / "AICryptoTrader" / ".env.local"
    )
    env_local.write_text(
        "# Written by scripts/dev_auth.py. Development only - the frontend\n"
        "# ignores this outside `vite dev`. Delete it to restore the real\n"
        "# Clerk sign-in flow.\n"
        f"VITE_DEV_AUTH_ISSUER={ISSUER}\n"
        f"VITE_DEV_AUTH_TOKEN={token}\n"
        f"VITE_DEV_AUTH_USER={subject_for(DUMMY_EMAIL)}\n"
        f"VITE_DEV_AUTH_EMAIL={DUMMY_EMAIL}\n",
        encoding="utf-8",
    )

    print(f"dev issuer   : {ISSUER}")
    print(f"dummy user   : {subject_for(DUMMY_EMAIL)} <{DUMMY_EMAIL}>")
    print(f"token valid  : {TOKEN_LIFETIME_SECONDS // 3600}h")
    print(f"token written: {env_local}")
    print()
    print("Set this in the backend .env, then restart it:")
    print(f"  CLERK_ISSUER={ISSUER}")
    print()
    print(f"Serving JWKS on {ISSUER}/.well-known/jwks.json")
    print(f"Minting tokens at {ISSUER}/token?email=<address>  (ctrl-c to stop)")
    sys.stdout.flush()

    HTTPServer((HOST, PORT), DevIssuerHandler).serve_forever()


if __name__ == "__main__":
    main()
