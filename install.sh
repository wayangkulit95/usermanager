#!/bin/bash

# Update the system
echo "Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm
echo "Installing Node.js and npm..."
sudo apt install nodejs npm -y

# Install SQLite3
echo "Installing SQLite3..."
sudo apt install sqlite3 -y

# Install PM2 to run the app 24/7
echo "Installing PM2..."
sudo npm install pm2 -g

# Set the system time zone to Malaysia time
echo "Setting the time zone to Malaysia (Asia/Kuala_Lumpur)..."
sudo timedatectl set-timezone Asia/Kuala_Lumpur

# Navigate to your app's directory
APP_DIR="/root/myapp"  # Change to your desired application directory
mkdir -p "$APP_DIR"           # Create the app directory if it doesn't exist
cd "$APP_DIR"

# Download your script
echo "Downloading app.js..."
curl -O https://raw.githubusercontent.com/wayangkulit95/usermanager/main/app.js

# Install required Node.js packages
echo "Installing Node.js dependencies..."
npm install express sqlite3 body-parser node-fetch@2 express-session

# Create the SQLite database and users table if it doesn't exist
echo "Setting up SQLite database..."
sqlite3 data.db "CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    code TEXT NOT NULL,
    expiration TEXT NOT NULL,
    allowedCountries TEXT NOT NULL,
    allowedDevices TEXT DEFAULT '',
    userAgent TEXT DEFAULT '',
    userId TEXT NOT NULL,
    userCode TEXT NOT NULL
);"

# Run app.js with PM2 (so it will restart if it crashes)
echo "Starting the app with PM2..."
pm2 start app.js --name myapp

# Save PM2 process list and set it to restart on system boot
echo "Saving PM2 process list and enabling startup..."
pm2 save
pm2 startup

echo "Installation complete. The app is running and will restart on reboot."
