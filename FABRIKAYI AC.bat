@echo off
REM Sanal fabrikayi yerelde acar. Hicbir sey indirmez - bilgisayarda kurulu
REM Python'un dahili web sunucusunu kullanir (ES modulleri file:// ile calismaz).
setlocal
set "SITE=%~dp0"
set "PORT=8090"

echo.
echo   Sanal Fabrika:  http://localhost:%PORT%/
echo   Durdurmak icin bu pencerede Ctrl+C.
echo.

start "" "http://localhost:%PORT%/"
python -m http.server %PORT% --directory "%SITE%" --bind 127.0.0.1

echo.
echo Sunucu durdu. (Port %PORT% dolu ise baska bir pencerede zaten calisiyor olabilir.)
pause
