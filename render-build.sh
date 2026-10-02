#!/usr/bin/env bash
# exit on error
set -o errexit

echo "==> Building React Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "==> Installing Python Backend Dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo "==> Render Build Completed Successfully!"
