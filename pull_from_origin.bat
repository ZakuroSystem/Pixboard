@echo off
REM ─────────────────────────────────────────────
REM pull_from_origin.bat
REM GitHub から最新の変更をローカルに取得
REM ─────────────────────────────────────────────

REM 1. .git フォルダが存在するかチェック
if not exist ".git" (
    echo [Error] このディレクトリには Git リポジトリが存在しません。
    pause
    exit /b 1
)

REM 2. 現在のブランチを確認
for /f "delims=" %%b in ('git branch --show-current') do set CURRENT_BRANCH=%%b

REM 3. origin の main ブランチから pull
echo [Info] 現在のブランチ: %CURRENT_BRANCH%
echo [Info] GitHub から最新変更を取得中...
git pull origin %CURRENT_BRANCH%

echo.
echo [Success] 最新の変更を取得しました。
pause >nul
