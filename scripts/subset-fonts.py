#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Subset a CJK font into small WOFF2 web fonts for this site.

Character policy
----------------
1. GB2312 level-1 hanzi (3755 常用字)  — the backbone of Chinese web text
2. GB2312 standard symbols: 标点 / 序号 / 全角 ASCII / 希腊字母
3. ASCII + Latin-1 (digits, letters, accented Latin)
4. Extra web symbols that the source font actually contains
   (arrows, marks, shapes, units, currency)
5. A hand-picked list of ~300 生僻字 that really do show up
   (names, mythology, memes, high-frequency traditional forms)
6. Every character used by this project's own source text

Usage
-----
    pip install fonttools brotli
    python scripts/subset-fonts.py                 # -> assets/*.woff2
    python scripts/subset-fonts.py --weights Regular
"""
import argparse
import glob
import io
import os
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, "assets")
FONT_FILES = {
    "Regular": "HarmonyOS_Sans_SC_Regular.ttf",
    "Bold": "HarmonyOS_Sans_SC_Bold.ttf",
}

# ── 手选生僻字 ──────────────────────────────────────────────────────────────
# 人名字用字 / 寓意字
NAMES = (
    "喆昇珺玥垚犇淼焱燊骉羴猋麤馫琰璟瑜瑾琛琦琪璐瑄玧彧昱晟晞昊晗暄曜曦"
    "玺瑀珩珉琚琤瑭瑨瓅皞祎禛镕昶晢曌焜煊煜烨炜熠燚铖钰锴龑昉旻昕杲炅沄"
    "洢洺湜滢滟澍灏頔颢顼蓥鑫"
)
# 神话 / 古籍 / 成语
CLASSIC = (
    "饕餮麒麟貔貅螭虺鸑鷟狻猊睚眦狴犴赑屃魑魅魍魉鲲龃龉耄耋氤氲迤逦蘖龋龌龊"
    "颉颃颛颔颏颧颞颟颥颦龛夔鬻鬣黠黩黟黉陟隍阗阙阆阊阒阋阍阕阖闾阚龆龇龅龀"
    "瓒圭璧琮璜璋"
)
# 网络 / 昵称里的生僻字
NET = "囧槑烎兲巭嫑嘦恏忈玊尛氼亖卍卐龘靐齉齾爩灪龖龗鱻嚞壵㵘䨻㙓屮艸茻朤屾"
# 姓氏、地名、器物里会撞见但不在常用字表的字
MISC = (
    "亓仝佟佘冼郜訾逯暨昝晁郄郗禚遆仉佴侴冮凃剡郐郾戢戡訇谯"
    "瓤毳氅氇畲畋畛疃瘗瘼癔瘘皴盥眭睨矬窈窕窨籴粜粝糁糇糌糍臬舄舨舾艄艋艨艽"
)
# 高频繁体字（引用原文、港澳台姓名时少回退）
TRAD = "華國龍鳳雲飛門東車馬長陽時實學覺氣無為與這個來說對從業務義處臺灣鄭劉張陳黃吳"
RARE = NAMES + CLASSIC + NET + MISC + TRAD

EXTRA_SYMBOLS = (
    "→←↑↓↔↕⇄⇅⇒⇐⇔⇧⌘⌥⌫⇥⏎"
    "✓✔✕✖✗✘✚✜✪❌❎❓❔❕❗‼⁉⚠♠♣♥♦♪♫☀☁☂☎☏☕☺☻♨♻⚡⚙⚑"
    "★☆✦✧❖●○◎◉■□▲△▼▽◆◇◈▪▫▬►◄▶◀◢◣◤◥◯⬤"
    "℃℉№™℅‰‱′″‴※§¶†‡•‥…—–‐‑‒―"
    "±×÷≠≤≥≈≡∞∅∑∏√∛∫∂∆∇∈∉∋∝∠⊥∥∪∩⊂⊃⊆⊇⊕⊗⊙−∗∘"
    "₽₹₩₺₴₦₫฿₿¢£¤¥€￠￡￥￦"
    "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ"
    "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⒈⒉⒊⒋⒌"
    "〓々〆〇〜〝〞〟゛゜"
    "㎎㎏㎜㎝㎞㎡㎥㎐㎑㎒㎓㏑㏒㏕№"
    "©®™°µ·"
)


def gb2312_rows(rows):
    """Decode the given GB2312 rows (A1..A9) and return the characters."""
    out = set()
    for row in rows:
        for lo in range(0xA1, 0xFF):
            try:
                out.add(bytes([row, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                continue
    return out


def gb2312_hanzi_level1():
    """GB2312 一级汉字 (rows B0-D7), i.e. the 3755 常用字."""
    out = []
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode("gb2312")
            except UnicodeDecodeError:
                continue
            if "\u4e00" <= ch <= "\u9fff":
                out.append(ch)
    return out


def project_text_chars():
    """Characters already used by this project's own sources."""
    chars = set()
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "public", "assets", ".tmp-font")]
        for fn in files:
            if fn.lower().endswith((".html", ".css", ".md", ".yaml", ".yml", ".js", ".json")):
                try:
                    with open(os.path.join(root, fn), encoding="utf-8") as fh:
                        chars |= set(fh.read())
                except (OSError, UnicodeDecodeError):
                    pass
    return chars


