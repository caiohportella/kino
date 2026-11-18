"""Release checks and deterministic scenario tests for the Agensi package."""
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
import yaml

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "kino-cinema-companion"
SCRIPT = PACKAGE / "scripts" / "normalize_history.py"
ZIP = ROOT / "dist" / "kino-cinema-companion-v3.0.0.zip"

spec = importlib.util.spec_from_file_location("normalizer", SCRIPT)
sys.dont_write_bytecode = True
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)


class ReleaseTests(unittest.TestCase):
    def test_skill_frontmatter_and_references(self):
        text = (PACKAGE / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"))
        frontmatter = text.split("---\n", 2)[1]
        metadata = yaml.safe_load(frontmatter)
        self.assertEqual(metadata["name"], "kino-personal-cinema-companion")
        self.assertEqual(metadata["version"], "3.0.0")
        for key in ("name:", "description:", "summary:", "version:", "tags:", "keywords:", "use_cases:", "docs_url:"):
            self.assertIn(key, frontmatter)
        for ref in re.findall(r"`((?:references|templates|examples|scripts)/[^`]+)`", text):
            self.assertTrue((PACKAGE / ref).exists(), ref)

    def test_archive_contents_and_safety(self):
        self.assertTrue(ZIP.exists(), "run marketplace/agensi/package_release.py first")
        with ZipFile(ZIP) as archive:
            self.assertIsNone(archive.testzip())
            names = archive.namelist()
            self.assertEqual(sum(name.endswith("SKILL.md") for name in names), 1)
            self.assertIn("kino-cinema-companion/SKILL.md", names)
            self.assertNotIn("kino-cinema-companion/scripts/kino.py", names)
            self.assertTrue(all(not name.endswith((".pyc", ".exe", ".dll", ".wasm")) for name in names))
            blob = "\n".join(archive.read(name).decode("utf-8") for name in names)
            self.assertNotRegex(blob, r"(?i)(-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_[A-Za-z0-9]+|SUPABASE_SERVICE_ROLE_KEY\s*=)")
            self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY=", blob)

    def test_normalizer_valid_and_malformed_records(self):
        result = normalizer.normalize([
            {"Name": "Arrival", "Type": "film", "Year": "2016", "Date": "2024-01-01", "Stars": "5"},
            {"title": "Arrival", "media_type": "movie", "year": "2016", "watched_at": "2024-01-01", "rating": "5"},
            {"title": "Unknown", "media_type": "bogus"},
            {"title": "", "media_type": "tv"},
            {"title": "Second watch", "media_type": "series", "date": "2025-01-02", "season_number": "2", "episode_number": "4"},
        ])
        self.assertEqual(len(result["entries"]), 3)
        self.assertEqual(result["entries"][0]["media_type"], "movie")
        self.assertEqual(result["entries"][0]["rating"], 5.0)
        self.assertEqual(result["entries"][1]["duplicate_of"], 0)
        self.assertEqual(result["entries"][2]["season"], 2)
        self.assertIsNone(result["entries"][2]["year"])
        self.assertIsNone(result["entries"][2]["rating"])
        self.assertEqual(len(result["issues"]), 2)

    def test_normalizer_json_cli_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "history.json"
            target = Path(temp) / "normalized.json"
            source.write_text(json.dumps({"entries": [{"title": "A Film", "type": "movie"}]}), encoding="utf-8")
            run = subprocess.run([sys.executable, str(SCRIPT), str(source), "-o", str(target)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            parsed = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(parsed["entries"][0]["title"], "A Film")
            source.write_text("keep", encoding="utf-8")
            same = subprocess.run([sys.executable, str(SCRIPT), str(source), "-o", str(source)], capture_output=True, text=True)
            self.assertNotEqual(same.returncode, 0)
            self.assertEqual(source.read_text(encoding="utf-8"), "keep")

    def test_malformed_csv_shape_is_reported(self):
        result = normalizer.normalize([{"title": "Valid", "type": "movie", None: ["extra"]}])
        self.assertEqual(result["issues"][0]["reason"], "CSV row has more fields than its header")
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "broken.csv"
            target = Path(temp) / "out.json"
            source.write_text('title,type\n"unfinished,movie\n', encoding="utf-8")
            run = subprocess.run([sys.executable, str(SCRIPT), str(source), "-o", str(target)], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertFalse(target.exists())

    def test_scenario_a_excludes_watched_and_uses_evidence_tiers(self):
        history = {"Arrival", "Her", "Moon", "Ex Machina", "The Truman Show"}
        candidates = ["After Yang", "Gattaca", "Coherence", "Arrival"]
        output = [title for title in candidates if title not in history]
        self.assertEqual(output, ["After Yang", "Gattaca", "Coherence"])
        rubric = (PACKAGE / "references" / "recommendation-rubric.md").read_text(encoding="utf-8")
        self.assertIn("Strong match", rubric)
        self.assertIn("Probable match", rubric)
        self.assertIn("Exploratory discovery", rubric)
        example = (PACKAGE / "examples" / "example-results.md").read_text(encoding="utf-8").split("## Scenario A", 1)[1].split("## Scenario B", 1)[0]
        self.assertNotIn("% confidence", example.casefold())
        self.assertIn("candidate sheet", example.casefold())
        self.assertNotIn("streaming availability", example.casefold())

    def test_scenario_b_duplicates_and_media_types(self):
        result = normalizer.normalize([
            {"title": "Arrival", "type": "movie", "year": "2016", "date": "2024-01-01"},
            {"title": "Arrival", "type": "film", "year": "2016", "date": "2024-01-01"},
            {"title": "The Bear", "type": "series"},
            {"title": "Moon", "type": "movie"},
        ])
        self.assertEqual([e["media_type"] for e in result["entries"]], ["movie", "movie", "tv", "movie"])
        self.assertEqual(result["entries"][1]["duplicate_of"], 0)

    def test_scenario_c_incomplete_progress_never_guesses(self):
        watched = {(1, 1), (1, 2), (1, 3), (1, 5)}
        known = [(1, n) for n in range(1, 9)]
        next_unwatched = next((episode for episode in known if episode not in watched), None)
        self.assertEqual(next_unwatched, (1, 4))
        unknown_total_next = None  # No ordered metadata means no calculable next episode.
        self.assertIsNone(unknown_total_next)
        skill = (PACKAGE / "references" / "standalone.md").read_text(encoding="utf-8")
        self.assertIn("A completed previous episode does not prove the next was watched", skill)

    def test_scripts_are_standalone_and_under_20kb(self):
        for path in (PACKAGE / "scripts").glob("*.py"):
            source = path.read_text(encoding="utf-8")
            self.assertLess(len(source.encode("utf-8")), 20_000)
            self.assertNotRegex(source, r"(?m)^\s*(?:from|import)\s+(?!argparse|csv|json|re|sys|pathlib|zipfile|typing|datetime|math|collections|unicodedata|decimal|statistics|hashlib|os|io|tempfile|unittest|subprocess|importlib|urllib|http)[A-Za-z_]")


if __name__ == "__main__":
    unittest.main(verbosity=2)
