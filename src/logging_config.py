import logging.config
import os
import sys

JSON_FORMAT = (
    "{"
    '"timestamp": "%(asctime)s",'
    '"level": "%(levelname)s",'
    '"logger": "%(name)s",'
    '"message": "%(message)s",'
    '"module": "%(module)s",'
    '"function": "%(funcName)s"'
    "}"
)

CONSOLE_FORMAT = "%(asctime)s  %(levelname)-7s  %(name)s  %(message)s"


def setup(level: str | None = None) -> None:
    """Configure structured logging. Call once at app startup."""
    log_level = (
        level
        or os.getenv("LOG_LEVEL", "info").upper()
    )

    use_json = os.getenv("LOG_FORMAT", "console").lower() == "json"
    fmt = JSON_FORMAT if use_json else CONSOLE_FORMAT

    config: dict = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": fmt,
                "datefmt": "%Y-%m-%dT%H:%M:%S%z",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "default",
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
    }

    logging.config.dictConfig(config)
