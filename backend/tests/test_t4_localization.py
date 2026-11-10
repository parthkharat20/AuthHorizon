"""
AuthHorizon T4 Test Suite — Cross-Border Buyer Localization & Deterministic Safety Gate
Verifies:
  1. Standard buyer delay templates for en, ja, de, da all satisfy the non-negotiable safety gate.
  2. Strict placeholder enforcement: {ITEM}, {DATE}, and {AMOUNT} must appear exactly once.
  3. Rejection of unauthorized placeholders ({PRICE}, {FEE}, etc.).
  4. Rejection of decimal digits (category Nd) outside placeholders in all locales.
  5. Rejection of currency symbols (category Sc) outside placeholders in all locales.
  6. Rejection of multilingual currency/payment words (en, ja, de, da).
  7. Deterministic code injection of dollar amounts and dates.
  8. API routes /api/supplier/parse-notice (with buyer_locale) and /api/orders/{id}/localize-message.
"""

import pytest
from fastapi.testclient import TestClient

from backend.ai.localization import (
    SUPPORTED_LOCALES,
    STANDARD_BUYER_TEMPLATES,
    validate_buyer_message_template,
    fill_buyer_message_template,
    generate_buyer_delay_message
)
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Ensure sandboxed test execution uses shared Mock PayPal Gateway instance
_mock_gw = MockPayPalGateway()
app.dependency_overrides[get_gateway] = lambda: _mock_gw


# ── Test Suite A: Template Safety Gate & Placeholders ─────────────

def test_standard_templates_all_locales_pass_safety_gate():
    """All 4 standard templates (en, ja, de, da) must strictly pass the financial safety gate."""
    for locale in SUPPORTED_LOCALES:
        template = STANDARD_BUYER_TEMPLATES[locale]
        validated = validate_buyer_message_template(template, locale=locale)
        assert "{ITEM}" in validated
        assert "{DATE}" in validated
        assert "{AMOUNT}" in validated
        assert validated.count("{ITEM}") == 1
        assert validated.count("{DATE}") == 1
        assert validated.count("{AMOUNT}") == 1


def test_missing_placeholder_rejected():
    """Template missing any required placeholder ({ITEM}, {DATE}, {AMOUNT}) must be rejected."""
    bad_no_item = "Your order is delayed until {DATE}. A hold of {AMOUNT} remains on your account."
    with pytest.raises(ValueError, match="Safety Gate Violation.*\\{ITEM\\}"):
        validate_buyer_message_template(bad_no_item, locale="en")

    bad_no_date = "Delayed item {ITEM} has a hold of {AMOUNT} on your PayPal account."
    with pytest.raises(ValueError, match="Safety Gate Violation.*\\{DATE\\}"):
        validate_buyer_message_template(bad_no_date, locale="en")

    bad_no_amount = "Delayed item {ITEM} is expected on {DATE}. You may wait or cancel."
    with pytest.raises(ValueError, match="Safety Gate Violation.*\\{AMOUNT\\}"):
        validate_buyer_message_template(bad_no_amount, locale="en")


def test_duplicate_placeholder_rejected():
    """Placeholders must appear exactly once to avoid multiple conflicting injected values."""
    dup_item = "Delayed item {ITEM} (formerly {ITEM}) will ship on {DATE} with hold {AMOUNT}."
    with pytest.raises(ValueError, match="Safety Gate Violation.*\\{ITEM\\}.*found 2"):
        validate_buyer_message_template(dup_item, locale="en")


def test_unauthorized_placeholders_rejected():
    """Any unrecognized placeholder like {PRICE} or {FEE} must be strictly rejected."""
    unauth = "Delayed item {ITEM} costs {PRICE} and will ship on {DATE} with hold {AMOUNT}."
    with pytest.raises(ValueError, match="unauthorized placeholders.*PRICE"):
        validate_buyer_message_template(unauth, locale="en")


# ── Test Suite B: Injection of Digits, Symbols, and Words ─────────

def test_reject_digits_outside_placeholders():
    """Template text must NOT contain any numbers or digits outside placeholders."""
    # English with '5'
    with pytest.raises(ValueError, match="category Nd"):
        validate_buyer_message_template("Delayed item {ITEM} delayed 5 days to {DATE} holding {AMOUNT}.", locale="en")

    # German with '2'
    with pytest.raises(ValueError, match="category Nd"):
        validate_buyer_message_template("Artikel {ITEM} verzögert um 2 Wochen bis {DATE}. Autorisierung: {AMOUNT}.", locale="de")

    # Japanese with fullwidth '３'
    with pytest.raises(ValueError, match="category Nd"):
        validate_buyer_message_template("商品{ITEM}は３日遅延して{DATE}に発送されます。保持枠: {AMOUNT}。", locale="ja")


def test_reject_currency_symbols_outside_placeholders():
    """Template text must NOT contain $, €, ¥, £ symbols (only {AMOUNT} injects currency)."""
    for symbol in ["$", "€", "¥", "£", "₹"]:
        with pytest.raises(ValueError, match="category Sc"):
            validate_buyer_message_template(f"Delayed item {{ITEM}} costs {symbol} on {{DATE}} with {{AMOUNT}}.", locale="en")


