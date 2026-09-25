#!/usr/bin/env bash
#
# Fails unless every patch in patches/ is actually present in node_modules.
#
# Why this exists: from 2026-09-08 to 2026-09-25 no patch reached any shipped
# build. `npm ci --omit=dev` keeps expo-dev-launcher out of release artifacts
# (android-build.yml explains why), but `patch-package` was a devDependency, so
# --omit=dev did not install it either. postinstall was
#
#   if [ -e node_modules/.bin/patch-package ]; then patch-package --error-on-fail; fi
#
# which was added so postinstall would "survive an install without the dev
# dependencies" — and it did, by doing nothing, silently, with a zero exit. Two
# patches were written afterwards and neither was ever in a release: the
# expo-router one that lets the app mount when a car launches it with no phone
# window, and the draggable-flatlist one that makes nested lists measure on the
# new architecture. Both worked perfectly in development, which is why it held
# for seventeen days.
#
# patch-package is a production dependency now and postinstall is unguarded, so
# a missing patch-package is a loud failure. This is the check that the *result*
# is right rather than that the mechanism looks right — run after install and
# before the build, because "the patches are applied" is the invariant that
# matters and nothing else asserts it.
#
# Method: a patch that is already applied reverse-applies cleanly. Reads
# node_modules, changes nothing.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d patches ]; then
  echo "No patches/ directory — nothing to verify."
  exit 0
fi

shopt -s nullglob
patches=(patches/*.patch)
if [ ${#patches[@]} -eq 0 ]; then
  echo "patches/ holds no .patch files — nothing to verify."
  exit 0
fi

missing=()
for p in "${patches[@]}"; do
  if git apply --reverse --check "$p" 2>/dev/null; then
    echo "  applied: $p"
  else
    # Either not applied, or applied and then the target changed under it. Both
    # mean the tree is not what the patch describes, which is the thing to fail
    # on — an upstream bump that moves the file needs the patch refreshed.
    echo "  MISSING: $p"
    missing+=("$p")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo
  echo "error: ${#missing[@]} of ${#patches[@]} patches are not applied to node_modules."
  for p in "${missing[@]}"; do echo "  - $p"; done
  echo
  echo "A build from this tree would ship without them. Usually one of:"
  echo "  * the install ran with --ignore-scripts, so postinstall never ran;"
  echo "  * patch-package is not installed — it must stay in \"dependencies\","
  echo "    because release builds install with --omit=dev;"
  echo "  * the patched package was upgraded and the patch needs regenerating."
  echo
  echo "Run 'npm run postinstall' and, if a patch now fails to apply, regenerate"
  echo "it with 'npx patch-package <package-name>'."
  exit 1
fi

echo
echo "All ${#patches[@]} patches are applied."
