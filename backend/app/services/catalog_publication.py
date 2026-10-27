"""Conservative publication checks for an ad-supported culture catalog.

TMDB's person adult flag alone is not a reliable publication boundary.
Missing or unsuitable profiles are omitted without labeling the person.
This is a publication filter, not an identity or reputation assessment.
"""
import re

_ADULT_PROFILE = re.compile(
    r"pornograph|adult[- ](?:film|video|entertainment)|erotic[- ]film|"
    r"pink[- ]film|\bAV (?:idol|actress|actor)\b|Japanese adult|"
    r"sex[- ](?:worker|performer)", re.IGNORECASE,
)
_EXPLICIT_TITLE = re.compile(
    r"\b(?:porn(?:ography|ographic)?|hentai|xxx|breasts?|busty|orgasm|"
    r"masturbat\w*|blowjob|sex\s*tape|sexual\s*intercourse|penis|vagina)\b", re.IGNORECASE,
)


def public_credit(item: dict) -> bool:
    title = item.get("title") or item.get("name") or ""
    return not item.get("adult") and bool(title) and not _EXPLICIT_TITLE.search(title)


def public_person(data: dict) -> bool:
    if data.get("adult") or not data.get("name"):
        return False
    # The introduction establishes the profile's subject. Later biography
    # paragraphs may describe a mainstream actor portraying a character.
    introduction = (data.get("biography") or "").split("\n")[0]
    if _ADULT_PROFILE.search(introduction):
        return False
    credits = data.get("combined_credits") or {}
    works = [*credits.get("cast", []), *credits.get("crew", [])]
    # Do not publish empty people pages or profiles without substantive
    # screen-credit evidence. This is not a public popularity threshold.
    return any(public_credit(item) and (item.get("vote_count") or 0) >= 100 for item in works)
