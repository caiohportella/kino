# Agensi release

The shippable package lives in `kino-cinema-companion/`. The version in
`SKILL.md` determines the archive name under `dist/`. Listing copy and test
fixtures are kept outside the archive.

From the repository root, build the ZIP and validate its contents.

    python -B marketplace/agensi/package_release.py
    python -B -m unittest discover -s marketplace/agensi/tests

The release suite uses PyYAML for frontmatter validation. The packaged scripts
use the Python 3 standard library. To run the connected acceptance suite,
follow [Kino Agent API](../../docs/KINO_AGENT_API.md).

Agensi delivers text files on demand and instructs the host to run shipped
scripts unchanged from temporary files. The package uses one SKILL.md and
self-contained scripts. [Agensi packaging](https://www.agensi.io/docs/packaging)
and [skill loading](https://www.agensi.io/docs/how-agents-load-skills) describe
upload and delivery limits.

Enable Kino OAuth and remote MCP on the intended deployment and smoke test it with a test
account before publishing the archive. The build script creates a local ZIP.
