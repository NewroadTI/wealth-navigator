#!/bin/bash
# TWR Diagnostics Runner

echo "========================================"
echo "TWR Calculation Diagnostics"
echo "========================================"

# Get the account code from user
if [ -z "$1" ]; then
    echo "Usage: ./run_twr_diagnostics.sh <account_code>"
    echo "Example: ./run_twr_diagnostics.sh U1234567_USD"
    exit 1
fi

ACCOUNT=$1
START_DATE="2025-02-11"
END_DATE="2026-02-11"

echo ""
echo "📊 Step 1: Analyzing all cash journal types..."
echo "--------------------------------------"
python3 analyze_cash_types.py "$ACCOUNT" "$START_DATE" "$END_DATE"

echo ""
echo ""
echo "🔍 Step 2: Detailed TWR calculation analysis..."
echo "--------------------------------------"
python3 debug_twr_calculation.py "$ACCOUNT" "$START_DATE" "$END_DATE"

echo ""
echo "✅ Diagnostics complete!"
echo ""
