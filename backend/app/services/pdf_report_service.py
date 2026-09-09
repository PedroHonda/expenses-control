import datetime as dt
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.expense import MonthlySummaryItem

# Same design tokens as the frontend's Tailwind palette (see
# frontend/src/App.tsx / SummaryCards.tsx) -- the PDF is meant to look like
# an extension of the on-screen Reports view, not a generic report.
_EMERALD_600 = colors.HexColor("#059669")
_SLATE_100 = colors.HexColor("#f1f5f9")
_SLATE_200 = colors.HexColor("#e2e8f0")
_SLATE_500 = colors.HexColor("#64748b")
_SLATE_900 = colors.HexColor("#0f172a")
_WHITE = colors.white

# Same 12-color hash palette as frontend/src/lib/categoryColor.ts's
# `PALETTE`, as (badge background, badge text) hex pairs -- Tailwind's
# -100/-700 shades, same order -- so a category renders in the exact same
# color here as its on-screen `CategoryBadge`.
_CATEGORY_BADGE_PALETTE = [
    ("#ffe4e6", "#be123c"),  # rose
    ("#ffedd5", "#c2410c"),  # orange
    ("#fef3c7", "#b45309"),  # amber
    ("#ecfccb", "#4d7c0f"),  # lime
    ("#d1fae5", "#047857"),  # emerald
    ("#ccfbf1", "#0f766e"),  # teal
    ("#cffafe", "#0e7490"),  # cyan
    ("#e0f2fe", "#0369a1"),  # sky
    ("#e0e7ff", "#4338ca"),  # indigo
    ("#ede9fe", "#6d28d9"),  # violet
    ("#fae8ff", "#a21caf"),  # fuchsia
    ("#fce7f3", "#be185d"),  # pink
]

_CARD_GAP = 0.4 * cm


class EmptyPivotError(Exception):
    """Raised when no `MonthlySummaryItem` matches the selected categories --
    mirrors `ReportsView`'s "No expenses for the selected categories and
    date range" empty state, just as a 404 instead of an empty table."""


def _format_currency(value: float) -> str:
    """pt-BR/BRL grouping (e.g. 1234.5 -> "R$ 1.234,50"), hand-rolled rather
    than the stdlib `locale` module -- same reasoning as
    frontend/src/lib/format.ts's `formatCurrency`: this shouldn't depend on
    a pt_BR locale being installed on the machine running the backend."""
    sign = "-" if value < 0 else ""
    integer_part, _, decimal_part = f"{abs(value):.2f}".partition(".")
    grouped = f"{int(integer_part):,}".replace(",", ".")
    return f"{sign}R$ {grouped},{decimal_part}"


def _month_label(year: int, month: int) -> str:
    return f"{month:02d}/{year}"


def _period_label(date_from: dt.date | None, date_to: dt.date | None) -> str:
    if date_from is None and date_to is None:
        return "All time"
    start = date_from.strftime("%d/%m/%Y") if date_from else "…"
    end = date_to.strftime("%d/%m/%Y") if date_to else "…"
    return f"{start} – {end}"


def build_filename(date_from: dt.date | None, date_to: dt.date | None) -> str:
    if date_from is None and date_to is None:
        return "relatorio_mensal_todos_os_periodos.pdf"
    start = date_from.isoformat() if date_from else "inicio"
    end = date_to.isoformat() if date_to else "fim"
    return f"relatorio_mensal_{start}_a_{end}.pdf"


def _category_badge_colors(name: str) -> tuple[colors.Color, colors.Color]:
    """Ports `categoryColorClasses`'s hash exactly: the same per-character
    32-bit-wrapping `hash * 31 + charCode` (JS's `| 0`) over the same
    12-color palette length, so a category's PDF cell always lands on the
    same color as its on-screen `CategoryBadge`."""
    hash_value = 0
    for ch in name:
        hash_value = (hash_value * 31 + ord(ch)) & 0xFFFFFFFF
        if hash_value >= 0x80000000:
            hash_value -= 0x100000000
    bg_hex, text_hex = _CATEGORY_BADGE_PALETTE[abs(hash_value) % len(_CATEGORY_BADGE_PALETTE)]
    return colors.HexColor(bg_hex), colors.HexColor(text_hex)


