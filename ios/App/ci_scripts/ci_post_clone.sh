#!/bin/sh
# Xcode Cloud runs this after cloning. It starts without node_modules or the
# built web app, so install them and copy the app into the Xcode project.
set -e
brew install node
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci
npm run build:ios
npx cap sync ios
node scripts/ios-config.mjs
