@echo off
set NODE_OPTIONS=--experimental-vm-modules --no-warnings
npx mocha --timeout 5000 --require test/test-config.js