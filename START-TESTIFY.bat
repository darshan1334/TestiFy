@echo off
setlocal enabledelayedexpansion
title TestiFy - Setup and Launch
color 0B

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\venv"
set "VENV_PY=%VENV%\Scripts\python.exe"
set "STAMP=%ROOT%.setup_complete"

REM Call Windows' own tools by full path. Git for Windows puts Unix versions of
REM find / timeout / sort on PATH, and those silently break the checks below.
set "SYS=%SystemRoot%\System32"
set "FINDSTR=%SYS%\findstr.exe"
set "SLEEP2=%SYS%\ping.exe -n 3 127.0.0.1"
set "CURL=%SYS%\curl.exe"
if not exist "%CURL%" set "CURL=curl"

echo.
echo  ===========================================================
echo    TestiFy - AI Autonomous Testing + Security Platform
echo  ===========================================================
echo.
echo   This will install everything needed and then start the app.
echo   First run takes a few minutes. Later runs start in seconds.
echo.

REM ============================================================
REM  Fast path - already set up
REM ============================================================
if not exist "%STAMP%" goto :check_tools
if not exist "%VENV_PY%" goto :check_tools
if not exist "%FRONTEND%\node_modules" goto :check_tools
REM Node still has to be on PATH to launch the dev server
where node >nul 2>&1
if errorlevel 1 goto :check_tools
echo   [OK] Already installed - skipping setup.
echo.
goto :configure_env


REM ============================================================
REM  1. Check required tools
REM ============================================================
:check_tools
echo  -----------------------------------------------------------
echo   STEP 1 of 5 - Checking required software
echo  -----------------------------------------------------------

REM ---------- Python ----------
set "PYCMD="
py -3 -V >nul 2>&1 && set "PYCMD=py -3"
if not defined PYCMD (
    python -V >nul 2>&1 && set "PYCMD=python"
)
if not defined PYCMD goto :need_python

for /f "tokens=2" %%a in ('%PYCMD% -V 2^>^&1') do set "PYVER=%%a"
for /f "tokens=1,2 delims=." %%a in ("!PYVER!") do (
    set "PMAJ=%%a"
    set "PMIN=%%b"
)
if !PMAJ! LSS 3 goto :need_python
if !PMAJ! EQU 3 if !PMIN! LSS 10 goto :need_python
echo   [OK] Python !PYVER!
goto :check_node

:need_python
echo   [--] Python 3.10+ not found. Installing...
where winget >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Could not auto-install ^(winget unavailable^).
    echo   Please install Python from: https://www.python.org/downloads/
    echo   IMPORTANT: tick "Add python.exe to PATH" during install.
    start "" https://www.python.org/downloads/
    goto :fail
)
winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent
echo.
echo   Python was installed. Windows needs a fresh window to see it.
echo   Please CLOSE this window and double-click START-TESTIFY.bat again.
goto :fail

REM ---------- Node.js ----------
:check_node
where node >nul 2>&1
if errorlevel 1 goto :need_node
for /f "tokens=1,2 delims=v." %%a in ('node -v 2^>nul') do (
    set "NMAJ=%%a"
    set "NMIN=%%b"
)
if !NMAJ! GEQ 22 goto :node_ok
if !NMAJ! EQU 20 if !NMIN! GEQ 19 goto :node_ok
goto :need_node

:node_ok
for /f "tokens=*" %%a in ('node -v') do echo   [OK] Node.js %%a
goto :check_git

:need_node
echo   [--] Node.js 20.19+ not found. Installing...
where winget >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Could not auto-install ^(winget unavailable^).
    echo   Please install the LTS build from: https://nodejs.org/
    start "" https://nodejs.org/
    goto :fail
)
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
echo.
echo   Node.js was installed. Windows needs a fresh window to see it.
echo   Please CLOSE this window and double-click START-TESTIFY.bat again.
goto :fail

REM ---------- Git ----------
:check_git
where git >nul 2>&1
if errorlevel 1 goto :need_git
for /f "tokens=3" %%a in ('git --version 2^>nul') do echo   [OK] Git %%a
goto :setup_backend

:need_git
echo   [--] Git not found. Installing...
echo        ^(needed to scan GitHub repositories^)
where winget >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Could not auto-install ^(winget unavailable^).
    echo   Please install Git from: https://git-scm.com/download/win
    start "" https://git-scm.com/download/win
    goto :fail
)
winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements --silent
echo.
echo   Git was installed. Windows needs a fresh window to see it.
echo   Please CLOSE this window and double-click START-TESTIFY.bat again.
goto :fail


REM ============================================================
REM  2. Python environment
REM ============================================================
:setup_backend
echo.
echo  -----------------------------------------------------------
echo   STEP 2 of 5 - Setting up the Python backend
echo  -----------------------------------------------------------

if exist "%VENV_PY%" (
    echo   [OK] Virtual environment already exists
) else (
    echo   Creating isolated Python environment...
    %PYCMD% -m venv "%VENV%"
    if errorlevel 1 (
        echo   [ERROR] Could not create the virtual environment.
        goto :fail
    )
    echo   [OK] Virtual environment created
)

echo   Installing Python packages ^(this can take a few minutes^)...
"%VENV_PY%" -m pip install --upgrade pip --quiet --disable-pip-version-check
"%VENV_PY%" -m pip install -r "%BACKEND%\requirements.txt" --disable-pip-version-check
if errorlevel 1 (
    echo   [ERROR] Installing Python packages failed.
    echo           Check your internet connection and try again.
    goto :fail
)
echo   [OK] Python packages installed

