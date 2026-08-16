from beanie import Document, Indexed
from typing import Annotated


class SequenceCounter(Document):
    """One document per (kind, year-month) bucket, e.g. key='pr_number:2026-07'.

    `value` holds the highest sequence number issued so far for that bucket.
    Both PR numbers and Stock/Property numbers share this same collection —
    they just use different key prefixes — so there is exactly one place
    where "what's the next number" is ever decided.

    Never derive the next number by counting other collections (e.g.
    PurchaseRequest.find(...).count()). Counting breaks the moment a record
    is deleted, because a later create would reissue a number that may
    already be printed on a physical document. The counter here only ever
    goes up, via atomic increment, and is never decremented or recomputed
    from existing data.
    """

    key: Annotated[str, Indexed(unique=True)]
    value: int = 0

    class Settings:
        name = "sequence_counters"