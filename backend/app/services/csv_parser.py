"""Parses raw bank-export CSVs into ParsedExpenseRow objects.

Real bank exports rarely match the app's canonical schema exactly: column
names vary (English/Portuguese, "amount" vs "value"), delimiters vary
(comma vs semicolon), and numbers may use Brazilian locale formatting
("1.234,56") instead of a plain decimal point. This module is deliberately
permissive about all of that, and never silently drops a row -- unparseable
rows are still returned, with their problem recorded in `parse_errors`.
"""

import csv
import io
from datetime import date

from app.schemas.expense import CSVParseResponse, ParsedExpenseRow

PAYMENT_REFUND_CATEGORY = "Payment/Refund"
REQUIRED_FIELDS = ("date", "title", "value", "category")

# canonical field name -> header names (lowercased) that should map to it
COLUMN_ALIASES: dict[str, list[str]] = {
    "date": ["date", "data"],
    "title": ["title", "titulo", "título", "description", "descrição", "descricao"],
    "value": ["value", "valor", "amount"],
    "category": ["category", "categoria"],
    "details": ["details", "detalhes", "notes", "observações", "observacoes"],
    "trip": ["trip", "viagem"],
}


class CsvParseError(Exception):
    """Raised when the uploaded file isn't readable as CSV at all."""


def parse_amount(raw: str) -> float:
    """Parses a monetary string in either plain ('1234.56') or Brazilian
    locale ('1.234,56', '- 2.403,28') format. Sign is preserved."""
    text = raw.strip()
    negative = text.startswith("-")
    text = text.lstrip("+- ").strip()

    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")

    value = float(text)
    return -value if negative else value


def _decode(raw_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode("latin-1", errors="replace")


def _detect_dialect(sample: str) -> type[csv.Dialect]:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        return csv.excel


def _map_columns(fieldnames: list[str]) -> dict[str, str]:
    """Returns {canonical_field: original_header_name} for headers recognized
    via COLUMN_ALIASES. A header that doesn't match any alias is left unmapped."""
    mapping: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for header in fieldnames:
            if header.strip().lower() in aliases:
                mapping[canonical] = header
                break
    return mapping


def _parse_row(
    index: int, raw_row: dict[str, str | None], column_map: dict[str, str]
) -> ParsedExpenseRow:
    errors: list[str] = []
    parsed: dict[str, object] = {}

    if "date" in column_map:
        raw_date = (raw_row.get(column_map["date"]) or "").strip()
        try:
            parsed["date"] = date.fromisoformat(raw_date)
        except ValueError:
            errors.append(f"date: could not parse '{raw_date}' as YYYY-MM-DD")

    if "title" in column_map:
        raw_title = (raw_row.get(column_map["title"]) or "").strip()
        parsed["title"] = raw_title or None

    if "value" in column_map:
        raw_value = (raw_row.get(column_map["value"]) or "").strip()
        try:
            amount = parse_amount(raw_value)
        except ValueError:
            errors.append(f"value: could not parse '{raw_value}' as a number")
        else:
            if amount < 0:
                # A negative amount in a bank export is a payment/refund, not
                # a purchase -- auto-classify it rather than leaving Category
                # for the user to figure out (see spec §6 decision 1).
                parsed["value"] = abs(amount)
                parsed["category"] = PAYMENT_REFUND_CATEGORY
            else:
                parsed["value"] = amount

    if "category" in column_map and "category" not in parsed:
        raw_category = (raw_row.get(column_map["category"]) or "").strip()
        parsed["category"] = raw_category or None

    if "details" in column_map:
        raw_details = (raw_row.get(column_map["details"]) or "").strip()
        parsed["details"] = raw_details or None

    if "trip" in column_map:
        raw_trip = (raw_row.get(column_map["trip"]) or "").strip()
        parsed["trip"] = raw_trip or None

    missing_required = [field for field in REQUIRED_FIELDS if parsed.get(field) is None]

    raw = {k: (v if v is not None else "") for k, v in raw_row.items() if k is not None}

    return ParsedExpenseRow(
        row_index=index,
        missing_required=missing_required,
        parse_errors=errors,
        raw=raw,
        **parsed,
    )


def parse_csv(content: bytes, *, filename: str) -> CSVParseResponse:
    text = _decode(content)
    if not text.strip():
        raise CsvParseError("file is empty")

    dialect = _detect_dialect(text[:2048])
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)

    fieldnames = reader.fieldnames or []
    if not fieldnames:
        raise CsvParseError("could not detect a header row")

    column_map = _map_columns(fieldnames)
    detected_columns = list(column_map.keys())
    unmapped_columns = [h for h in fieldnames if h not in column_map.values()]

    rows = [_parse_row(index, raw_row, column_map) for index, raw_row in enumerate(reader)]

    return CSVParseResponse(
        filename=filename,
        detected_columns=detected_columns,
        unmapped_columns=unmapped_columns,
        rows=rows,
    )
