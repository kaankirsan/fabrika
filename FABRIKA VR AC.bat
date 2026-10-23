@echo off
REM Sanal fabrikayi Quest (VR) icin yerel agda HTTPS ile yayinlar.
REM Ilk calistirmada Windows guvenlik duvari izin sorabilir: "Ozel aglar"a izin verin.
setlocal
cd /d "%~dp0"
python "%~dp0tools\https_sunucu.py" 8443
echo.
echo Sunucu durdu. (Port 8443 dolu ise baska bir pencerede zaten calisiyor olabilir.)
pause
