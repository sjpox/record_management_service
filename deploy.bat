@echo off
echo === Pulling latest changes ===
git pull

echo === Installing dependencies ===
call npm install

echo === Building project ===
call npm run build

echo === Starting production server ===
call npm run start:prod
