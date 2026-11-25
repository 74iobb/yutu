#!/usr/bin/env python3
"""把 Markdown 重排为可编辑的 Word 文档。

不依赖 python-docx：直接生成 OOXML 包（标题 / 正文 / 列表 / 表格 / 代码块 /
行内代码 / 页脚页码）。默认行为仍是导出 `docs/域途-方案书-修订版.md`。

用法：
  python3 scripts/build_plan_docx.py                      # 方案书（沿用旧行为）
  python3 scripts/build_plan_docx.py \
      --src "docs/域途-产品说明计划书.md" \
      --out "docs/域途-产品说明计划书.docx" \
      --title "域途 · 产品说明计划书（V12.1）" \
      --footer "域途 · 产品说明计划书" \
      --simple-headings
"""
import argparse
import os
import re
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "域途-方案书-修订版.md")
OUT = os.path.join(ROOT, "docs", "域途-方案书-修订版.docx")

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def run(text, bold=False, code=False, size=None, color=None):
    """生成单个 run；code 使用等宽字体与浅底。"""
    rpr = ""
    if code:
        rpr += (
            '<w:rFonts w:ascii="Consolas" w:eastAsia="Consolas" w:hAnsi="Consolas"/>'
            '<w:shd w:val="clear" w:color="auto" w:fill="F4F1EA"/>'
        )
    if bold:
        rpr += "<w:b/>"
    if size:
        rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    if color:
        rpr += f'<w:color w:val="{color}"/>'
    rpr = f"<w:rPr>{rpr}</w:rPr>" if rpr else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def inline_runs(text, bold=False, size=None, color=None):
    """把 `代码` 与 **加粗** 拆成 run；支持加粗内部包含行内代码。"""
    codes = []

    def stash(m):
        codes.append(m.group(1))
        return f"\x00{len(codes) - 1}\x00"

    protected = re.sub(r"`([^`]+)`", stash, text)
    out = []

    def emit(seg, is_bold):
        for piece in re.split(r"(\x00\d+\x00)", seg):
            if not piece:
                continue
            m = re.fullmatch(r"\x00(\d+)\x00", piece)
            if m:
                out.append(
                    run(
                        codes[int(m.group(1))],
                        bold=is_bold,
                        code=True,
                        size=size,
                        color=color,
                    )
                )
            else:
                out.append(run(piece, bold=is_bold, size=size, color=color))

    for part in re.split(r"(\*\*[^*]+\*\*)", protected):
        if not part:
            continue
        is_bold = bold
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            part = part[2:-2]
            is_bold = True
        emit(part, is_bold)
    return "".join(out)


def para(text, style=None, indent=0, bold=False, size=None, color=None,
         border_bottom=False, space_after=None):
    ppr = ""
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if indent:
        ppr += f'<w:ind w:left="{indent}" w:hanging="180"/>'
    if space_after is not None:
        ppr += f'<w:spacing w:after="{space_after}"/>'
    if border_bottom:
        ppr += (
            '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" '
            'w:color="E0DBD1"/></w:pBdr>'
        )
    ppr = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr}{inline_runs(text, bold=bold, size=size, color=color)}</w:p>"


def table(rows):
    cols = max(len(r) for r in rows)
    width = 9000 // cols
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for _ in range(cols))
    trs = []
    for ri, row in enumerate(rows):
        tcs = []
        for ci in range(cols):
            txt = row[ci] if ci < len(row) else ""
            shd = (
                '<w:shd w:val="clear" w:color="auto" w:fill="F2EFE8"/>'
                if ri == 0
                else ""
            )
            cell_para = para(txt, bold=(ri == 0), size=19)
            tcs.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shd}'
                f"</w:tcPr>{cell_para}</w:tc>"
            )
        trs.append(f"<w:tr>{''.join(tcs)}</w:tr>")
    return (
        '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>'
        '<w:tblW w:w="9000" w:type="dxa"/>'
        '<w:tblLayout w:type="fixed"/></w:tblPr>'
        f"<w:tblGrid>{grid}</w:tblGrid>{''.join(trs)}</w:tbl>"
    )


STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="%s">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:eastAsia="微软雅黑" w:hAnsi="Calibri"/>
      <w:sz w:val="21"/><w:szCs w:val="21"/>
      <w:lang w:val="en-US" w:eastAsia="zh-CN"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:line="300" w:lineRule="auto" w:after="80"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="120"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="0E5B4C"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="80"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:color w:val="5C5850"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle2">
    <w:name w:val="Subtitle2"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:color w:val="8D887E"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="0E5B4C"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="260" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="23221F"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr>
      <w:ind w:left="240"/>
      <w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="D8C9A8"/></w:pBdr>
      <w:spacing w:before="60" w:after="60"/>
    </w:pPr>
    <w:rPr><w:color w:val="5C5850"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/><w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:shd w:val="clear" w:color="auto" w:fill="F4F1EA"/>
      <w:ind w:left="200"/>
      <w:spacing w:before="20" w:after="20" w:line="260" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Consolas" w:eastAsia="Consolas" w:hAnsi="Consolas"/>
      <w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="D8D2C6"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="D8D2C6"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D8D2C6"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="D8D2C6"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D8D2C6"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D8D2C6"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>
        <w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
  </w:style>
