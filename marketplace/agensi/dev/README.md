# Legacy diagnostics

`kino.py` is a developer-only HTTP regression adapter and lives outside the
Agensi ZIP. The isolated test runner seeds fresh fixture credentials and
injects them into the adapter process. Normal connections use browser OAuth.
Kino no longer issues manual credentials through settings, and the migration
revokes previously issued manual credentials.
