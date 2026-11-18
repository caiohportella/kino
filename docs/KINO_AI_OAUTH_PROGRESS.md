# Kino AI OAuth implementation

- Audit complete. Kino uses Supabase browser sessions and a private, transactional Agent API. The Supabase OAuth server issues project Auth JWTs with standard identity scopes. Kino needs a separate resource audience, custom tool scopes, and revocation tied to an account switch.
- Foundation uses database-backed OAuth grants and opaque hashed credentials. The existing Agent API enforces the account switch and retains its business transactions.
- Implemented discovery, pinned client metadata, constrained public registration, browser consent, and the account switch.
- The MCP SDK serves the July 2026 protocol and 2025 Streamable HTTP using the same nine Agent API operations.
- The isolated suite passed all 19 tests, including the original 13. The OAuth fixture signs in through Supabase client code and sends tools through the MCP HTTP endpoint.
- Built and verified the v3 Agensi package. The legacy Python adapter lives outside the marketplace archive.
- Staging browser and host smoke tests remain pending. ChatGPT and Codex client metadata responded successfully, and Claude's metadata endpoint returned HTTP 403 during the check.
