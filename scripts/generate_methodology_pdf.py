#!/usr/bin/env python3
"""
HSM Teaching Methodology — Marketing Two-Pager PDF
Portrait A4, orange-navy colour scheme (methodology.html).
Page 1: Hero + 5 Pillars
Page 2: Trinity Curriculum + Monthly Star Award + CTA
"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Fonts ──────────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont("Geo",    "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Geo-B",  "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Geo-I",  "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"))
pdfmetrics.registerFont(TTFont("Geo-BI", "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"))
registerFontFamily("Geo", normal="Geo", bold="Geo-B", italic="Geo-I", boldItalic="Geo-BI")

LOGO_PATH   = os.path.join(os.path.dirname(__file__),
              "../frontend-landing/public/HSM_Logo_Horizontal.png")
OUTPUT_PATH = os.path.expanduser("~/Downloads/HSM_Methodology_2026.pdf")

# ── Palette ────────────────────────────────────────────────────────────────────
ORANGE      = colors.HexColor("#f26b38")
ORANGE_DARK = colors.HexColor("#c84e1e")
ORANGE_LITE = colors.HexColor("#fff7ed")
NAVY        = colors.HexColor("#1a2a40")
NAVY_MID    = colors.HexColor("#243550")
LIGHT       = colors.HexColor("#f8fafc")
MUTED       = colors.HexColor("#64748b")
BORDER      = colors.HexColor("#e2e8f0")
WHITE       = colors.white
DARK        = colors.HexColor("#1e293b")
TEAL        = colors.HexColor("#0f766e")
TEAL_LITE   = colors.HexColor("#ecfdf5")
TEAL_DARK   = colors.HexColor("#134e4a")
GREEN_MID   = colors.HexColor("#166534")
GREEN_LITE  = colors.HexColor("#bbf7d0")
SLATE       = colors.HexColor("#475569")
GOLD        = colors.HexColor("#f59e0b")
GOLD_LITE   = colors.HexColor("#fffbeb")

# ── Page geometry ─────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MH = 11 * mm
MV =  9 * mm
W  = PAGE_W - 2 * MH    # ≈ 188 mm
G  = 3 * mm


def st(name, **kw):
    return ParagraphStyle(name, **kw)


# ── Reusable components ────────────────────────────────────────────────────────

def section_banner(left, right="", bg=NAVY, accent=ORANGE):
    lp = Paragraph(left,  st("sl", fontName="Geo-B", fontSize=9,   textColor=WHITE,                        alignment=TA_LEFT))
    rp = Paragraph(right, st("sr", fontName="Geo-I", fontSize=7.5, textColor=colors.HexColor("#94a3b8"),   alignment=TA_RIGHT))
    t = Table([[lp, rp]], colWidths=[W * 0.62, W * 0.38])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg),
        ("TOPPADDING",    (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 9), ("RIGHTPADDING",  (0, 0), (-1, -1), 9),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",     (0, 0), (-1, -1), 2.5, accent),
    ]))
    return t


def pillar_card(num, icon, title, body, cw, accent=ORANGE):
    header_p = Paragraph(
        f"<font color='#f26b38'>{num}</font>  {icon}  <b>{title}</b>",
        st("ph", fontName="Geo-B", fontSize=8.5, textColor=NAVY, alignment=TA_LEFT, leading=11))
    body_p = Paragraph(body,
        st("pb", fontName="Geo", fontSize=7.5, textColor=MUTED, alignment=TA_JUSTIFY, leading=11))

    hdr = Table([[header_p]], colWidths=[cw])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT),
        ("TOPPADDING",    (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8), ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEABOVE",     (0, 0), (-1, -1), 3, accent),
        ("LINEBELOW",     (0, 0), (-1, -1), 1, accent),
    ]))
    bdy = Table([[body_p]], colWidths=[cw])
    bdy.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), WHITE),
        ("TOPPADDING",    (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8), ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    card = Table([[hdr], [bdy]], colWidths=[cw])
    card.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0), ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    return card


def mini_footer(story, w):
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=BORDER, spaceAfter=3))
    fd = [[
        Paragraph("<b>Hyderabad School of Music</b>",
                  st("fl", fontName="Geo-B", fontSize=7.5, textColor=NAVY, alignment=TA_LEFT)),
        Paragraph("<font color='#f26b38'>www.hsm.org.in</font>",
                  st("fm", fontName="Geo",   fontSize=7.5, textColor=MUTED, alignment=TA_CENTER)),
        Paragraph("<font color='#f26b38'>@hyderabadschoolofmusic</font>  ·  Trial ₹2,000 (4 classes)",
                  st("fr", fontName="Geo-I", fontSize=7,   textColor=MUTED, alignment=TA_RIGHT)),
    ]]
    ft = Table(fd, colWidths=[w * 0.30, w * 0.36, w * 0.34])
    ft.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0), ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(ft)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — Hero + 5 Pillars
# ══════════════════════════════════════════════════════════════════════════════
def page_one(story):
    # ── Hero ──────────────────────────────────────────────────────────────────
    logo_cell = Spacer(38*mm, 1)
    logo_w = 40 * mm
    if os.path.exists(LOGO_PATH):
        logo = Image(LOGO_PATH)
        ratio = logo.imageHeight / logo.imageWidth
        logo.drawWidth  = logo_w
        logo.drawHeight = logo_w * ratio
        logo_cell = logo

    tag_p = Paragraph("TEACHING METHODOLOGY",
                      st("ht", fontName="Geo-B", fontSize=6.5, textColor=ORANGE,
                         alignment=TA_LEFT, letterSpacing=1.2))
    h1_p  = Paragraph(
        "Where Every Student<br/>Becomes a <font color='#f26b38'>Complete Musician</font>",
        st("h1", fontName="Geo-B", fontSize=22, textColor=WHITE,
           alignment=TA_LEFT, leading=26))
    sub_p = Paragraph(
        "Daily practice · Structured homework · Ensemble jamming<br/>"
        "Trinity College curriculum · Monthly star awards · 8 instruments",
        st("hs", fontName="Geo-I", fontSize=8, textColor=colors.HexColor("#94a3b8"),
           alignment=TA_LEFT, leading=12))

    right = Table([[tag_p], [Spacer(1, 3*mm)], [h1_p], [Spacer(1, 3*mm)], [sub_p]])
    right.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
                                ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))

    hero_inner = Table([[logo_cell, right]], colWidths=[logo_w + 6*mm, W - logo_w - 6*mm])
    hero_inner.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0), ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))

    hero = Table([[hero_inner]], colWidths=[W])
    hero.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10), ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("LINEABOVE",     (0, 0), (-1,  0), 4, ORANGE),
        ("LINEBELOW",     (0,-1), (-1, -1), 4, ORANGE),
    ]))
    story.append(hero)
    story.append(Spacer(1, 4*mm))

    # ── Quote bar ─────────────────────────────────────────────────────────────
    qbar = Table([[Paragraph(
        '"Music is not practised once a week — it is <font color=\'#f26b38\'>'
        'lived every day.</font>"',
        st("q", fontName="Geo-BI", fontSize=10, textColor=NAVY, alignment=TA_CENTER))
    ]], colWidths=[W])
    qbar.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), ORANGE_LITE),
        ("BOX",           (0, 0), (-1, -1), 1.2, ORANGE),
        ("TOPPADDING",    (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14), ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
    ]))
    story.append(qbar)
    story.append(Spacer(1, 4*mm))

    # ── Pillars banner ────────────────────────────────────────────────────────
    story.append(section_banner("  THE 5 PILLARS OF THE HSM METHOD",
                                "Our framework for musical excellence  "))
    story.append(Spacer(1, 3*mm))

    # ── Row 1: 3 pillars ──────────────────────────────────────────────────────
    C3 = (W - 2 * G) / 3

    c1 = pillar_card("01", "♩", "Daily Practice",
        "Every lesson ends with a <b>structured daily drill</b> — scales, rhythm patterns, or "
        "a short excerpt — sized for just 15–20 minutes at home. Parents receive a weekly "
        "practice guide so the home environment reinforces every class.",
        C3, ORANGE)

    c2 = pillar_card("02", "✏", "Structured Homework",
        "Teachers assign <b>targeted exercises</b> after every session — a passage to perfect, "
        "a theory worksheet, or a listening task. Students review completed work at "
        "the very next class, closing the gap between lessons.",
        C3, ORANGE)

    c3 = pillar_card("03", "♪♪", "Ensemble &amp; Jamming",
        "Regular <b>jam circles and ensemble sessions</b> unite students from all 8 instruments. "
        "Structured improvisation over chord progressions builds listening, confidence, and "
        "real-world musicianship no solo practice can replicate.",
        C3, ORANGE)

    row1 = Table([[c1, Spacer(G, 1), c2, Spacer(G, 1), c3]],
                 colWidths=[C3, G, C3, G, C3])
    row1.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(row1)
    story.append(Spacer(1, 3*mm))

    # ── Row 2: 2 pillars ──────────────────────────────────────────────────────
    C2 = (W - G) / 2

    c4 = pillar_card("04", "◈", "Trinity-Based Syllabus",
        "Our curriculum is <b>anchored in Trinity College London's Initial – Grade 8 framework</b> "
        "across all 8 instruments, enriched with Indian classical influences. Students may sit "
        "official Trinity examinations to earn globally recognised certificates at any grade.",
        C2, TEAL)

    c5 = pillar_card("05", "★", "Performance &amp; Stage Readiness",
        "<b>Recitals, internal showcases, and mock performances</b> are woven throughout the year. "
        "Every student — from first-timer to Grade 8 — is prepared for a live audience, building "
        "the confidence and stage presence that defines a true musician.",
        C2, TEAL)

    row2 = Table([[c4, Spacer(G, 1), c5]], colWidths=[C2, G, C2])
    row2.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(row2)

    # ── Page 1 footer ─────────────────────────────────────────────────────────
    mini_footer(story, W)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — Trinity Curriculum + Monthly Award + CTA
# ══════════════════════════════════════════════════════════════════════════════
def page_two(story):
    story.append(PageBreak())

    # ── Page 2 header strip ───────────────────────────────────────────────────
    hd = Table([[
        Paragraph("Hyderabad School of Music",
                  st("p2h", fontName="Geo-B", fontSize=11, textColor=WHITE, alignment=TA_LEFT)),
        Paragraph("Why HSM?",
                  st("p2s", fontName="Geo-BI", fontSize=11, textColor=ORANGE, alignment=TA_RIGHT)),
    ]], colWidths=[W * 0.6, W * 0.4])
    hd.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE",     (0, 0), (-1,  0), 4, ORANGE),
        ("LINEBELOW",     (0,-1), (-1, -1), 2, ORANGE),
    ]))
    story.append(hd)
    story.append(Spacer(1, 5*mm))

    # ── SECTION: Trinity Curriculum ───────────────────────────────────────────
    story.append(section_banner("  TRINITY COLLEGE LONDON CURRICULUM",
                                "Globally recognised · Initial through Grade 8  ",
                                bg=TEAL, accent=GREEN_LITE))
    story.append(Spacer(1, 4*mm))

    # Two column: description left, grade ladder right
    TRIN_L = W * 0.56
    TRIN_R = W * 0.44 - G

    trin_body = [
        Paragraph(
            "At HSM, learning has <b>direction</b>. Our entire curriculum is built on the "
            "Trinity College London framework — one of the world's most respected music "
            "education systems — giving every student a structured, examinable pathway "
            "from beginner all the way to advanced performance.",
            st("tb1", fontName="Geo", fontSize=8.5, textColor=DARK,
               alignment=TA_JUSTIFY, leading=13)),
        Spacer(1, 3*mm),
        Paragraph(
            "We have developed our <b>own in-house syllabus</b> that maps to Trinity's "
            "grade structure while layering in Indian classical influences, ensemble "
            "repertoire, and contemporary music — creating a uniquely HSM experience "
            "that honours both global standards and local musical heritage.",
            st("tb2", fontName="Geo", fontSize=8.5, textColor=DARK,
               alignment=TA_JUSTIFY, leading=13)),
        Spacer(1, 3*mm),
        Paragraph(
            "Students who are ready may appear for <b>official Trinity examinations</b> "
            "and earn internationally recognised certificates — a powerful milestone "
            "that validates their progress and motivates continued commitment.",
            st("tb3", fontName="Geo", fontSize=8.5, textColor=DARK,
               alignment=TA_JUSTIFY, leading=13)),
        Spacer(1, 4*mm),
        Paragraph("Instruments covered under the Trinity curriculum:",
                  st("tbl", fontName="Geo-B", fontSize=8, textColor=TEAL_DARK)),
        Spacer(1, 2*mm),
    ]
    instruments = [
        "Keyboard", "Guitar", "Piano", "Drums",
        "Tabla", "Violin", "Hindustani Vocals", "Carnatic Vocals",
    ]
    instr_cells = []
    for i in range(0, len(instruments), 2):
        row = [instruments[i]]
        if i + 1 < len(instruments):
            row.append(instruments[i + 1])
        else:
            row.append("")
        instr_cells.append([
            Paragraph(f"◆  {row[0]}", st("ic", fontName="Geo-B", fontSize=8, textColor=TEAL_DARK)),
            Paragraph(f"◆  {row[1]}", st("ic2", fontName="Geo-B", fontSize=8, textColor=TEAL_DARK)),
        ])
    instr_tbl = Table(instr_cells, colWidths=[(TRIN_L - 20) / 2, (TRIN_L - 20) / 2])
    instr_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0), ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    trin_body.append(instr_tbl)

    trin_left = Table([[item] for item in trin_body], colWidths=[TRIN_L])
    trin_left.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), TEAL_LITE),
        ("TOPPADDING",    (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (0, 0),   12),
        ("BOTTOMPADDING", (0,-1), (0,-1),   10),
        ("LINEABOVE",     (0, 0), (-1, 0),  3, TEAL),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
    ]))

    # Grade ladder (right column)
    grades = [
        ("Initial", "First steps — basics of pitch, rhythm, notation"),
        ("Grade 1", "Simple melodies, reading notation, clean technique"),
        ("Grade 2", "Greater range, dynamics, elementary repertoire"),
        ("Grade 3", "Fluency, musical expression, sight-reading"),
        ("Grade 4", "Intermediate repertoire, stylistic awareness"),
        ("Grade 5", "Technical depth, extended pieces, aural skills"),
        ("Grade 6", "Performance standard, complex harmony"),
        ("Grade 7", "Advanced technique and musical interpretation"),
        ("Grade 8", "Near-professional level — concert standard"),
    ]
    grade_rows = []
    for i, (g, desc) in enumerate(grades):
        bg = TEAL if i in (0, 4, 8) else (colors.HexColor("#d1fae5") if i % 2 == 0 else WHITE)
        tc = WHITE if i in (0, 4, 8) else TEAL_DARK
        dc = WHITE if i in (0, 4, 8) else DARK
        grade_rows.append([
            Paragraph(g, st(f"g{i}a", fontName="Geo-B",  fontSize=7.5, textColor=tc)),
            Paragraph(desc, st(f"g{i}b", fontName="Geo", fontSize=6.5, textColor=dc, leading=9)),
        ])
    grade_tbl = Table(grade_rows, colWidths=[18*mm, TRIN_R - 18*mm])
    grade_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6), ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND",    (0, 0), (-1, 0),  TEAL),
        ("BACKGROUND",    (0, 4), (-1, 4),  colors.HexColor("#0d9488")),
        ("BACKGROUND",    (0, 8), (-1, 8),  colors.HexColor("#134e4a")),
        ("ROWBACKGROUNDS",(0, 1), (-1, 7),  [colors.HexColor("#d1fae5"), WHITE]),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.4, BORDER),
        ("BOX",           (0, 0), (-1, -1), 1, TEAL),
    ]))

    grade_label = Paragraph("Grade Progression Ladder",
        st("gl", fontName="Geo-B", fontSize=8, textColor=WHITE, alignment=TA_CENTER))
    grade_header = Table([[grade_label]], colWidths=[TRIN_R])
    grade_header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), TEAL_DARK),
        ("TOPPADDING",    (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6), ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("LINEABOVE",     (0, 0), (-1, 0),  3, GREEN_LITE),
    ]))

    grade_col = Table([[grade_header], [grade_tbl]], colWidths=[TRIN_R])
    grade_col.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("BOX",(0,0),(-1,-1),1,BORDER),
    ]))

    trinity_row = Table([[trin_left, Spacer(G, 1), grade_col]], colWidths=[TRIN_L, G, TRIN_R])
    trinity_row.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(trinity_row)
    story.append(Spacer(1, 5*mm))

    # ── SECTION: Monthly Star Award ────────────────────────────────────────────
    story.append(section_banner("  MONTHLY STAR AWARD",
                                "Healthy competition across all instruments  ",
                                bg=colors.HexColor("#78350f"), accent=GOLD))
    story.append(Spacer(1, 4*mm))

    AW_L = W * 0.55
    AW_R = W * 0.45 - G

    award_body_paras = [
        Paragraph(
            "Great musicians are not just technically skilled — they are <b>committed, consistent, "
            "and inspired</b>. The HSM Monthly Star Award is our way of celebrating that commitment "
            "and sparking healthy competition across every instrument.",
            st("aw1", fontName="Geo", fontSize=8.5, textColor=DARK, alignment=TA_JUSTIFY, leading=13)),
        Spacer(1, 3*mm),
        Paragraph(
            "At the end of each month, every enrolled student — regardless of instrument or grade — "
            "is evaluated on <b>four equal criteria</b>. The student with the highest combined score "
            "across all instruments wins the month's award.",
            st("aw2", fontName="Geo", fontSize=8.5, textColor=DARK, alignment=TA_JUSTIFY, leading=13)),
        Spacer(1, 3*mm),
        Paragraph(
            "Winners receive a <b>personalised trophy</b>, a framed certificate signed by the HSM "
            "director, and a permanent feature on the <b>HSM Wall of Fame</b> displayed at the school. "
            "This cross-instrument recognition lifts the energy of every student — and reminds parents "
            "that consistency is just as important as talent.",
            st("aw3", fontName="Geo", fontSize=8.5, textColor=DARK, alignment=TA_JUSTIFY, leading=13)),
    ]

    award_left = Table([[p] for p in award_body_paras], colWidths=[AW_L])
    award_left.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), GOLD_LITE),
        ("TOPPADDING",    (0, 0), (0, 0),   12),
        ("TOPPADDING",    (0, 1), (-1, -1),  0),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -2),  0),
        ("LEFTPADDING",   (0, 0), (-1, -1),  10),
        ("RIGHTPADDING",  (0, 0), (-1, -1),  10),
        ("LINEABOVE",     (0, 0), (-1, 0),   3, GOLD),
        ("BOX",           (0, 0), (-1, -1),  1, BORDER),
    ]))

    # Criteria scorecard (right column)
    criteria = [
        ("Attendance",             "Class attendance rate across the month"),
        ("Daily Practice",         "Practice log entries submitted to teacher"),
        ("Homework Completion",    "Exercises & worksheets submitted on time"),
        ("Ensemble Participation", "Jam sessions, ensemble & group events"),
    ]
    crit_header = Table([[
        Paragraph("Evaluation Criteria",
                  st("ch", fontName="Geo-B", fontSize=8, textColor=WHITE, alignment=TA_CENTER))
    ]], colWidths=[AW_R])
    crit_header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#78350f")),
        ("TOPPADDING",    (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8), ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEABOVE",     (0, 0), (-1, 0),  3, GOLD),
    ]))

    crit_rows = []
    for i, (title, desc) in enumerate(criteria):
        bg = colors.HexColor("#fffbeb") if i % 2 == 0 else WHITE
        crit_rows.append([
            Paragraph(f"{'①②③④'[i]}  {title}",
                      st(f"ct{i}", fontName="Geo-B", fontSize=8, textColor=colors.HexColor("#78350f"))),
            Paragraph(desc,
                      st(f"cd{i}", fontName="Geo", fontSize=7, textColor=MUTED, leading=10)),
        ])
    crit_tbl = Table(crit_rows, colWidths=[AW_R * 0.45, AW_R * 0.55])
    crit_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8), ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [colors.HexColor("#fffbeb"), WHITE]),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.4, BORDER),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
    ]))

    # Prize callout
    prize = Table([[Paragraph(
        "Trophy  ·  Certificate  ·  Wall of Fame",
        st("pr", fontName="Geo-B", fontSize=8, textColor=colors.HexColor("#78350f"), alignment=TA_CENTER)
    )]], colWidths=[AW_R])
    prize.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), GOLD_LITE),
        ("TOPPADDING",    (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8), ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, -1), 2, GOLD),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
    ]))

    award_right = Table([[crit_header], [crit_tbl], [prize]], colWidths=[AW_R])
    award_right.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    ]))

    award_row = Table([[award_left, Spacer(G, 1), award_right]], colWidths=[AW_L, G, AW_R])
    award_row.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(award_row)
    story.append(Spacer(1, 5*mm))

    # ── CTA Banner ─────────────────────────────────────────────────────────────
    cta = Table([[
        Paragraph("Ready to begin?",
                  st("ca", fontName="Geo-B", fontSize=12, textColor=WHITE, alignment=TA_LEFT)),
        Paragraph(
            "Trial package: <b>₹2,000</b> · 4 classes over 2 weeks · All instruments",
            st("cb", fontName="Geo", fontSize=9, textColor=colors.HexColor("#fdba74"),
               alignment=TA_CENTER)),
        Paragraph(
            "<b>www.hsm.org.in</b><br/><font color='#f26b38'>@hyderabadschoolofmusic</font>",
            st("cc", fontName="Geo-B", fontSize=8, textColor=WHITE, alignment=TA_RIGHT)),
    ]], colWidths=[W * 0.28, W * 0.44, W * 0.28])
    cta.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10), ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE",     (0, 0), (-1,  0), 3, ORANGE),
        ("LINEBELOW",     (0,-1), (-1, -1), 3, ORANGE),
    ]))
    story.append(cta)

    # ── Page 2 footer ─────────────────────────────────────────────────────────
    mini_footer(story, W)


# ── Build ──────────────────────────────────────────────────────────────────────
def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        leftMargin=MH, rightMargin=MH,
        topMargin=MV, bottomMargin=MV,
    )
    story = []
    page_one(story)
    page_two(story)
    doc.build(story)
    print(f"PDF saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
