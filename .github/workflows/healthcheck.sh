#!/usr/bin/env bash
base_url="https://respec.org"
IFS=$'\n' urls=($ENDPOINTS)
for url in "${urls[@]}"; do
  printf "${base_url}${url} ... ";
  full_url="${base_url}${url}?healthcheck=true"
  set +e
  http_code=$(curl -s -o /dev/null -L -w "%{http_code}" "$full_url")
  exit_code=$?
  set -e
  echo "$http_code"
  if [ $exit_code != 0 ]; then
    echo "curl exited with code: $exit_code"
  fi
  if [ $http_code != 200 ]; then
    echo "Reporting failure on Slack..."
    curl --fail -H "Content-Type: application/json" \
      -d "{ \"text\": \"🔴 HEAD $http_code ${url}\" }" \
      "$SLACK_WEBHOOK_URL"
  fi
done;
