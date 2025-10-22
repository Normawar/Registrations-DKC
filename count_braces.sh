#!/bin/bash
file="$1"
open=0
close=0
line_num=0
while IFS= read -r line; do
    line_num=$((line_num + 1))
    open_count=$(echo "$line" | grep -o '{' | wc -l)
    close_count=$(echo "$line" | grep -o '}' | wc -l)
    open=$((open + open_count))
    close=$((close + close_count))
    balance=$((open - close))
    if [ $balance -lt 0 ]; then
        echo "Line $line_num: Too many closing braces (balance: $balance)"
    fi
done < "$file"
echo "Total: $open opening, $close closing, balance: $((open - close))"
