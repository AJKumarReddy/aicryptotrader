"""Configuration, loaded from the environment only.

Nothing secret is ever hardcoded here: every credential arrives via the
environment (or a local .env that is gitignored). See .env.example.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# pydantic-settings tries to JSON-decode list-typed fields straight from the
# environment, which rejects a plain comma-separated value before any
# validator sees it. NoDecode hands us the raw string instead.
CsvList = Annotated[list[str], NoDecode]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"
    # JSON logs are for shippers; text is for humans. Defaults per
    # environment, overridable.
    log_format: Literal["json", "text", "auto"] = "auto"

    # --- Local development ------------------------------------------------
    # Keep portfolio rows in memory instead of Supabase. Needed when signing
    # in through the local dev issuer, whose tokens Supabase will not accept.
    # Refused outright in production - see validate_for_environment().
    dev_local_portfolio: bool = False

    # --- Observability ----------------------------------------------------
    metrics_enabled: bool = True
    # When set, /metrics requires `Authorization: Bearer <this>`. Metrics
    # expose traffic shape and error rates, so leaving them open on a public
    # listener is a reconnaissance gift.
    metrics_token: str = ""

    # --- Identity (Clerk) -------------------------------------------------
    # The issuer of the JWTs the frontend already mints, e.g.
    # https://your-app-12.clerk.accounts.dev
    clerk_issuer: str = ""
    # Optional: restrict the 'azp' (authorized party) claim to known origins.
    clerk_authorized_parties: CsvList = Field(default_factory=list)

    # --- Data plane (Supabase) -------------------------------------------
    # The user's own token is forwarded to PostgREST so row-level security
    # stays the last line of defence. No service-role key is required.
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # --- Browser access ---------------------------------------------------
    cors_allow_origins: CsvList = Field(
        default_factory=lambda: ["http://localhost:8080", "http://localhost:5173"]
    )

    # --- Upstream market data --------------------------------------------
    coingecko_demo_api_key: str = ""
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    # Verified reachable; Binance returns HTTP 451 from restricted regions.
    coinbase_base_url: str = "https://api.exchange.coinbase.com"
    kraken_base_url: str = "https://api.kraken.com/0/public"
    coinpaprika_base_url: str = "https://api.coinpaprika.com/v1"
    fear_greed_url: str = "https://api.alternative.me/fng/"
    defillama_base_url: str = "https://coins.llama.fi"

    upstream_timeout_seconds: float = 10.0

    # --- Rate limiting ----------------------------------------------------
    rate_limit_public_per_minute: int = 60
    rate_limit_authed_per_minute: int = 120
    rate_limit_write_per_minute: int = 20

    # --- Request hardening ------------------------------------------------
    max_request_bytes: int = 64 * 1024

    @field_validator("clerk_issuer")
    @classmethod
    def _strip_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/")

    @field_validator("cors_allow_origins", "clerk_authorized_parties", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        # Allow CORS_ALLOW_ORIGINS="http://a.com,http://b.com" in .env
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    def validate_for_environment(self) -> None:
        """Fail loudly rather than run a production app on a dev fixture."""
        if self.environment == "production" and self.dev_local_portfolio:
            raise RuntimeError(
                "DEV_LOCAL_PORTFOLIO is a development fixture and must not be "
                "enabled in production: portfolio data would be held in memory "
                "and silently lost."
            )

    @property
    def json_logs(self) -> bool:
        if self.log_format == "auto":
            return self.environment == "production"
        return self.log_format == "json"

    @property
    def auth_configured(self) -> bool:
        return bool(self.clerk_issuer)

    @property
    def db_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