def _rounded_card_style(*, background: colors.Color = _WHITE) -> TableStyle:
    """The `rounded-lg border border-slate-200` card look used everywhere in
    the frontend (`SummaryCards`, the Reports view's chart/table panels)."""
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), background),
            ("BOX", (0, 0), (-1, -1), 1, _SLATE_200),
            ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )


def _stat_card(label: str, value: str, width: float) -> Table:
    """Mirrors `SummaryCards`'s stat tile: a bordered white card, a small
    slate label above a large bold value."""
    label_style = ParagraphStyle(
        "stat_label", fontName="Helvetica-Bold", fontSize=8, textColor=_SLATE_500, leading=10
    )
    value_style = ParagraphStyle(
        "stat_value", fontName="Helvetica-Bold", fontSize=15, textColor=_SLATE_900, leading=18
    )
    card = Table(
        [[Paragraph(label.upper(), label_style)], [Paragraph(value, value_style)]],
        colWidths=[width],
    )
    style = _rounded_card_style()
    style.add("TOPPADDING", (0, 0), (0, 0), 10)
    style.add("BOTTOMPADDING", (0, 0), (0, 0), 1)
    style.add("TOPPADDING", (0, 1), (0, 1), 1)
    style.add("BOTTOMPADDING", (0, 1), (0, 1), 10)
    style.add("LEFTPADDING", (0, 0), (-1, -1), 12)
    style.add("RIGHTPADDING", (0, 0), (-1, -1), 12)
    card.setStyle(style)
    return card


def _banner(*, content_width: float, period_label: str, generated_at: str) -> Table:
    """The emerald header band, echoing `App.tsx`'s brand header
    (`Wallet` icon + "Expense Tracker" in the app's accent color)."""
    title_style = ParagraphStyle(
        "banner_title", fontName="Helvetica-Bold", fontSize=17, textColor=_WHITE, leading=21
    )
    subtitle_style = ParagraphStyle(
        "banner_subtitle", fontName="Helvetica", fontSize=10.5, textColor=_WHITE, leading=14
    )
    meta_style = ParagraphStyle(
        "banner_meta",
        fontName="Helvetica",
        fontSize=8.5,
        textColor=_WHITE,
        leading=12,
        alignment=TA_RIGHT,
    )
    left = [
        Paragraph("Expense Tracker", title_style),
        Paragraph(f"Monthly Consolidated Report — {period_label}", subtitle_style),
    ]
    right = Paragraph(f"Generated at<br/>{generated_at}", meta_style)

    banner = Table([[left, right]], colWidths=[content_width * 0.68, content_width * 0.32])
    banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _EMERALD_600),
                ("ROUNDEDCORNERS", [10, 10, 10, 10]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (0, 0), 18),
                ("RIGHTPADDING", (1, 0), (1, 0), 18),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    return banner


