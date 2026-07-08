from src.domain.core.pricing import fmt_price


class TestFmtPrice:
    def test_free(self):
        assert fmt_price(0) == "Free"

    def test_less_than_1k(self):
        assert fmt_price(500) == "500 đ"
        assert fmt_price(999) == "999 đ"

    def test_exact_k(self):
        assert fmt_price(1000) == "1k đ"
        assert fmt_price(5000) == "5k đ"
        assert fmt_price(15000) == "15k đ"
        assert fmt_price(100000) == "100k đ"

    def test_fractional_k(self):
        assert fmt_price(1500) == "1.5k đ"
        assert fmt_price(2500) == "2.5k đ"
        assert fmt_price(12500) == "12.5k đ"

    def test_negative_returns_empty(self):
        assert fmt_price(-100) == ""
