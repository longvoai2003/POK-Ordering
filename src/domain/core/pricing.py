def fmt_price(cost: float) -> str:
    """'15000' → '15k đ', '5000' → '5k đ', '999' → '999 đ'"""
    if cost < 0:
        return ""
    if cost == 0:
        return "Free"
    if cost < 1000:
        return f"{int(cost)} đ"
    k = cost / 1000
    if k == int(k):
        return f"{int(k)}k đ"
    return f"{k:.1f}k đ"
