"""Tests for src/domain/payment.py — VietQR generation, CRC-16, ASCII conversion.

Test vectors verified against github.com/subiz/vietqr Go implementation.
"""

from src.domain.core.payment import asciify, crc16, generate_qr_png, generate_vietqr


class TestCrc16:
    def test_single_byte_00(self):
        assert crc16("00") == "2EC9"

    def test_single_byte_01(self):
        assert crc16("01") == "3EE8"

    def test_full_vietqr_without_crc(self):
        code = (
            "00020101021138540010A0000007270124000697042301100099999999"
            "0208QRIBFTTA53037045802VN6304"
        )
        assert crc16(code) == "CBB4"

    def test_full_vietqr_with_amount(self):
        code = (
            "00020101021238570010A0000007270127000697040301130011012345678"
            "0208QRIBFTTA530370454061800005802VN62340107NPS68690819"
            "thanh toan don hang6304"
        )
        assert crc16(code) == "2E2E"

    def test_full_vietqr_with_amount_variant(self):
        code = (
            "00020101021238600010A0000007270130000697040301169704031101234567"
            "0208QRIBFTTC530370454061800005802VN62340107NPS68690819"
            "thanh toan don hang6304"
        )
        assert crc16(code) == "A203"


class TestAsciify:
    def test_pure_ascii_unchanged(self):
        assert asciify("hello world") == "hello world"

    def test_simple_vietnamese(self):
        assert asciify("Bang Minh Tuan") == "Bang Minh Tuan"

    def test_vietnamese_diacritics(self):
        assert asciify("Bằng Minh Tuấn") == "Bang Minh Tuan"

    def test_repeated_diacritics(self):
        assert asciify("ậậậậ") == "aaaa"

    def test_vietnam_full_phrase(self):
        text = "Cộng hòa xã hội chủ nghĩa Việt Nam. Độc lập tự do - hạnh phúc"
        expected = "Cong hoa xa hoi chu nghia Viet Nam. Doc lap tu do - hanh phuc"
        assert asciify(text) == expected

    def test_french_diacritics(self):
        text = "République socialiste du Vietnam. Indépendance et liberté - bonheur"
        expected = "Republique socialiste du Vietnam. Independance et liberte - bonheur"
        assert asciify(text) == expected

    def test_turkish_characters(self):
        text = "Vietnam Sosyalist Cumhuriyeti. Bağımsızlık ve özgürlük - mutluluk"
        expected = "Vietnam Sosyalist Cumhuriyeti. Bamszlk ve zgrlk - mutluluk"
        assert asciify(text) == expected

    def test_non_mappable_dropped(self):
        # Chinese, Korean, eszett — all dropped
        assert asciify("ß") == ""
        assert asciify("한글") == ""
        assert asciify("æ") == ""
        assert asciify("イーブイ") == ""
        assert asciify("越南社会主义共和国。独立与自由——幸福") == ""

    def test_serbian_cyrillic(self):
        text = "Социјалистичке Републике Вијетнам. Независност и слобода - срећа"
        result = asciify(text)
        # Only spaces and hyphens survive; cyrillic is dropped
        assert result == "  .    - "

    def test_empty_string(self):
        assert asciify("") == ""


class TestGenerateVietqr:
    def test_zero_amount_no_note(self):
        """Dynamic QR, zero amount, no note — no amount/note fields."""
        result = generate_vietqr(0, "970423", "0099999999", "")
        assert result.startswith("000201010212")
        assert "QRIBFTTA" in result
        assert "5303704" in result
        assert "5802VN" in result
        assert "6304" in result
        # Verify CRC is correct for this string
        body = result[:-4]
        assert result == body + crc16(body)

    def test_with_amount_and_note(self):
        result = generate_vietqr(40123, "970422", "0023457923442", "test text string")
        expected = (
            "00020101021238570010A0000007270127000697042201130023457923442"
            "0208QRIBFTTA53037045405401235802VN62200816test text string6304D9C6"
        )
        assert result == expected

    def test_vietnamese_note(self):
        result = generate_vietqr(40123, "970422", "0023457923442", "chuyển khoản")
        expected = (
            "00020101021238570010A0000007270127000697042201130023457923442"
            "0208QRIBFTTA53037045405401235802VN62160812chuyen khoan6304722F"
        )
        assert result == expected

    def test_vietnamese_note_ung_ho(self):
        result = generate_vietqr(120000, "970415", "0011001932418", "ủng hộ lũ lụt")
        expected = (
            "00020101021238570010A0000007270127000697041501130011001932418"
            "0208QRIBFTTA530370454061200005802VN62170813ung ho lu lut6304C15C"
        )
        assert result == expected

    def test_long_account_number(self):
        """Account number and note that exceed field limits are truncated to spec max."""
        long_account = "0023457923442ASDFLJX"  # 20 chars, exceeds max 19
        result = generate_vietqr(
            40123,
            "970422",
            long_account,
            "chuyen khoan alsdkf laksjdflk asjdflja slkdalks djflkasjd fajsldk jalskdfj lkasjdflk ajslkfj l",
        )
        body = result[:-4]
        assert result == body + crc16(body)
        assert result.startswith("000201010212")
        assert "QRIBFTTA" in result
        # Account truncated to 19 chars — the full 20-char account should not appear
        assert long_account not in result
        # Note truncated to 25 chars after ASCII-fy — the full note should not appear
        assert "chuyen khoan alsdkf laksjdflk asjdflja" not in result
        # The truncated prefix of the note (25 chars) should appear
        assert "chuyen khoan alsdkf laksj" in result

    def test_all_fields_default_config(self):
        """Generate with default config bank info."""
        result = generate_vietqr(50000, note="test payment")
        assert result.startswith("000201010212")
        assert "QRIBFTTA" in result
        assert "5303704" in result
        assert result.endswith(crc16(result[:-4]))  # last 4 chars are CRC

    def test_always_dynamic_qr(self):
        """All generated codes use '12' (dynamic, one-time)."""
        result = generate_vietqr(1000, "970407", "1234567890", "note")
        assert result[6:12] == "010212"  # field 01 starts at pos 6

    def test_no_note_omits_tag_62(self):
        result = generate_vietqr(50000, "970407", "1234567890", "")
        assert "62" not in result[-20:]  # tag 62 should be absent


class TestGenerateQrPng:
    def test_generates_valid_png(self):
        code = generate_vietqr(120000, "970415", "0011001932418", "test")
        png = generate_qr_png(code)
        assert len(png) > 0
        assert png[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic header

    def test_png_size_increases_with_longer_code(self):
        short = generate_qr_png(generate_vietqr(0, "970423", "0099999999", ""))
        long = generate_qr_png(
            generate_vietqr(
                999999, "970422", "1234567890123456789", "very long note here"
            )
        )
        assert len(long) >= len(short)
