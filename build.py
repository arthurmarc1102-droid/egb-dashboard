"""Assemble the single-file page: src/index.html + src/style.css + src/app.js -> ../egb/index.html"""
import pathlib, sys
src = pathlib.Path(__file__).parent / "src"
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
html = (src / "index.html").read_text()
html = html.replace("/*__CSS__*/", (src / "style.css").read_text()).replace("/*__JS__*/", (src / "app.js").read_text().replace("/*__LAB__*/", (src / "lab.js").read_text()))
out.write_text(html)
print("built", out, len(html), "bytes")
