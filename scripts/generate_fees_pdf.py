#!/usr/bin/env python3
"""Generate HSM fees structure one-pager PDF for prospective students.
Data sourced from production fee_structures table (HSM Main branch, 2026).
"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Georgia TTF family (supports ₹ symbol on macOS)
pdfmetrics.registerFont(TTFont("Georgia",            "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold",       "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic",     "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-BoldItalic", "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Georgia",
    normal="Georgia", bold="Georgia-Bold",
    italic="Georgia-Italic", boldItalic="Georgia-BoldItalic")

OUTPUT_PATH = os.path.expanduser("~/Downloads/HSM_Fees_Structure_2026.pdf")

# ── Brand colours ─────────────────────────────────────────────────────────────
MAROON       = colors.HexColor("#7B1C2C")
GOLD         = colors.HexColor("#C8973A")
GOLD_LIGHT   = colors.HexColor("#FFF8ED")
Q_BG         = colors.HexColor("#FFF3CD")   # quarterly highlight bg
Q_BORDER     = colors.HexColor("#C8973A")   # quarterly border
ROW_ALT      = colors.HexColor("#F9F9F9")
HDR_BG       = colors.HexColor("#F3EEF0")   # table header bg (light maroon tint)
GREEN        = colors.HexColor("#2E7D32")
MID_GRAY     = colors.HexColor("#666666")
LIGHT_GRAY   = colors.HexColor("#EEEEEE")
WHITE        = colors.white
DARK         = colors.HexColor("#1A1A1A")

# ── Trinity grades ────────────────────────────────────────────────────────────
GRADES = ['Initial', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
          'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8']

# ── Production data (HSM Main, effective 2026-04-01) ─────────────────────────
# Format: (grade, monthly_8cls, quarterly_24cls)  quarterly=0 → not offered
GUITAR_KB = [
    ('Initial',  4500,  8550),
    ('Grade 1',  4500,  8550),
    ('Grade 2',  5000, 10050),
    ('Grade 3',  5000, 10050),
    ('Grade 4',  5700, 12150),
    ('Grade 5',  6300, 13950),
    ('Grade 6',  7300, 16950),
    ('Grade 7',  8300, 19950),
    ('Grade 8',  9300, 22950),
]
PIANO = [
    ('Initial',  4800,  9150),
    ('Grade 1',  4800,  9150),
    ('Grade 2',  5300, 10650),
    ('Grade 3',  5300, 10650),
    ('Grade 4',  6000, 12750),
    ('Grade 5',  6600, 14550),
    ('Grade 6',  7600, 17550),
    ('Grade 7',  8600, 20550),
    ('Grade 8',  9600, 23550),
]
DRUMS_TABLA = [
    ('Initial',  5400, 10845),
    ('Grade 1',  5400, 10845),
    ('Grade 2',  5800, 12045),
    ('Grade 3',  5800, 12045),
    ('Grade 4',  6500, 14145),
    ('Grade 5',  7100, 15945),
    ('Grade 6',  8100, 18945),
    ('Grade 7',  9100, 21945),
    ('Grade 8', 10100, 24945),
]
VIOLIN = [
    ('Initial',  3900, 0),
    ('Grade 1',  3900, 0),
    ('Grade 2',  4400, 0),
    ('Grade 3',  4400, 0),
    ('Grade 4',  5100, 0),
    ('Grade 5',  5700, 0),
    ('Grade 6',  6700, 0),
    ('Grade 7',  7700, 0),
    ('Grade 8',  8700, 0),
]
TRIAL_FEE = 2000  # 4 classes, all instruments

# ── Helpers ───────────────────────────────────────────────────────────────────
def r(v):
    return f"₹{int(v):,}" if v else "—"

def pct_save(monthly, quarterly):
    """Quarterly saving as % of 3× monthly."""
    three_month = monthly * 3
    if not quarterly or quarterly >= three_month:
        return 0
    return round((three_month - quarterly) / three_month * 100)

# ── Styles ────────────────────────────────────────────────────────────────────
def s(name, **kw):
    return ParagraphStyle(name, **kw)

H1  = s("H1",  fontName="Georgia-Bold",   fontSize=18, textColor=MAROON, alignment=TA_CENTER, spaceAfter=1)
H1S = s("H1S", fontName="Georgia",        fontSize=9,  textColor=GOLD,   alignment=TA_CENTER, spaceAfter=0)
TAG = s("TAG", fontName="Georgia-Italic",fontSize=8,  textColor=MID_GRAY, alignment=TA_CENTER, spaceAfter=2)

SEC = s("SEC", fontName="Georgia-Bold",   fontSize=8,  textColor=WHITE,  alignment=TA_CENTER)
INS = s("INS", fontName="Georgia-Bold",   fontSize=7.5, textColor=DARK,  alignment=TA_LEFT)
GRD = s("GRD", fontName="Georgia",        fontSize=7,  textColor=DARK,   alignment=TA_LEFT)
MON = s("MON", fontName="Georgia",        fontSize=7,  textColor=DARK,   alignment=TA_RIGHT)
QRT = s("QRT", fontName="Georgia-Bold",   fontSize=7,  textColor=MAROON, alignment=TA_RIGHT)
SAV = s("SAV", fontName="Georgia-Bold",   fontSize=6.5, textColor=GREEN, alignment=TA_RIGHT)
DIM = s("DIM", fontName="Georgia",        fontSize=6,  textColor=MID_GRAY, alignment=TA_RIGHT)
TH  = s("TH",  fontName="Georgia-Bold",   fontSize=6.5, textColor=WHITE, alignment=TA_CENTER)
NT  = s("NT",  fontName="Georgia",        fontSize=7,  textColor=MID_GRAY, leading=10)
FT  = s("FT",  fontName="Georgia-Italic",fontSize=7,  textColor=MID_GRAY, alignment=TA_CENTER)

# ── Grade table builder ───────────────────────────────────────────────────────
def grade_table(data, has_quarterly=True, col_w=None):
    """
    Build a compact grade fee table.
    data: list of (grade, monthly, quarterly)
    """
    if col_w is None:
        col_w = [24*mm, 18*mm, 18*mm, 14*mm] if has_quarterly else [28*mm, 22*mm]

    if has_quarterly:
        header = [
            Paragraph("Grade", TH),
            Paragraph("Monthly", TH),
            Paragraph("Quarterly ★", TH),
            Paragraph("Save", TH),
        ]
    else:
        header = [
            Paragraph("Grade", TH),
            Paragraph("Monthly (8 cls)", TH),
        ]

    rows = [header]
    for i, (grade, monthly, quarterly) in enumerate(data):
        if has_quarterly:
            save = pct_save(monthly, quarterly)
            save_txt = Paragraph(f"{save}% off" if save else "—", SAV)
            rows.append([
                Paragraph(grade, GRD),
                Paragraph(r(monthly), MON),
                Paragraph(r(quarterly), QRT),
                save_txt,
            ])
        else:
            rows.append([
                Paragraph(grade, GRD),
                Paragraph(r(monthly), MON),
            ])

    t = Table(rows, colWidths=col_w)
    row_styles = []
    for i in range(1, len(rows)):
        bg = WHITE if i % 2 == 1 else ROW_ALT
        row_styles.append(("BACKGROUND", (0, i), (-1, i), bg))
        if has_quarterly:
            row_styles.append(("BACKGROUND", (2, i), (3, i), Q_BG))

    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), MAROON),
        ("TEXTCOLOR",  (0, 0), (-1, 0), WHITE),
        ("GRID",       (0, 0), (-1, -1), 0.3, LIGHT_GRAY),
        ("LINEBELOW",  (0, 0), (-1, 0), 1, GOLD),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",      (1, 0), (-1, 0), "CENTER"),
    ] + row_styles)

    if has_quarterly:
        for i in range(1, len(rows)):
            ts.add("BOX", (2, i), (3, i), 0.5, Q_BORDER)

    t.setStyle(ts)
    return t

# ── Section label ─────────────────────────────────────────────────────────────
def section_label(text):
    data = [[Paragraph(text, SEC)]]
    t = Table(data, colWidths=[None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MAROON),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    return t

# ── Instrument card wrapper ───────────────────────────────────────────────────
def instrument_card(title, subtitle, inner_table):
    title_data = [[
        Paragraph(title, s("CT", fontName="Georgia-Bold", fontSize=8.5, textColor=WHITE)),
        Paragraph(subtitle, s("CS", fontName="Georgia", fontSize=6.5, textColor=colors.HexColor("#FFDDCC"), alignment=TA_RIGHT)),
    ]]
    title_row = Table(title_data, colWidths=["60%", "40%"])
    title_row.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MAROON),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",     (0, 0), (-1, -1), 1.5, GOLD),
    ]))
    card_data = [[title_row], [inner_table]]
    card = Table(card_data)
    card.setStyle(TableStyle([
        ("BOX",     (0, 0), (-1, -1), 1, MAROON),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    return card

# ── Main PDF builder ──────────────────────────────────────────────────────────
def build_pdf():
    PAGE = landscape(A4)  # 297 × 210 mm
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=PAGE,
        leftMargin=12*mm,
        rightMargin=12*mm,
        topMargin=10*mm,
        bottomMargin=10*mm,
    )
    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph("Hyderabad School of Music", H1))
    story.append(Paragraph("Fee Structure — Academic Year 2026", H1S))
    story.append(Paragraph("Effective April 2026  •  HSM Main Branch  •  Trinity Grade–Based Pricing", TAG))
    story.append(HRFlowable(width="100%", thickness=2, color=MAROON, spaceAfter=5))

    # ── Trial callout ─────────────────────────────────────────────────────────
    trial_data = [[
        Paragraph(
            f"<b>Trial Session: {r(TRIAL_FEE)}</b>  (4 classes over 2 weeks) — Available for all instruments",
            s("TR", fontName="Georgia-Bold", fontSize=8, textColor=DARK)
        )
    ]]
    trial_tbl = Table(trial_data, colWidths=["100%"])
    trial_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), GOLD_LIGHT),
        ("BOX",           (0, 0), (-1, -1), 1, GOLD),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
    ]))
    story.append(trial_tbl)
    story.append(Spacer(1, 5))

    # ── Instrument tables in 3-column grid ────────────────────────────────────
    # Col widths: 3 columns across landscape A4 minus margins
    # Available width ≈ 297 - 24 = 273mm  → 91mm each
    COL = 90*mm
    GW_Q  = [26*mm, 18*mm, 20*mm, 14*mm]   # grade, monthly, quarterly, save
    GW_M  = [26*mm, 22*mm]                  # grade, monthly (violin)

    guitar_kb_tbl = grade_table(GUITAR_KB, has_quarterly=True,  col_w=GW_Q)
    piano_tbl     = grade_table(PIANO,     has_quarterly=True,  col_w=GW_Q)
    drums_tbl     = grade_table(DRUMS_TABLA, has_quarterly=True, col_w=GW_Q)
    tabla_tbl     = grade_table(DRUMS_TABLA, has_quarterly=True, col_w=GW_Q)
    violin_tbl    = grade_table(VIOLIN,    has_quarterly=False, col_w=GW_M)

    gk_card = instrument_card("Guitar  /  Keyboard", "Trinity graded · 8 or 24 classes", guitar_kb_tbl)
    pi_card = instrument_card("Piano",                "Trinity graded · 8 or 24 classes", piano_tbl)
    dr_card = instrument_card("Drums",                "Trinity graded · 8 or 24 classes", drums_tbl)
    tb_card = instrument_card("Tabla",                "Trinity graded · 8 or 24 classes", tabla_tbl)
    vl_card = instrument_card("Violin",               "Trinity graded · Monthly only",     violin_tbl)

    # Column 3: Vocals + Quarterly highlight note
    vocal_rows = [
        [
            Paragraph("Instrument", TH),
            Paragraph("Monthly (8 cls)", TH),
        ],
        [Paragraph("Hindustani Vocals", GRD), Paragraph(r(3500), QRT)],
        [Paragraph("Carnatic Vocals",   GRD), Paragraph(r(2299), QRT)],
    ]
    vocal_tbl = Table(vocal_rows, colWidths=[36*mm, 26*mm])
    vocal_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), MAROON),
        ("BACKGROUND",    (0, 1), (-1, -1), Q_BG),
        ("GRID",          (0, 0), (-1, -1), 0.3, LIGHT_GRAY),
        ("LINEBELOW",     (0, 0), (-1, 0), 1, GOLD),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    vocal_card = instrument_card("Vocals", "Hindustani & Carnatic · Fixed rate", vocal_tbl)

    # 3-column grid: Violin moves into Col 3, Row 2
    grid = Table(
        [
            [gk_card,       dr_card,  vocal_card],
            [Spacer(1, 4),  Spacer(1, 4), Spacer(1, 4)],
            [pi_card,       tb_card,  vl_card],
        ],
        colWidths=[COL, COL, COL],
        hAlign="LEFT",
    )
    grid.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 3),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 3),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(grid)
    story.append(Spacer(1, 4))

    # ── Quarterly callout — full-width banner ─────────────────────────────────
    q_banner_data = [[
        Paragraph(
            "★  <b>Quarterly Plan Recommended:</b>  Lock in 24 classes and save up to 37% vs paying month-by-month.  "
            "Best value for committed learners.  |  <i>Violin: Monthly plan only — no quarterly option.</i>",
            s("QB", fontName="Georgia", fontSize=7.5, textColor=DARK, leading=11)
        )
    ]]
    q_banner = Table(q_banner_data, colWidths=["100%"])
    q_banner.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), Q_BG),
        ("BOX",           (0, 0), (-1, -1), 1.2, Q_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
    ]))
    story.append(q_banner)

    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.8, color=LIGHT_GRAY, spaceAfter=4))

    # ── Notes row ─────────────────────────────────────────────────────────────
    notes = [
        "• 8 classes/month = 2 classes/week (approx 4 weeks).",
        "• 24 classes = Quarterly plan ≈ 3 months.",
        "• All fees are for HSM Main branch. Pbel City branch rates differ.",
        "• Fees are subject to revision each academic year.",
        "• For admissions & queries, please speak to the front desk.",
    ]
    notes_para = [Paragraph(n, NT) for n in notes]
    notes_data = [[p] for p in notes_para]
    notes_tbl = Table(notes_data)
    notes_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
    ]))

    footer_para = Paragraph(
        "Hyderabad School of Music  •  hyderabadschoolofmusic.com  •  Valid April – December 2026",
        FT
    )

    bottom_row = Table(
        [[notes_tbl, footer_para]],
        colWidths=["70%", "30%"],
    )
    bottom_row.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(bottom_row)

    doc.build(story)
    print(f"PDF saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
