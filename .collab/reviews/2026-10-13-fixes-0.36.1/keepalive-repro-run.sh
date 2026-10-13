#!/bin/sh
set -e
apk add --no-cache -q python3 iptables
python3 -V
exec python3 /repro/repro.py