</w:styles>
""" % W_NS

def footer_xml(label):
    """页脚：标签 + 页码。"""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:ftr xmlns:w="{W_NS}">'
        '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
        '<w:r><w:rPr><w:color w:val="8D887E"/><w:sz w:val="18"/></w:rPr>'
        f'<w:t xml:space="preserve">{escape(label)}　·　</w:t></w:r>'
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
        '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        '<w:r><w:t>1</w:t></w:r>'
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
        '</w:p></w:ftr>'
    )

SECT = (
    "<w:sectPr>"
    '<w:footerReference w:type="default" r:id="rId2"/>'
    '<w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
    'w:header="851" w:footer="992" w:gutter="0"/>'
    "</w:sectPr>"
)


def build_body(md, simple_headings=False):
    lines = md.splitlines()
    body = []
    i = 0
    title_count = 0
    while i < len(lines):
        raw = lines[i].rstrip()
        line = raw.strip()

        if not line:
            i += 1
            continue

        # 代码块
        if line.startswith("```"):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                body.append(para(lines[i], style="Code"))
                i += 1
            i += 1
            continue

        # 表格
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(
                    re.fullmatch(r":?-{2,}:?", c) for c in cells if c
                ):
                    rows.append(cells)
                i += 1
            if rows:
                body.append(table(rows))
                body.append(para("", space_after=40))
            continue

        # 引用
        if line.startswith("> "):
            body.append(para(line[2:].strip(), style="Quote"))
            i += 1
            continue

        # 水平线
        if re.fullmatch(r"-{3,}", line):
            body.append(para("", border_bottom=True))
            i += 1
            continue

        # 无序列表
        if line.startswith("- "):
            body.append(para("• " + line[2:].strip(), indent=360))
            i += 1
            continue

        # 有序列表
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            body.append(para(f"{m.group(1)}. {m.group(2)}", indent=360))
            i += 1
            continue

        # 标题
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            text = line[level:].strip()
            title_count += 1
            if simple_headings:
                if title_count == 1 and level == 1:
                    style = "Title"
                elif level <= 2:
                    style = "Heading1"
                elif level == 3:
                    style = "Heading2"
                else:
                    style = "Heading3"
            elif title_count == 1:
                style = "Title"
            elif title_count == 2:
                style = "Subtitle"
            elif title_count == 3:
                style = "Subtitle2"
            elif level == 1:
                style = "Heading1"
            elif level == 2:
                style = "Heading2"
            else:
                style = "Heading3"
            body.append(para(text, style=style))
            i += 1
            continue

        # 普通段落：合并连续行
        text = line
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt:
                break
            if re.match(r"^(#{1,6}\s|[-*]\s|\d+\.\s|\||>|```|-{3,}$)", nxt):
                break
            text += nxt
            i += 1
        body.append(para(text))

    return "".join(body)


def main():
    ap = argparse.ArgumentParser(description="把 Markdown 重排为可编辑的 Word 文档")
    ap.add_argument("--src", default=SRC, help="Markdown 源文件")
    ap.add_argument("--out", default=OUT, help="Word 输出文件")
    ap.add_argument(
        "--title",
        default="域途 · 多维沃罗诺伊体验式生涯陪伴系统 · 项目方案（修订版）",
        help="文档属性标题",
    )
    ap.add_argument("--footer", default="域途 · 项目方案（修订版）", help="页脚文本")
    ap.add_argument(
        "--simple-headings",
        action="store_true",
        help="仅首个 H1 作为标题，H2/H3/H4 逐级映射为 Heading1/2/3",
    )
    args = ap.parse_args()

    with open(args.src, encoding="utf-8") as f:
        md = f.read()

    body = build_body(md, simple_headings=args.simple_headings)
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W_NS}" xmlns:r="{R_NS}">'
        f"<w:body>{body}{SECT}</w:body></w:document>"
    )

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>
"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>
"""

    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>
"""

    core = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
        ' xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f"<dc:title>{escape(args.title)}</dc:title>"
        "<dc:creator>域途项目组</dc:creator>"
        "</cp:coreProperties>"
    )

    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", STYLES)
        z.writestr("word/footer1.xml", footer_xml(args.footer))
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("docProps/core.xml", core)

    print("written:", args.out)
    print("bytes:", os.path.getsize(args.out))


if __name__ == "__main__":
    main()
