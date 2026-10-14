#!/usr/bin/env python3
"""Render the combat-start Markdown as a self-contained print HTML document."""

from pathlib import Path
import sys

from markdown_it import MarkdownIt


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit('usage: render-combat-start-pdf.py SOURCE.md OUTPUT.html')

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    source = source_path.read_text(encoding='utf-8')
    body = MarkdownIt('commonmark').enable(['table', 'strikethrough']).render(source)
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Backpack Battles — Combat Start Sequence</title>
<style>
@page {{ size: A4; margin: 16mm 14mm 17mm; }}
:root {{ color-scheme: light; }}
* {{ box-sizing: border-box; }}
html {{ background: #f5ead9; }}
body {{ margin: 0; background: #fffaf2; color: #3c261d; font-family: Georgia, "Times New Roman", serif; font-size: 9.5pt; line-height: 1.38; }}
main {{ max-width: 100%; }}
h1, h2, h3 {{ color: #4a2e1e; line-height: 1.15; page-break-after: avoid; }}
h1 {{ margin: 0 0 0.35rem; padding-bottom: 0.35rem; border-bottom: 2px solid #c6a567; font-size: 24pt; }}
h2 {{ margin: 1.25rem 0 0.45rem; padding-bottom: 0.2rem; border-bottom: 1px solid #d5b77e; font-size: 16pt; }}
h3 {{ margin: 1rem 0 0.35rem; font-size: 12pt; }}
p {{ margin: 0.35rem 0 0.65rem; }}
a {{ color: #79541f; }}
code {{ padding: 0.06em 0.22em; border: 1px solid #eadbc4; border-radius: 3px; background: #f5ecdf; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.9em; }}
pre {{ margin: 0.65rem 0 0.9rem; padding: 0.65rem 0.75rem; border: 1px solid #d5b77e; border-radius: 5px; background: #f3eadc; white-space: pre-wrap; break-inside: avoid; }}
pre code {{ padding: 0; border: 0; background: transparent; font-size: 8.3pt; }}
table {{ width: 100%; margin: 0.55rem 0 0.9rem; border-collapse: collapse; font-size: 8.4pt; break-inside: auto; }}
thead {{ display: table-header-group; }}
tr {{ break-inside: avoid; break-after: auto; }}
th, td {{ padding: 0.32rem 0.42rem; border: 1px solid #d8c09a; vertical-align: top; text-align: left; }}
th {{ background: #efe0c5; color: #4a2e1e; font-weight: 700; }}
ul, ol {{ margin: 0.35rem 0 0.7rem 1.35rem; padding: 0; }}
li {{ margin: 0.08rem 0; break-inside: avoid; }}
blockquote {{ margin: 0.65rem 0; padding: 0.25rem 0.75rem; border-left: 3px solid #c6a567; background: #faf1e3; }}
hr {{ border: 0; border-top: 1px solid #d5b77e; margin: 1rem 0; }}
@media print {{ a {{ color: inherit; text-decoration: none; }} }}
</style>
</head>
<body><main>{body}</main></body>
</html>'''
    output_path.write_text(html, encoding='utf-8')
    print(output_path)


if __name__ == '__main__':
    main()
