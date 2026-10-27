#!/bin/sh
# Cloudflare Pages build step (Build command: sh build.sh · Output directory: site)
# Stamps every "file.js?v=…" / "file.css?v=…" in the pages with this commit, so browsers
# always fetch the newest scripts and styles right after an update — no refresh needed.
set -e
V=$(printf '%s' "${CF_PAGES_COMMIT_SHA:-$(date +%s)}" | cut -c1-8)
sed -i -E "s/([A-Za-z0-9_.-]+\.(css|js))\?v=[0-9A-Za-z]+/\1?v=$V/g" site/*.html
echo "Stamped site/*.html with v=$V"
