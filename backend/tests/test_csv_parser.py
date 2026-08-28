"""Pure unit tests for app.services.csv_parser -- no database, no event loop."""

import pytest

from app.services.csv_parser import CsvParseError, parse_amount, parse_csv


class TestParseAmount:
    def test_plain_decimal(self) -> None:
        assert parse_amount("38.97") == pytest.approx(38.97)

    def test_brazilian_locale_with_thousands_separator(self) -> None:
        assert parse_amount("1.234,56") == pytest.approx(1234.56)

    def test_brazilian_locale_without_thousands_separator(self) -> None:
        assert parse_amount("23,80") == pytest.approx(23.80)

    def test_negative_with_leading_space(self) -> None:
        assert parse_amount("- 2.403,28") == pytest.approx(-2403.28)

    def test_negative_plain_decimal(self) -> None:
        assert parse_amount("-10.50") == pytest.approx(-10.50)

    def test_invalid_text_raises_value_error(self) -> None:
        with pytest.raises(ValueError):
            parse_amount("not a number")


class TestParseCsv:
    def test_comma_delimited_brazilian_amounts(self) -> None:
        content = (
            b"date,title,amount\r\n"
            b'2026-08-01,Test Merchant,"38,97"\r\n'
            b'2026-08-02,Bill Payment,"- 2.403,28"\r\n'
        )

        result = parse_csv(content, filename="test.csv")

        assert set(result.detected_columns) == {"date", "title", "value"}
        assert result.unmapped_columns == []
        assert len(result.rows) == 2

        purchase = result.rows[0]
        assert purchase.value == pytest.approx(38.97)
        assert purchase.category is None
        assert purchase.missing_required == ["category"]

        payment = result.rows[1]
        assert payment.value == pytest.approx(2403.28)
        assert payment.category == "Payment/Refund"
        assert payment.missing_required == []

    def test_semicolon_delimiter_is_detected(self) -> None:
        content = b"date;title;amount\r\n2026-08-01;Store;10.50\r\n"

        result = parse_csv(content, filename="test.csv")

        assert len(result.rows) == 1
        assert result.rows[0].value == pytest.approx(10.50)
        assert result.rows[0].title == "Store"

    def test_portuguese_header_aliases_are_recognized(self) -> None:
        content = "Data,Descrição,Valor,Categoria\r\n2026-08-01,Padaria,15.00,Bakery\r\n".encode()

        result = parse_csv(content, filename="test.csv")

        assert set(result.detected_columns) == {"date", "title", "value", "category"}
        assert result.rows[0].category == "Bakery"
        assert result.rows[0].missing_required == []

    def test_unmapped_column_is_reported_not_dropped(self) -> None:
        content = b"date,title,amount,bank_reference\r\n2026-08-01,Store,10.00,REF123\r\n"

        result = parse_csv(content, filename="test.csv")

        assert result.unmapped_columns == ["bank_reference"]

    def test_unparseable_amount_is_recorded_as_row_error_not_dropped(self) -> None:
        content = b"date,title,amount\r\n2026-08-01,Store,abc\r\n"

        result = parse_csv(content, filename="test.csv")

        assert len(result.rows) == 1
        assert result.rows[0].value is None
        assert any("value" in err for err in result.rows[0].parse_errors)

    def test_unparseable_date_is_recorded_as_row_error(self) -> None:
        content = b"date,title,amount\r\nnot-a-date,Store,10.00\r\n"

        result = parse_csv(content, filename="test.csv")

        assert result.rows[0].date is None
        assert any("date" in err for err in result.rows[0].parse_errors)

    def test_latin1_encoded_file_decodes(self) -> None:
        content = "date,title,amount\r\n2026-08-01,Café,10.00\r\n".encode("latin-1")

        result = parse_csv(content, filename="test.csv")

        assert result.rows[0].title == "Café"

    def test_empty_file_raises_csv_parse_error(self) -> None:
        with pytest.raises(CsvParseError):
            parse_csv(b"", filename="empty.csv")

    def test_payment_method_column_is_recognized_but_not_required(self) -> None:
        # A file WITH the column: parsed and never flagged missing, since
        # payment_method isn't in REQUIRED_FIELDS -- the DB-dependent default
        # fill (when the column is absent) happens in the upload-csv route,
        # not here (see module docstring / spec 08 §2.3).
        with_column = parse_csv(
            b"date,title,amount,payment_method\r\n2026-08-01,Store,10.00,Pix\r\n",
            filename="test.csv",
        )
        assert with_column.rows[0].payment_method == "Pix"
        assert "payment_method" not in with_column.rows[0].missing_required

        without_column = parse_csv(
            b"date,title,amount\r\n2026-08-01,Store,10.00\r\n", filename="test.csv"
        )
        assert without_column.rows[0].payment_method is None
        assert "payment_method" not in without_column.rows[0].missing_required
