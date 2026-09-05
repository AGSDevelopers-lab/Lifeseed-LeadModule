#!/usr/bin/env bash
# I-01: quoted Lead.status literals must not appear outside the authorised writers.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='status:\s*['\''"](NEW|ASSIGNED|CONTACTED_QUALIFIED|CONTACTED_NOT_INTERESTED|CONTACTED_CALLBACK_REQUESTED|NOT_REACHABLE|WRONG_NUMBER|DO_NOT_CALL|COUNSELLING_BOOKED|COUNSELLING_ATTENDED|COUNSELLING_NO_SHOW|CONVERTED|LOST|EXPIRED_AUTO_PURGED)['\''"]'

tmp="$(mktemp)"
git grep -n -E "$PATTERN" -- '*.ts' '*.tsx' \
  | grep -v 'src/lib/leads/domain/state-machine/' \
  | grep -v 'src/lib/leads/adapters/prisma-lead-repository.ts' \
  | grep -v 'src/lib/leads/adapters/prisma-transition-store.ts' \
  | grep -v '\.test\.ts' \
  | grep -v 'node_modules' \
  | grep -v 'LifeSeed_App_Specs' \
  > "$tmp" || true

if [[ -s "$tmp" ]]; then
  echo "I-01 guard failed: Lead.status writes outside the state-machine adapter:"
  cat "$tmp"
  rm -f "$tmp"
  exit 1
fi
rm -f "$tmp"
echo "I-01 guard passed"
