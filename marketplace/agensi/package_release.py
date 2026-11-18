#!/usr/bin/env python3
"""Build a deterministic Agensi ZIP from the skill directory."""
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / "kino-cinema-companion"
def output_path():
    source = (PACKAGE / "SKILL.md").read_text(encoding="utf-8")
    if not source.startswith("---\n"):
        raise SystemExit("SKILL.md must start with frontmatter")
    frontmatter = source.split("---\n", 2)[1]
    version = re.search(r"^version: (\d+\.\d+\.\d+)$", frontmatter, re.MULTILINE)
    if not version or any(not re.search(rf"^{key}:", frontmatter, re.MULTILINE) for key in ("name", "description")):
        raise SystemExit("SKILL.md requires name, description and a semantic version")
    return ROOT / "dist" / f"{PACKAGE.name}-v{version[1]}.zip"


def build():
    output = output_path()
    files = sorted(p for p in PACKAGE.rglob("*") if p.is_file())
    if sum(p.name == "SKILL.md" for p in files) != 1:
        raise SystemExit("package must contain exactly one SKILL.md")
    if len(files) > 100:
        raise SystemExit("agent upload supports up to 100 files")
    text_suffixes = {".md", ".csv", ".json", ".py", ".txt"}
    forbidden_dirs = {"__pycache__", ".git", "node_modules", "site-packages", ".venv", "venv"}
    for path in files:
        if path.is_symlink() or path.suffix not in text_suffixes or forbidden_dirs.intersection(path.parts):
            raise SystemExit(f"prohibited package file: {path}")
        path.read_text(encoding="utf-8")
        if path.suffix == ".py" and path.stat().st_size >= 20_000:
            raise SystemExit(f"script exceeds 20 KB: {path}")
    if sum(path.stat().st_size for path in files) > 5_000_000:
        raise SystemExit("agent upload supports up to 5 MB")
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            relative = Path(PACKAGE.name) / path.relative_to(PACKAGE)
            info = ZipInfo(relative.as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    print(f"Built {output} ({output.stat().st_size} bytes; {len(files)} files)")


if __name__ == "__main__":
    build()
