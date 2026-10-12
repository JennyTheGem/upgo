@echo off
cd /d "%~dp0"
if not exist web\dist\index.html call npm run build
node cli.ts ui
