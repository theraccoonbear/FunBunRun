#!/usr/bin/env bash
# Stale-deploy guard. Usage: is-main-tip.sh <sha>
#
# Compares <sha> (the commit about to be deployed) with the current tip of
# origin/main. Writes "publish=true" or "publish=false" to $GITHUB_OUTPUT
# (stdout when unset). When main has moved on, a newer commit has landed and
# its own CI run and deploy will follow, so this one is skipped with a notice.
# Exits 0 in both cases; exits non-zero only if main's tip cannot be read.
set -euo pipefail

sha="${1:?usage: is-main-tip.sh <sha>}"
out="${GITHUB_OUTPUT:-/dev/stdout}"

tip="$(git ls-remote origin refs/heads/main | cut -f1)"
if [ -z "$tip" ]; then
  echo "::error::Could not read the tip of origin/main"
  exit 1
fi

if [ "$tip" = "$sha" ]; then
  echo "publish=true" >> "$out"
else
  echo "::notice::Skipping publish: ${sha} is not the tip of main (${tip}). The newer commit's CI and deploy will follow."
  echo "publish=false" >> "$out"
fi
