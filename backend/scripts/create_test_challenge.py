"""Roadmap_Scaling.md D1 — creates a real open challenge (via the real
`POST /challenges/open` endpoint, not a direct DB insert, so it goes through the same
validation/hashtag-reservation logic a genuine challenge would) whose window closes a
few minutes from now. Run this right before a `challenge-close.js` k6 run so the
"burst near window close" scenario has a real window to burst against — the timing is
relative to *when you run this script*, not to seed time, so re-run it fresh for each
load-test session rather than reusing an old one.

    python scripts/create_test_challenge.py \
        --base-url http://<alb-hostname> \
        --token <one seeded user's token from seed_load_test_data.py's output> \
        --minutes-from-now 10

Prints the challenge id to stdout — pass it to challenge-close.js via the
CHALLENGE_ID env var.
"""

import argparse
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--minutes-from-now", type=int, default=10)
    args = parser.parse_args()

    start = datetime.now(timezone.utc)
    end = start + timedelta(minutes=args.minutes_from_now)
    tag = f"loadtest{uuid.uuid4().hex[:10]}"

    payload = {
        "title": f"Load test challenge {tag}",
        "hashtag": tag,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "sides": [{"name": "Side A"}, {"name": "Side B"}],
    }

    with httpx.Client(base_url=args.base_url, timeout=15) as client:
        r = client.post(
            "/challenges/open",
            json=payload,
            headers={"Authorization": f"Bearer {args.token}"},
        )
        r.raise_for_status()
        challenge = r.json()

    print(challenge["id"], file=sys.stdout)
    print(
        f"created challenge {challenge['id']!r} (#{tag}), closes at {end.isoformat()}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
