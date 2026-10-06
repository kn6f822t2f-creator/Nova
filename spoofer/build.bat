@echo off
setlocal

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (
    `"%VSWHERE%" -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe`
) do set "MSBUILD=%%i"

if not defined MSBUILD (
    echo [!] MSBuild not found. Install VS2022 with WDK.
    pause & exit /b 1
)

set "CFG=Release"
set "PLT=x64"
set "OUTDIR=%~dp0bin\%PLT%\%CFG%"

echo.
echo  Nova HWID Spoofer - Build
echo  ==========================
echo.

echo [1/2] Building kernel driver ...
"%MSBUILD%" driver\spoofer.vcxproj /p:Configuration=%CFG% /p:Platform=%PLT% /m /nologo /v:minimal
if errorlevel 1 ( echo [!] Driver build FAILED. & pause & exit /b 1 )
echo [+] spoofer.sys built.
echo.

if not exist "%OUTDIR%\spoofer.sys" (
    echo [!] spoofer.sys not found at %OUTDIR%\spoofer.sys
    pause & exit /b 1
)

echo [2/2] Building loader (embedding driver) ...
"%MSBUILD%" loader\loader.vcxproj /p:Configuration=%CFG% /p:Platform=%PLT% /m /nologo /v:minimal
if errorlevel 1 ( echo [!] Loader build FAILED. & pause & exit /b 1 )
echo [+] NovaSpoof.exe built.
echo.

echo  Build complete.
echo  Output : %OUTDIR%\NovaSpoof.exe
echo.
echo  1. bcdedit /set testsigning on   (once, reboot)
echo  2. Run NovaSpoof.exe as admin
echo.
echo  NOTE: test signing = visible to BE/Vanguard. EV cert or BYOVD needed for those.
echo.
pause