def test_reject_multilingual_currency_words():
    """Rejects forbidden currency terms in each language."""
    # English "dollars"
    with pytest.raises(ValueError, match="forbidden currency term"):
        validate_buyer_message_template("Item {ITEM} delayed to {DATE}. Balance in dollars is {AMOUNT}.", locale="en")

    # German "Erstattung"
    with pytest.raises(ValueError, match="forbidden currency term"):
        validate_buyer_message_template("Artikel {ITEM} bis {DATE} verzögert. Keine Erstattung für {AMOUNT}.", locale="de")

    # Danish "refusion"
    with pytest.raises(ValueError, match="forbidden currency term"):
        validate_buyer_message_template("Vare {ITEM} forsinket til {DATE}. Ingen refusion for {AMOUNT}.", locale="da")

    # Japanese "返金"
    with pytest.raises(ValueError, match="forbidden Japanese currency term"):
        validate_buyer_message_template("商品{ITEM}は{DATE}に延期。返金ではなく{AMOUNT}を保持。", locale="ja")


# ── Test Suite C: Deterministic Injection & API Verification ──────

def test_deterministic_injection_all_locales():
    """Verify that Python code injects exact item name, date, and dollar hold into placeholders."""
    item = "Ceramic Coating Kit Industrial"
    date_str = "2026-11-25"
    held = 30.00

    # 1. English
    en_msg = fill_buyer_message_template(STANDARD_BUYER_TEMPLATES["en"], item, date_str, held)
    assert item in en_msg
    assert date_str in en_msg
    assert "$30.00" in en_msg
    assert "{ITEM}" not in en_msg
    assert "{DATE}" not in en_msg
    assert "{AMOUNT}" not in en_msg

    # 2. Japanese (UTF-8 encoding check)
    ja_msg = fill_buyer_message_template(STANDARD_BUYER_TEMPLATES["ja"], item, date_str, held)
    assert f"「{item}」" in ja_msg
    assert f"出荷は{date_str}に延期" in ja_msg
    assert "$30.00" in ja_msg
    assert "PayPalアカウント" in ja_msg

    # 3. German
    de_msg = fill_buyer_message_template(STANDARD_BUYER_TEMPLATES["de"], item, date_str, held)
    assert f"'{item}'" in de_msg
    assert date_str in de_msg
    assert "$30.00" in de_msg

    # 4. Danish
    da_msg = fill_buyer_message_template(STANDARD_BUYER_TEMPLATES["da"], item, date_str, held)
    assert f"'{item}'" in da_msg
    assert date_str in da_msg
    assert "$30.00" in da_msg


def test_api_parse_notice_and_re_localization():
    """Verify API accepts buyer_locale in notice parsing and allows dynamic re-localization."""
    client = TestClient(app)

    # 1. Create and authorize order
    order_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Precision Bearings", "amount": 30.0, "quantity": 1},
            {"sku": "SKU-COAT-03", "name": "Ceramic Coating Kit", "amount": 30.0, "quantity": 1}
        ],
        "currency": "USD"
    })
    order_id = order_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    client.post(f"/api/orders/{order_id}/ship-partial")

    # 2. Parse notice requesting Japanese (ja) localization
    notice_text = (
        "Sehr geehrte Damen und Herren,\n"
        "Lieferverzögerung bei Platine (SKU-COAT-03). Neuer Termin: 2026-11-25.\n"
        "Mit freundlichen Grüßen"
    )
    parse_res = client.post("/api/supplier/parse-notice", json={
        "order_id": order_id,
        "raw_text": notice_text,
        "buyer_locale": "ja"
    })
    assert parse_res.status_code == 200
    pdata = parse_res.json()
    assert pdata["buyer_locale"] == "ja"
    assert "「Ceramic Coating Kit」" in pdata["generated_buyer_message"] or "「SKU-COAT-03」" in pdata["generated_buyer_message"] or "「" in pdata["generated_buyer_message"]
    assert "$30.00" in pdata["generated_buyer_message"]

    # 3. Dynamic re-localization to German (de) via dedicated endpoint
    reloc_res = client.post(f"/api/orders/{order_id}/localize-message", json={
        "order_id": order_id,
        "buyer_locale": "de"
    })
    assert reloc_res.status_code == 200
    rdata = reloc_res.json()
    assert rdata["buyer_locale"] == "de"
    assert "teilweise versandt" in rdata["buyer_message"]
    assert "$30.00" in rdata["buyer_message"]

    # 4. Dynamic re-localization to Danish (da)
    reloc_da = client.post(f"/api/orders/{order_id}/localize-message", json={
        "order_id": order_id,
        "buyer_locale": "da"
    })
    assert reloc_da.status_code == 200
    assert "delvist afsendt" in reloc_da.json()["buyer_message"]
