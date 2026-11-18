# Kino Personal Cinema Companion

Connect a compatible AI assistant to Kino to manage watchlists, log viewing,
read your diary, and get recommendations grounded in your account history.

Read `SKILL.md` and add your Kino deployment's `/mcp` endpoint through the
host's remote MCP connector controls. Sign in to Kino in the browser and
approve the requested permissions. Agensi supplies the skill instructions.
Your AI host manages the separate Kino connection.

Standalone analysis uses data you supply. The optional CSV and JSON
normalizer supports local viewing-history analysis.

    python scripts/normalize_history.py input.csv -o normalized.json
