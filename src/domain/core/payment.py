"""VietQR payment module — generates NAPAS-compliant VietQR strings and QR codes.

Implements the official NAPAS VietQR spec (EMVCo QR with TLV data objects),
based on the reference Go implementation at github.com/subiz/vietqr.

Usage:
    code = generate_vietqr(120000, "970415", "0011001932418", "ung ho lu lut")
    qr_png = generate_qr_png(code)
"""

import os
import io
from src.config import BANK_BIN, BANK_NAME, BANK_ACCOUNT, BANK_ACCOUNT_NAME

# NAPAS spec field limits
_MAX_ACCOUNT_LEN = 19
_MAX_NOTE_LEN = 25


# ── CRC-16/CCITT-FALSE (ISO/IEC 13239) ──────────────────────────────

_POLY: int = 0x1021
_CRC_TABLE: list[int] = []


def _init_crc_table() -> None:
    global _CRC_TABLE
    if _CRC_TABLE:
        return
    _CRC_TABLE = [0] * 256
    for n in range(256):
        crc = n << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ _POLY) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
        _CRC_TABLE[n] = crc


def crc16(data: str) -> str:
    """ISO/IEC 13239 CRC-16 checksum, returns 4-char uppercase hex."""
    _init_crc_table()
    crc: int = 0xFFFF
    for byte in data.encode("ascii"):
        idx = ((crc >> 8) ^ byte) & 0xFF
        crc = ((crc << 8) ^ _CRC_TABLE[idx]) & 0xFFFF
    return f"{crc:04X}"


# ── Vietnamese → ASCII Conversion ────────────────────────────────────

_VN_MAP: dict[str, str] = {
    # lowercase
    "ạ": "a",
    "ả": "a",
    "ã": "a",
    "à": "a",
    "á": "a",
    "â": "a",
    "ậ": "a",
    "ầ": "a",
    "ấ": "a",
    "ẩ": "a",
    "ẫ": "a",
    "ă": "a",
    "ắ": "a",
    "ằ": "a",
    "ặ": "a",
    "ẳ": "a",
    "ẵ": "a",
    "ó": "o",
    "ò": "o",
    "ọ": "o",
    "õ": "o",
    "ỏ": "o",
    "ô": "o",
    "ộ": "o",
    "ổ": "o",
    "ỗ": "o",
    "ồ": "o",
    "ố": "o",
    "ơ": "o",
    "ờ": "o",
    "ớ": "o",
    "ợ": "o",
    "ở": "o",
    "ỡ": "o",
    "é": "e",
    "è": "e",
    "ẻ": "e",
    "ẹ": "e",
    "ẽ": "e",
    "ê": "e",
    "ế": "e",
    "ề": "e",
    "ệ": "e",
    "ể": "e",
    "ễ": "e",
    "ú": "u",
    "ù": "u",
    "ụ": "u",
    "ủ": "u",
    "ũ": "u",
    "ư": "u",
    "ự": "u",
    "ữ": "u",
    "ử": "u",
    "ừ": "u",
    "ứ": "u",
    "í": "i",
    "ì": "i",
    "ị": "i",
    "ỉ": "i",
    "ĩ": "i",
    "ý": "y",
    "ỳ": "y",
    "ỷ": "y",
    "ỵ": "y",
    "ỹ": "y",
    "đ": "d",
    # uppercase
    "Ạ": "A",
    "Ả": "A",
    "Ã": "A",
    "À": "A",
    "Á": "A",
    "Â": "A",
    "Ậ": "A",
    "Ầ": "A",
    "Ấ": "A",
    "Ẩ": "A",
    "Ẫ": "A",
    "Ă": "A",
    "Ắ": "A",
    "Ằ": "A",
    "Ặ": "A",
    "Ẳ": "A",
    "Ẵ": "A",
    "Ó": "O",
    "Ò": "O",
    "Ọ": "O",
    "Õ": "O",
    "Ỏ": "O",
    "Ô": "O",
    "Ộ": "O",
    "Ổ": "O",
    "Ỗ": "O",
    "Ồ": "O",
    "Ố": "O",
    "Ơ": "O",
    "Ờ": "O",
    "Ớ": "O",
    "Ợ": "O",
    "Ở": "O",
    "Ỡ": "O",
    "É": "E",
    "È": "E",
    "Ẻ": "E",
    "Ẹ": "E",
    "Ẽ": "E",
    "Ê": "E",
    "Ế": "E",
    "Ề": "E",
    "Ệ": "E",
    "Ể": "E",
    "Ễ": "E",
    "Ú": "U",
    "Ù": "U",
    "Ụ": "U",
    "Ủ": "U",
    "Ũ": "U",
    "Ư": "U",
    "Ự": "U",
    "Ữ": "U",
    "Ử": "U",
    "Ừ": "U",
    "Ứ": "U",
    "Í": "I",
    "Ì": "I",
    "Ị": "I",
    "Ỉ": "I",
    "Ĩ": "I",
    "Ý": "Y",
    "Ỳ": "Y",
    "Ỷ": "Y",
    "Ỵ": "Y",
    "Ỹ": "Y",
    "Đ": "D",
}


