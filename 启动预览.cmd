@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo 首次运行需要安装项目依赖：npm.cmd ci
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  call npm.cmd run assets
  if errorlevel 1 exit /b 1
  call npm.cmd run build
  if errorlevel 1 exit /b 1
)
echo 请用浏览器打开 http://127.0.0.1:5173/
echo 这是电脑本地预览，关闭此窗口就停止；不会对公网发布。
node node_modules\vite\bin\vite.js preview --host 127.0.0.1 --port 5173 --strictPort
