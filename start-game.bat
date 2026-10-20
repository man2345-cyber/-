@echo off
cd /d "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo This game needs Node.js and pnpm.
  echo Install Node.js, then run: corepack enable
  pause
  exit /b 1
)
if not exist "node_modules\three\package.json" (
  echo Installing Three.js, Vite, and TypeScript...
  call pnpm install
  if errorlevel 1 pause & exit /b 1
)
call pnpm dev --open
pause