def asciify(text: str) -> str:
    """Convert Vietnamese text to ASCII by stripping diacritics.

    Characters with Vietnamese diacritics are mapped to their ASCII base.
    Non-mappable characters (Chinese, Korean, etc.) are dropped entirely.
    """
    result: list[str] = []
    for ch in text:
        code = ord(ch)
        if code <= 127:
            result.append(ch)
        elif ch in _VN_MAP:
            result.append(_VN_MAP[ch])
        # else: drop character
    return "".join(result)


# ── VietQR String Generation ─────────────────────────────────────────


def _field(id_str: str, value: str) -> str:
    """Format an EMVCo TLV data object: ID (2 chars) + length (2 decimal) + value."""
    return f"{id_str}{len(value):02d}{value}"


def generate_vietqr(
    amount: int,
    bank_bin: str = BANK_BIN,
    account: str = BANK_ACCOUNT,
    note: str = "",
) -> str:
    """Generate a NAPAS VietQR transfer string (EMVCo QR format).

    Args:
        amount: Transfer amount in VND (integer, no decimals).
        bank_bin: 6-digit NAPAS bank BIN (default: config BANK_BIN).
        account: Beneficiary account number (default: config BANK_ACCOUNT).
        note: Transfer description (Vietnamese text OK, 25-char max after ASCII-fy).

    Returns:
        VietQR string like:
        0002010102123857...0208QRIBFTTA53037045406[amount]5802VN...6304[CRC]
    """
    note_ascii = asciify(note.strip())
    account = account[:_MAX_ACCOUNT_LEN]

    # Merchant Account Information (tag 38) — compound object
    guid = _field("00", "A000000727")
    bin_field = _field("00", bank_bin)
    account_field = _field("01", account)
    beneficiary_org = _field("01", bin_field + account_field)
    service = _field("02", "QRIBFTTA")
    merchant_info = _field("38", guid + beneficiary_org + service)

    parts: list[str] = [
        _field("00", "01"),  # Payload Format Indicator v1
        _field("01", "12"),  # Dynamic QR (one-time use)
        merchant_info,
        _field("53", "704"),  # Currency: VND
    ]

    if amount > 0:
        parts.append(_field("54", str(amount)))

    parts.append(_field("58", "VN"))  # Country

    if note_ascii:
        note_ascii = note_ascii[:_MAX_NOTE_LEN]
        note_field = _field("08", note_ascii)
        parts.append(_field("62", note_field))

    body = "".join(parts)
    crc_input = body + "6304"
    return crc_input + crc16(crc_input)


# ── QR PNG Generation ────────────────────────────────────────────────


def generate_qr_png(code: str) -> bytes:
    """Generate a QR code PNG image from a VietQR string.

    Returns PNG image bytes, suitable for saving to disk or serving via HTTP.
    Requires: pip install qrcode[pil]
    """
    import qrcode

    qr = qrcode.QRCode(
        version=None,  # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(code)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def save_qr_png(code: str, directory: str, filename: str) -> str:
    """Save a QR code PNG to disk. Returns the file path."""
    os.makedirs(directory, exist_ok=True)
    safe_name = os.path.basename(filename)
    real_dir = os.path.realpath(directory)
    filepath = os.path.realpath(os.path.join(real_dir, safe_name))
    if not filepath.startswith(real_dir + os.sep):
        raise ValueError(f"Path traversal detected: {filename!r}")
    png_bytes = generate_qr_png(code)
    with open(filepath, "wb") as f:
        f.write(png_bytes)
    return filepath


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate a VietQR transfer code and QR image"
    )
    parser.add_argument("amount", type=int, help="Transfer amount in VND")
    parser.add_argument(
        "--note", "-n", type=str, default="", help="Transfer description"
    )
    parser.add_argument(
        "--output", "-o", type=str, default="vietqr.png", help="QR image output path"
    )
    parser.add_argument(
        "--bin", type=str, default=BANK_BIN, help=f"Bank BIN (default: {BANK_BIN})"
    )
    parser.add_argument(
        "--account", type=str, default=BANK_ACCOUNT, help="Account number"
    )

    args = parser.parse_args()

    code = generate_vietqr(
        amount=args.amount,
        bank_bin=args.bin,
        account=args.account,
        note=args.note,
    )

    print(f"VietQR code ({len(code)} chars):")
    print(code)
    print()

    path = save_qr_png(code, ".", args.output)
    print(f"QR saved → {path}")

    print()
    print("Bank info:")
    print(f"  Bank: {BANK_NAME} (BIN: {BANK_BIN})")
    print(f"  Account: {BANK_ACCOUNT}")
    print(f"  Name: {BANK_ACCOUNT_NAME}")
