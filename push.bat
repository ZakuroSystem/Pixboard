@echo off
REM ──────────────────────────────────────────────────────────
REM commit_and_push.bat
REM ──────────────────────────────────────────────────────────

REM 1. Ensure we’re in the repo root (adjust path if needed)
if not exist ".git" (
    if exist "Pixboard\.git" (
        cd Pixboard
    ) else (
        echo [Error] .git フォルダが見つかりません。
        pause
        exit /b 1
    )
)

REM 2. (Optional) Disable CRLF conversion if you prefer to keep LF
git config core.autocrlf false

REM 3. Remove stray submodule metadata to avoid the “no commit checked out” error
if exist ".gitmodules" (
    for /F "tokens=*" %%d in ('git config --file .gitmodules --get-regexp path ^submodule\..*\.path$ ^| awk "{print \$2}"') do (
        git rm --cached "%%d"
        rd /S /Q ".git/modules/%%d"
    )
    git add .gitmodules
)

REM 4. Stage everything
git add .

echo.
REM 5. Prompt for commit message
set /p COMMIT_MSG=コミットメッセージを入力してください (Enterで"Update"): 
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update

echo コミットメッセージ: [%COMMIT_MSG%]
echo.

REM 6. Commit
git commit -m "%COMMIT_MSG%"

REM 7. Ensure origin and branch
git remote | find "origin" >nul 2>&1
if errorlevel 1 (
    echo [Info] origin が未設定のため追加します...
    git remote add origin https://github.com/ZakuroSystem/Pixboard.git
)
git rev-parse --verify main >nul 2>&1
if errorlevel 1 (
    echo [Info] main ブランチがありません。作成＆切替します...
    git branch -M main
)

REM 8. Push
git push origin main

echo.
echo [Success] コミット＆プッシュが完了しました。
pause >nul