echo   Installing the Chromium browser for testing...
echo   ^(about 130 MB - one time only^)
"%VENV_PY%" -m playwright install chromium
if errorlevel 1 (
    echo   [ERROR] Downloading Chromium failed.
    goto :fail
)
echo   [OK] Chromium ready


REM ============================================================
REM  3. Frontend
REM ============================================================
echo.
echo  -----------------------------------------------------------
echo   STEP 3 of 5 - Setting up the web interface
echo  -----------------------------------------------------------
echo   Installing npm packages ^(this can take a few minutes^)...
pushd "%FRONTEND%"
call npm install --no-fund --no-audit
if errorlevel 1 (
    popd
    echo   [ERROR] npm install failed.
    echo           Check your internet connection and try again.
    goto :fail
)
popd
echo   [OK] Web interface ready

echo setup-ok> "%STAMP%"


REM ============================================================
REM  4. API keys
REM ============================================================
:configure_env
echo.
echo  -----------------------------------------------------------
echo   STEP 4 of 5 - Checking the AI configuration
echo  -----------------------------------------------------------

if not exist "%BACKEND%\.env" (
    if exist "%BACKEND%\.env.example" (
        copy /y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
        echo   Created backend\.env from the template.
    ) else (
        echo GEMINI_API_KEY=your_gemini_api_key_here> "%BACKEND%\.env"
        echo GEMINI_MODEL=gemini-3.6-flash>> "%BACKEND%\.env"
        echo DATABASE_URL=sqlite+aiosqlite:///./testify.db>> "%BACKEND%\.env"
        echo CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173>> "%BACKEND%\.env"
        echo MAX_CRAWL_PAGES=10>> "%BACKEND%\.env"
        echo SCREENSHOT_DIR=screenshots>> "%BACKEND%\.env"
        echo LOG_LEVEL=INFO>> "%BACKEND%\.env"
        echo   Created a fresh backend\.env
    )
)

"%FINDSTR%" /C:"your_gemini_api_key_here" "%BACKEND%\.env" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo   [^!] No Gemini API key is set yet.
    echo       Get a free key at: https://aistudio.google.com/apikey
    echo.
    set /p "USERKEY=  Paste your Gemini API key (or press Enter to skip): "
    if not "!USERKEY!"=="" (
        powershell -NoProfile -Command "(Get-Content -Raw '%BACKEND%\.env') -replace 'your_gemini_api_key_here', '!USERKEY!' | Set-Content -NoNewline '%BACKEND%\.env'"
        echo   [OK] API key saved
    ) else (
        echo   [^!] Skipped. The app will start, but AI analysis will fail
        echo       until you add a key to backend\.env
    )
) else (
    echo   [OK] AI configuration found
)


REM ============================================================
REM  5. Pick free ports and launch
REM ============================================================
echo.
echo  -----------------------------------------------------------
echo   STEP 5 of 5 - Starting TestiFy
echo  -----------------------------------------------------------

call :find_free_port 8000 BPORT
call :find_free_port 5173 FPORT
echo   Backend port : !BPORT!
echo   Frontend port: !FPORT!

start "TestiFy Backend" cmd /k "cd /d "%BACKEND%" && "%VENV_PY%" -m uvicorn main:app --port !BPORT!"
start "TestiFy Frontend" cmd /k "cd /d "%FRONTEND%" && set BACKEND_PORT=!BPORT! && npm run dev -- --port !FPORT! --strictPort"

echo.
echo   Waiting for the servers to come up...

set "BACKEND_UP="
for /l %%i in (1,1,90) do (
    if not defined BACKEND_UP (
        "%CURL%" -s -o nul --max-time 2 "http://127.0.0.1:!BPORT!/api/health" && set "BACKEND_UP=1"
        if not defined BACKEND_UP %SLEEP2% >nul
    )
)
if defined BACKEND_UP (echo   [OK] Backend is running) else (echo   [^!] Backend is taking longer than usual - check its window)

set "FRONTEND_UP="
for /l %%i in (1,1,60) do (
    if not defined FRONTEND_UP (
        "%CURL%" -s -o nul --max-time 2 "http://localhost:!FPORT!/" && set "FRONTEND_UP=1"
        if not defined FRONTEND_UP %SLEEP2% >nul
    )
)
if defined FRONTEND_UP (echo   [OK] Web interface is running) else (echo   [^!] Web interface is taking longer than usual - check its window)

echo.
echo  ===========================================================
echo    TestiFy is ready
echo.
echo      Open:      http://localhost:!FPORT!
echo      Testing:   http://localhost:!FPORT!/
echo      Security:  http://localhost:!FPORT!/security
echo  ===========================================================
echo.
echo   Two other windows are now running the servers.
echo   To stop TestiFy, simply close those two windows.
echo.

start "" "http://localhost:!FPORT!"

echo   Press any key to close this setup window...
pause >nul
exit /b 0


REM ============================================================
REM  Helper - find the next free TCP port
REM    %1 = port to start from, %2 = variable name to set
REM
REM  Uses .NET to actually attempt a bind on the loopback address,
REM  which is what uvicorn and Vite bind to. Deliberately avoids
REM  netstat piped through find/findstr: if Git for Windows is on
REM  PATH, its Unix "find" shadows the Windows one and the check
REM  silently breaks.
REM ============================================================
:find_free_port
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=%~1; $stop=%~1+60; while($p -lt $stop){try{$l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$p);$l.Start();$l.Stop();break}catch{$p++}}; $p"`) do set "%~2=%%p"
exit /b 0


REM ============================================================
:fail
echo.
echo  -----------------------------------------------------------
echo   Setup did not finish. Nothing was started.
echo  -----------------------------------------------------------
echo.
echo   Press any key to close...
pause >nul
exit /b 1
