import os
from dotenv import load_dotenv

load_dotenv()

# ManyChat Environment
MANYCHAT_API = os.getenv("MANYCHAT_BEAR_AUTH", "")
MANYCHAT_BASIC_AUTH = os.getenv("MANYCHAT_BASIC_AUTH", "")
MANYCHAT_RESTART_FLOW_NS = os.getenv("MANYCHAT_RESTART_FLOW_NS", "")
MANYCHAT_REPLY_FLOW_NS = os.getenv("MANYCHAT_REPLY_FLOW_NS", "")
MANYCHAT_COLLECT_FLOW_NS = os.getenv("MANYCHAT_COLLECT_FLOW_NS", "")
MANYCHAT_PAYMENT_FLOW_NS = os.getenv("MANYCHAT_PAYMENT_FLOW_NS", "")
MANYCHAT_PAUSE_FLOW_NS = os.getenv("MANYCHAT_PAUSE_FLOW_NS", "")
MANYCHAT_WEBHOOK_SECRET = os.getenv("MANYCHAT_WEBHOOK_SECRET", "")


SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "")
# Instagram API
INSTAGRAM_ACCESS_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN", "")
INSTAGRAM_VERIFY_TOKEN = os.getenv("INSTAGRAM_VERIFY_TOKEN", "")
INSTAGRAM_PAGE_ID = os.getenv("INSTAGRAM_PAGE_ID", "")
TEST_IG_SENDER_ID = os.getenv("TEST_IG_SENDER_ID", "")

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic"
)
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

ANTHROPIC_KEY_API = os.getenv("ANTHROPIC_KEY_API", "")

# Browsing THE MENU
CATEGORY_DISPLAY_ORDER = [
    "base",
    "protein",
    "cook_veg",
    "sauce",
    "raw_veg",
    "topping",
    "egg",
    "cooking_oil",
]

REQUIRED_CATEGORIES = ["base", "protein", "cook_veg", "sauce"]

OPTIONAL_CATEGORIES = ["raw_veg", "topping", "egg", "cooking_oil"]

CATEGORY_LABELS = {
    "base": "Base",
    "protein": "Protein",
    "cook_veg": "Cooked Vegetables",
    "raw_veg": "Raw Vegetables",
    "sauce": "Sauce",
    "topping": "Toppings",
    "egg": "Eggs",
    "cooking_oil": "Cooking Oils",
}
CATEGORIES_WITH_FIXED_PRICE = {"topping", "sauce", "cooking_oil"}

# Other utils
SESSION_TTL_MS = 30 * 60 * 1000  # 30 minutes
MAX_REPLY_CHARS = 1500
MAX_INBOUND_MESSAGE_LENGTH = 500  # chars, cap before LLM prompt
FUZZY_SCORE_CUTOFF = 70


# Rate limiting
RATE_LIMIT_MAX = 5  # max requests per window
RATE_LIMIT_WINDOW_SEC = 10  # sliding window in seconds

# Staff alert cooldown
STAFF_ALERT_COOLDOWN_SEC = 180

# Banking information here
BANK_NAME = os.getenv("BANK_NAME", "")
BANK_BIN = os.getenv("BANK_BIN", "")
BANK_ACCOUNT = os.getenv("BANK_ACCOUNT", "")
BANK_ACCOUNT_NAME = os.getenv("BANK_ACCOUNT_NAME", "")
PAYMENT_TIMEOUT_MIN = 30

# Telegram API credentials
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Staff dashboard
STAFF_PASSWORD = os.getenv("STAFF_PASSWORD", "")
STAFF_TOKEN_TTL_SEC = 3600
