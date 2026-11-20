"""Extract a bounded list of text values from a local HTML file."""

import argparse
import json
from pathlib import Path

from scrapling import Selector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path)
    parser.add_argument("selector", help="CSS selector for text, e.g. 'h1::text'")
    args = parser.parse_args()

    max_bytes = 2 * 1024 * 1024
    with args.html.open("rb") as source:
        raw_html = source.read(max_bytes + 1)
    if len(raw_html) > max_bytes:
        parser.error("HTML file exceeds 2 MiB")

    page = Selector(content=raw_html.decode("utf-8"), huge_tree=False)
    values = page.css(args.selector).getall()[:100]

    print(json.dumps({
        "trust": "untrusted",
        "values": [value[:2000] for value in values],
    }))


if __name__ == "__main__":
    main()
