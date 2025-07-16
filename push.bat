@echo off
REM ��������������������������������������������������������������������������������������������������������������������
REM commit_and_push.bat
REM ��������������������������������������������������������������������������������������������������������������������

REM 1. Ensure we�fre in the repo root (adjust path if needed)
if not exist ".git" (
    if exist "Pixboard\.git" (
        cd Pixboard
    ) else (
        echo [Error] .git �t�H���_��������܂���B
        pause
        exit /b 1
    )
)

REM 2. (Optional) Disable CRLF conversion if you prefer to keep LF
git config core.autocrlf false

REM 3. Remove stray submodule metadata to avoid the �gno commit checked out�h error
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
set /p COMMIT_MSG=�R�~�b�g���b�Z�[�W����͂��Ă������� (Enter��"Update"): 
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update

echo �R�~�b�g���b�Z�[�W: [%COMMIT_MSG%]
echo.

REM 6. Commit
git commit -m "%COMMIT_MSG%"

REM 7. Ensure origin and branch
git remote | find "origin" >nul 2>&1
if errorlevel 1 (
    echo [Info] origin �����ݒ�̂��ߒǉ����܂�...
    git remote add origin https://github.com/ZakuroSystem/Pixboard.git
)
git rev-parse --verify main >nul 2>&1
if errorlevel 1 (
    echo [Info] main �u�����`������܂���B�쐬���ؑւ��܂�...
    git branch -M main
)

REM 8. Push
git push origin main

echo.
echo [Success] �R�~�b�g���v�b�V�����������܂����B
pause >nul
