@echo off
REM ������������������������������������������������������������������������������������������
REM pull_from_origin.bat
REM GitHub ����ŐV�̕ύX�����[�J���Ɏ擾
REM ������������������������������������������������������������������������������������������

REM 1. .git �t�H���_�����݂��邩�`�F�b�N
if not exist ".git" (
    echo [Error] ���̃f�B���N�g���ɂ� Git ���|�W�g�������݂��܂���B
    pause
    exit /b 1
)

REM 2. ���݂̃u�����`���m�F
for /f "delims=" %%b in ('git branch --show-current') do set CURRENT_BRANCH=%%b

REM 3. origin �� main �u�����`���� pull
echo [Info] ���݂̃u�����`: %CURRENT_BRANCH%
echo [Info] GitHub ����ŐV�ύX���擾��...
git pull origin %CURRENT_BRANCH%

echo.
echo [Success] �ŐV�̕ύX���擾���܂����B
pause >nul
