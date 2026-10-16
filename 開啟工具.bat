@echo off
rem Open the toolbox: start a local web server and open the browser.
rem Close this window to stop the server.
cd /d "%~dp0web"
echo.
echo   http://127.0.0.1:8765/   (Chrome or Edge)
echo   Close this window to stop.
echo.
start "" "http://127.0.0.1:8765/"
python -m http.server 8765 --bind 127.0.0.1
pause
