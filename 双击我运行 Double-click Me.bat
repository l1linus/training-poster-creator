@echo off
cd /d "%~dp0"
for %%f in (*.html) do if /i not "%%~nf"=="training-poster-generator-en" if /i not "%%~nf"=="generator-en" start "" "%%~ff"
