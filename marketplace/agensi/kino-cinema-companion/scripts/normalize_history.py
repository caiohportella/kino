#!/usr/bin/env python3
"""Normalize user-provided movie/TV history from CSV or JSON (standard library only)."""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

ALIASES = {
    "title": ("title", "name", "movie", "show", "film"),
    "media_type": ("media_type", "type", "media", "kind"),
    "year": ("year", "release_year"),
    "watched_at": ("watched_at", "date", "watch_date", "watched", "viewed_at"),
    "rating": ("rating", "user_rating", "stars", "score"),
    "id": ("id", "tmdb_id", "imdb_id", "identifier", "external_id"),
    "season": ("season", "season_number"),
    "episode": ("episode", "episode_number"),
    "notes": ("notes", "review", "review_text", "comment"),
    "watch_type": ("watch_type", "rewatch", "is_rewatch"),
}
ALIAS_LOOKUP = {re.sub(r"[\s_-]+", "", a.casefold()): k for k, values in ALIASES.items() for a in values}


def clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def normalized_type(value):
    if value is None:
        return None
    key = re.sub(r"[\s_-]+", "", value.casefold())
    if key in ("movie", "film", "feature"):
        return "movie"
    if key in ("tv", "series", "show", "television"):
        return "tv"
    return None


def load_rows(path):
    if path.suffix.casefold() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, strict=True)
            if reader.fieldnames is None:
                raise ValueError("CSV must contain a header row")
            return list(reader), "csv"
    if path.suffix.casefold() == ".json":
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict) and isinstance(data.get("entries"), list):
            rows = data["entries"]
        elif isinstance(data, dict):
            rows = [data]
        else:
            raise ValueError("JSON must be an object, an object with an entries array, or an array")
        return rows, "json"
    raise ValueError("input file must end in .csv or .json")


def canonicalize(row):
    if not isinstance(row, dict):
        return {}, {}
    fields = {}
    source = {}
    for key, value in row.items():
        canonical = ALIAS_LOOKUP.get(re.sub(r"[\s_-]+", "", str(key).casefold()))
        val = clean(value)
        if canonical and canonical not in fields:
            fields[canonical] = val
        if canonical is None and val is not None:
            source[str(key)] = val
        elif canonical and val is not None:
            source[str(key)] = val
    return fields, source


def parse_entry(row, index):
    fields, source_fields = canonicalize(row)
    if isinstance(row, dict) and None in row:
        return None, "CSV row has more fields than its header"
    title = fields.get("title")
    media = normalized_type(fields.get("media_type"))
    if not title:
        return None, "missing required title"
    if not media:
        return None, "missing or unsupported media_type (use movie or tv)"
    year = fields.get("year")
    if year and not re.fullmatch(r"\d{4}", year):
        return None, "year must be a four-digit value"
    rating = fields.get("rating")
    if rating is not None:
        try:
            rating = float(rating)
        except ValueError:
            return None, "rating is not numeric"
    coordinates = {}
    for key in ("season", "episode"):
        value = fields.get(key)
        if value is not None:
            try:
                number = int(value)
                if number < 0:
                    raise ValueError
                coordinates[key] = number
            except ValueError:
                return None, f"{key} must be a non-negative integer"
    identifier = fields.get("id")
    id_source = None
    if identifier:
        for raw_key in row:
            if re.sub(r"[\s_-]+", "", str(raw_key).casefold()) == "imdbid":
                id_source = "imdb"
            elif re.sub(r"[\s_-]+", "", str(raw_key).casefold()) == "tmdbid":
                id_source = "tmdb"
        id_source = id_source or "unspecified"
    watch_type = fields.get("watch_type")
    if watch_type:
        key = watch_type.casefold()
        if key in ("true", "1", "yes", "rewatch", "repeat"):
            watch_type = "rewatch"
        elif key in ("false", "0", "no", "first-time", "first time", "first"):
            watch_type = "first-time"
        else:
            return None, "watch_type must identify first-time or rewatch"
    else:
        watch_type = None
    entry = {
        "title": title,
        "media_type": media,
        "year": int(year) if year else None,
        "watched_at": fields.get("watched_at"),
        "rating": rating,
        "identifier": {"value": identifier, "source": id_source} if identifier else None,
        "season": coordinates.get("season"),
        "episode": coordinates.get("episode"),
        "notes": fields.get("notes"),
        "watch_type": watch_type,
        "source_row": index,
        "source_fields": source_fields,
        "duplicate_of": None,
    }
    return entry, None


def duplicate_key(entry):
    ident = entry["identifier"]
    if ident:
        return ("id", entry["media_type"], ident["source"], ident["value"].casefold())
    # Without both year and date a title match is too weak to collapse.
    if entry["year"] is None or entry["watched_at"] is None:
        return None
    return ("title", entry["media_type"], entry["title"].casefold(), entry["year"],
            entry["watched_at"], entry["season"], entry["episode"])


def normalize(rows):
    entries, issues, seen = [], [], {}
    for index, row in enumerate(rows, start=1):
        entry, error = parse_entry(row, index)
        if error:
            issues.append({"source_row": index, "reason": error})
            continue
        key = duplicate_key(entry)
        if key is not None and key in seen:
            entry["duplicate_of"] = seen[key]
        elif key is not None:
            seen[key] = len(entries)
        entries.append(entry)
    return {"schema_version": "1.0", "entries": entries, "issues": issues}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="user-provided .csv or .json file")
    parser.add_argument("-o", "--output", type=Path, required=True, help="output JSON path; must differ from input")
    args = parser.parse_args()
    try:
        source = args.input.resolve(strict=True)
        destination = args.output.resolve()
        if source == destination:
            raise ValueError("output path must differ from input path")
        rows, _ = load_rows(source)
        result = normalize(rows)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(f"Wrote {len(result['entries'])} entries and {len(result['issues'])} issues to {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
