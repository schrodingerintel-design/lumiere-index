"""CLI utility to import official IMDb datasets into Lumière.

Usage:
  python scripts/import_imdb.py --ratings data/title.ratings.tsv.gz [--basics data/title.basics.tsv.gz]
"""
import argparse
import logging
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.services.imdb_service import imdb_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("import_imdb")


def main():
    parser = argparse.ArgumentParser(description="Import official IMDb datasets into Lumière")
    parser.add_argument(
        "--ratings",
        required=True,
        help="Path to title.ratings.tsv.gz or title.ratings.tsv",
    )
    parser.add_argument(
        "--basics",
        default=None,
        help="Path to title.basics.tsv.gz or title.basics.tsv (optional)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.ratings):
        log.error("Ratings file not found: %s", args.ratings)
        sys.exit(1)

    if args.basics and not os.path.exists(args.basics):
        log.error("Basics file not found: %s", args.basics)
        sys.exit(1)

    log.info("Starting IMDb import: ratings=%s, basics=%s", args.ratings, args.basics)
    with SessionLocal() as db:
        try:
            stats = imdb_service.import_datasets(
                db=db,
                ratings_source=args.ratings,
                basics_source=args.basics,
            )
            log.info("IMDb import completed successfully: %s", stats)
        except Exception as exc:
            log.error("IMDb import failed: %s", exc)
            sys.exit(1)


if __name__ == "__main__":
    main()
