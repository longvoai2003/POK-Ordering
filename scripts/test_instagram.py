import asyncio, os
from dotenv import load_dotenv

load_dotenv()

# We need your IG User SID (the person who will receive the test DM)
# This is your Instagram-scoped user ID, like "17841401234567890"
YOUR_IG_SID = os.getenv("TEST_IG_SENDER_ID", "")


async def main():
    from apps.instagram.adapter import InstagramReplyAdapter
    from src.adapters.session_repo import PostgresSessionRepo

    repo = PostgresSessionRepo()
    try:
        adapter = InstagramReplyAdapter(
            page_id=os.getenv("INSTAGRAM_PAGE_ID"),
            access_token=os.getenv("INSTAGRAM_ACCESS_TOKEN"),
            session_repo=repo,
        )

        # Test 1: plain text
        print("Sending plain text...")
        await adapter.send_message(YOUR_IG_SID, "Hello from the bot!")

        # Test 2: quick replies
        print("Sending quick replies...")
        await adapter.send_quick_replies(
            YOUR_IG_SID,
            "Welcome to PureOrganic. What would you like to do?",
            [
                {"title": "Order Bowl", "payload": "ORDER_BOWL"},
                {"title": "Ask something", "payload": "ASK_QUESTION"},
            ],
        )
        print("Done!")
    finally:
        await repo.close()


asyncio.run(main())