def build_charset():
    chars = (
        set(gb2312_hanzi_level1())
        | gb2312_rows([0xA1, 0xA2, 0xA3, 0xA6])
        | {chr(c) for c in range(0x20, 0x7F)}      # ASCII
        | {chr(c) for c in range(0xA0, 0x100)}     # Latin-1
        | set(EXTRA_SYMBOLS)
        | set(RARE)
        | project_text_chars()
    )
    return {c for c in chars if c}


def find_font(weight, font_dirs):
    for d in font_dirs:
        for pattern in ("**/" + FONT_FILES[weight], "**/*HarmonyOS*%s*.ttf" % weight):
            hits = glob.glob(os.path.join(d, pattern), recursive=True)
            if hits:
                return hits[0]
    raise SystemExit("找不到字体文件: %s" % FONT_FILES[weight])


def subset_one(src, chars, out_path):
    font = TTFont(src, lazy=True)
    cmap = font.getBestCmap()
    font.close()

    use = "".join(sorted(c for c in chars if ord(c) in cmap))
    missing = sorted(c for c in chars if ord(c) not in cmap)

    opts = subset.Options()
    opts.flavor = "woff2"
    # 只保留横排需要的拉丁特性（连字/字距/分数等），丢掉 vert/vrt2 等竖排与风格集
    opts.layout_features = ["calt", "case", "dnom", "frac", "liga", "locl",
                            "numr", "ordn", "pnum", "tnum", "kern"]
    opts.name_IDs = ["*"]
    opts.name_legacy = True
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG", "FFTM"]

    font = TTFont(src)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(text=use)
    subsetter.subset(font)
    font.flavor = "woff2"
    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    with open(out_path, "wb") as fh:
        fh.write(data)
    glyphs = font["maxp"].numGlyphs
    font.close()
    return len(use), glyphs, len(data), missing


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--weights", default="Regular,Bold",
                    help="comma separated weights (default: Regular,Bold)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output dir (default: assets)")
    ap.add_argument("--font-dir", action="append", default=None,
                    help="directory to search for the source TTFs (repeatable)")
    args = ap.parse_args()

    font_dirs = args.font_dir or [
        os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Microsoft\Windows\Fonts"),
        os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts"),
    ]
    os.makedirs(args.out, exist_ok=True)
    charset = build_charset()
    print("charset: %d codepoints (含 %d 个手选生僻字)"
          % (len(charset), len(set(RARE))))

    total = 0
    for weight in [w.strip() for w in args.weights.split(",") if w.strip()]:
        src = find_font(weight, font_dirs)
        out = os.path.join(args.out, "HarmonyOS-Sans-SC-%s.woff2" % weight)
        n, glyphs, size, missing = subset_one(src, charset, out)
        total += size
        print("%-8s %5d chars %5d glyphs %7.1f KiB  ->  %s"
              % (weight, n, glyphs, size / 1024, os.path.relpath(out, ROOT)))
        if missing:
            print("         %d 个字符源字体本身没有，已跳过" % len(missing))
    print("total: %.1f KiB" % (total / 1024))


if __name__ == "__main__":
    sys.exit(main())
