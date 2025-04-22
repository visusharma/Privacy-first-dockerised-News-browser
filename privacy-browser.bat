@echo off 
echo Starting Privacy-First News Browser... 
cd /d "%~dp0" 
start "" "http://localhost:3000" 
docker-compose up -d 
echo Browser launched! If the page doesn't open automatically, visit http://localhost:3000 
