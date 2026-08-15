#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

MARKERS = (chr(0x00C3), chr(0x00C2), chr(0x00E2))


def fix_text(value):
    current = value
    for _ in range(4):
        if not any(marker in current for marker in MARKERS):
            break
        try:
            candidate = current.encode("cp1252").decode("utf-8")
        except UnicodeError:
            break
        if candidate == current:
            break
        current = candidate
    return current


def walk(value, stats, path="$"):
    if isinstance(value, str):
        fixed = fix_text(value)
        if fixed != value:
            stats["strings"] += 1
            stats["paths"].append(path)
        return fixed
    if isinstance(value, list):
        return [walk(item, stats, f"{path}[{index}]") for index, item in enumerate(value)]
    if isinstance(value, dict):
        output = {}
        for key, item in value.items():
            fixed_key = fix_text(key) if isinstance(key, str) else key
            if fixed_key != key:
                stats["keys"] += 1
                stats["paths"].append(f"{path}.{key}")
            output[fixed_key] = walk(item, stats, f"{path}.{fixed_key}")
        return output
    return value


def main():
    parser = argparse.ArgumentParser(description="Corrige mojibake UTF-8 salvo como cp1252 em JSON.")
    parser.add_argument("json_path")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    path = Path(args.json_path)
    data = json.loads(path.read_text(encoding="utf-8"))
    stats = {"strings": 0, "keys": 0, "paths": []}
    fixed = walk(data, stats)
    print(json.dumps({
        "path": str(path),
        "strings_changed": stats["strings"],
        "keys_changed": stats["keys"],
        "total_changed": stats["strings"] + stats["keys"],
        "sample_paths": stats["paths"][:50],
        "write": args.write,
    }, ensure_ascii=False, indent=2))
    if args.write and stats["strings"] + stats["keys"]:
        path.write_text(json.dumps(fixed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
