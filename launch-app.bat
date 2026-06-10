@echo off
setlocal

set "APP_DIR=%~dp0"
set "HOST=127.0.0.1"
set "PORT=4173"
set "APP_URL=http://%HOST%:%PORT%/"

cd /d "%APP_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if (Test-NetConnection -ComputerName '%HOST%' -Port %PORT% -InformationLevel Quiet -WarningAction SilentlyContinue) { exit 0 } } catch {} exit 1" >nul 2>nul
if not errorlevel 1 (
  echo Ideogram JSON Studio is already available at %APP_URL%
  start "" "%APP_URL%"
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Opening index.html directly.
  start "" "%APP_DIR%index.html"
  exit /b 0
)

echo Starting Ideogram JSON Studio at %APP_URL%
echo Close the minimized "Ideogram JSON Studio server" window to stop the server.

start "Ideogram JSON Studio server" /min node -e "const http=require('http'),fs=require('fs'),path=require('path'),root=process.cwd(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};http.createServer((req,res)=>{const url=new URL(req.url,'http://%HOST%');let filePath=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!filePath.startsWith(root)){res.writeHead(403);res.end('Forbidden');return;}fs.stat(filePath,(statErr,stat)=>{if(statErr){res.writeHead(404);res.end('Not found');return;}if(stat.isDirectory())filePath=path.join(filePath,'index.html');fs.readFile(filePath,(readErr,body)=>{if(readErr){res.writeHead(500);res.end(String(readErr));return;}res.writeHead(200,{'Content-Type':types[path.extname(filePath).toLowerCase()]||'application/octet-stream'});res.end(body);});});}).listen(%PORT%,'%HOST%');"

timeout /t 1 /nobreak >nul
start "" "%APP_URL%"
