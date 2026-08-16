"""Reusable, concurrency-safe sequence generation.

Both numbering schemes required by the business rules — PR Numbers and
Stock/Property Numbers — need the exact same underlying behavior: a global
(cross-office) counter that resets every calendar month and can never hand
out the same number twice, even under concurrent requests. This module
implements that behavior exactly once, in `_next_sequence_batch`, and the
two public functions below are thin formatters on top of it.

Concurrency safety: MongoDB's `find_one_and_update` with `$inc` is a single
atomic operation at the storage-engine level. Two requests racing to
create a PR (or PR items) in the same year-month bucket will be serialized
by MongoDB itself — one gets values [6], the other gets [7] — there is no
read-then-write window where both could observe the same "current" value.
This is why counting existing documents is never used: counting is not
atomic with respect to concurrent inserts/deletes, and is further broken
by deletions reducing a count that has already been used to mint a number.
"""

from datetime import datetime
from typing import List, Optional
from pymongo import ReturnDocument
from app.models.sequence_counter import SequenceCounter


async def _next_sequence_batch(key: str, count: int = 1) -> List[int]:
    """Atomically reserves `count` sequence numbers under `key` and returns
    them in order, e.g. reserving 3 when the counter is at 5 returns
    [6, 7, 8].

    Uses upsert=True so the very first number requested in a new
    year-month bucket (or the very first number ever, for a brand new
    kind of sequence) creates the counter document on demand — no
    separate migration or seeding step is required when, say, a new month
    begins or a new sequence kind is introduced later.
    """
    if count < 1:
        return []

    collection = SequenceCounter.get_motor_collection()
    doc = await collection.find_one_and_update(
        {"key": key},
        {"$inc": {"value": count}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    last = doc["value"]
    first = last - count + 1
    return list(range(first, last + 1))


async def generate_pr_number(now: Optional[datetime] = None) -> str:
    """Generates the next Purchase Request number.

    Format: YY-MM-###
      YY  = last two digits of the year
      MM  = two-digit month
      ### = sequence number, zero-padded to 3 digits, reserved atomically

    The sequence is global across every office (there is one counter per
    year-month, not one per office), and resets automatically every month
    because the bucket key is derived from year+month — a new month simply
    means a new key, which starts counting from 1 via upsert.
    """
    now = now or datetime.utcnow()
    key = f"pr_number:{now:%Y-%m}"
    seq = (await _next_sequence_batch(key, 1))[0]
    return f"{now:%y}-{now:%m}-{seq:03d}"


async def generate_stock_property_numbers(
    count: int, now: Optional[datetime] = None
) -> List[str]:
    """Generates `count` Stock/Property numbers in one atomic reservation.

    Format: MM-YY-###
      MM  = two-digit month
      YY  = last two digits of the year
      ### = sequence number, zero-padded to 3 digits

    Unlike the PR number (one per Purchase Request), this sequence is
    per-item: every procurement item across every PR, across every
    office, draws from the same global monthly counter. Reserving the
    whole batch in a single call (rather than calling
    generate_stock_property_no in a loop) means the numbers assigned to
    the items of one PR are guaranteed to be contiguous, and avoids
    interleaving with another request's items mid-PR.
    """
    if count < 1:
        return []
    now = now or datetime.utcnow()
    key = f"stock_property_no:{now:%Y-%m}"
    seqs = await _next_sequence_batch(key, count)
    return [f"{now:%m}-{now:%y}-{seq:03d}" for seq in seqs]


async def generate_stock_property_no(now: Optional[datetime] = None) -> str:
    """Convenience wrapper for generating exactly one Stock/Property number."""
    return (await generate_stock_property_numbers(1, now))[0]