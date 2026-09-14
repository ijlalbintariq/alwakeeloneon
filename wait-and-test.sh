#!/bin/bash
echo "Waiting for port 3000..."
while ! nc -z localhost 3000; do   
  sleep 1
done
echo "Port 3000 is open! Running test..."
npx tsx test-live-api.ts