def render_monthly_pivot_pdf(
    items: list[MonthlySummaryItem],
    *,
    categories: list[str],
    date_from: dt.date | None,
    date_to: dt.date | None,
) -> bytes:
    """Renders the same category x month pivot as `ReportsView`'s "By
    category & month" mode (spec 07 §4): rows = selected categories with
    data, sorted by total descending; columns = months present in the
    filtered data, chronological (no zero-filled gaps); a trailing Total
    column and a Total footer row; an empty cell renders "-" (`Expense.value`
    is validated `> 0`, so every real cell is unambiguous). Visually mirrors
    the app's own Tailwind styling (emerald accents, slate cards, per-
    category badge colors) rather than a generic table dump -- see
    `.github/specs/09_pdf_monthly_report.spec.md`.

    Raises `EmptyPivotError` if no item matches `categories`.
    """
    selected = set(categories)

    cells: dict[tuple[str, int, int], float] = {}
    category_totals: dict[str, float] = {}
    month_totals: dict[tuple[int, int], float] = {}
    for item in items:
        if item.category not in selected:
            continue
        key = (item.category, item.year, item.month)
        cells[key] = cells.get(key, 0.0) + item.total
        category_totals[item.category] = category_totals.get(item.category, 0.0) + item.total
        month_key = (item.year, item.month)
        month_totals[month_key] = month_totals.get(month_key, 0.0) + item.total

    if not category_totals:
        raise EmptyPivotError("no expenses match the selected categories and date range")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
        title=f"Monthly Consolidated Report — {_period_label(date_from, date_to)}",
    )

    pivot_categories = sorted(category_totals, key=lambda c: category_totals[c], reverse=True)
    month_keys = sorted(month_totals)
    grand_total = sum(month_totals.values())

    header_row = ["Category", *[_month_label(year, month) for year, month in month_keys], "Total"]
    table_rows = [header_row]
    for category in pivot_categories:
        row = [category]
        for year, month in month_keys:
            value = cells.get((category, year, month))
            row.append(_format_currency(value) if value is not None else "—")
        row.append(_format_currency(category_totals[category]))
        table_rows.append(row)
    footer_row = [
        "Total",
        *[_format_currency(month_totals[key]) for key in month_keys],
        _format_currency(grand_total),
    ]
    table_rows.append(footer_row)
    last_row = len(table_rows) - 1

    # Stretch to the full content width (matching the banner/stat cards
    # above it) rather than the auto-sized, content-hugging default -- a
    # narrower-than-the-page table read as visually disconnected from the
    # rest of the page during design review.
    category_col_width = doc.width * 0.2
    other_col_count = len(month_keys) + 1  # + the trailing Total column
    other_col_width = (doc.width - category_col_width) / other_col_count
    pivot_table = Table(
        table_rows,
        repeatRows=1,
        colWidths=[category_col_width, *([other_col_width] * other_col_count)],
    )
    pivot_style = [
        ("BACKGROUND", (0, 0), (-1, 0), _EMERALD_600),
        ("TEXTCOLOR", (0, 0), (-1, 0), _WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, -1), _SLATE_900),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 1, _SLATE_200),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        # A thin rule under every data row (mirrors the on-screen table's
        # `divide-y divide-slate-200`), including one right before the
        # footer -- no separate footer-side rule needed.
        ("LINEBELOW", (0, 1), (-1, last_row - 1), 0.6, _SLATE_200),
        ("BACKGROUND", (0, last_row), (-1, last_row), _SLATE_100),
        ("FONTNAME", (0, last_row), (-1, last_row), "Helvetica-Bold"),
    ]
    # Tint each category's own cell like its on-screen CategoryBadge pill.
    for row_index, category in enumerate(pivot_categories, start=1):
        badge_bg, badge_text = _category_badge_colors(category)
        pivot_style.append(("BACKGROUND", (0, row_index), (0, row_index), badge_bg))
        pivot_style.append(("TEXTCOLOR", (0, row_index), (0, row_index), badge_text))
        pivot_style.append(("FONTNAME", (0, row_index), (0, row_index), "Helvetica-Bold"))
    pivot_table.setStyle(TableStyle(pivot_style))

    generated_at = dt.datetime.now(dt.UTC).strftime("%d/%m/%Y %H:%M UTC")
    period_label = _period_label(date_from, date_to)

    card_width = (doc.width - 2 * _CARD_GAP) / 3
    stats_row = Table(
        [
            [
                _stat_card("Period", period_label, card_width),
                "",
                _stat_card("Categories", str(len(pivot_categories)), card_width),
                "",
                _stat_card("Grand total", _format_currency(grand_total), card_width),
            ]
        ],
        colWidths=[card_width, _CARD_GAP, card_width, _CARD_GAP, card_width],
    )
    stats_row.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    elements = [
        _banner(content_width=doc.width, period_label=period_label, generated_at=generated_at),
        Spacer(1, 0.45 * cm),
        stats_row,
        Spacer(1, 0.45 * cm),
        pivot_table,
    ]
    doc.build(elements)
    return buffer.getvalue()
