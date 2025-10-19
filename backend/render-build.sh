#!/usr/bin/env bash

echo "📦 Installing ffmpeg & python3..."
apt-get update -y || true
apt-get install -y --no-install-recommends ffmpeg python3 python3-pip || true

echo "🎵 Installing yt-dlp..."
pip3 install yt-dlp

echo "📁 Installing Node dependencies..."
npm install

echo "✅ Build completed"
