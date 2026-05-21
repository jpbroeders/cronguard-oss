export const LANGUAGES = [
  { id: 'curl', name: 'cURL' },
  { id: 'bash', name: 'Bash' },
  { id: 'python', name: 'Python' },
  { id: 'node', name: 'Node.js' },
  { id: 'k8s', name: 'k8s CronJob' },
  { id: 'go', name: 'Go' },
  { id: 'php', name: 'PHP' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'java', name: 'Java' },
  { id: 'csharp', name: 'C#' },
  { id: 'rust', name: 'Rust' },
  { id: 'powershell', name: 'PowerShell' },
]

export interface CodeExampleOptions {
  // When supplied, every snippet includes the corresponding header in its
  // request syntax so it Just Works for monitors that require auth.
  authHeaders?: { name: string; value: string }[] | null
}

// Each snippet shows two things:
//   1. The minimal "I'm alive" GET ping.
//   2. A POST that reports how long the job took (`duration` in ms), so the
//      dashboard can show real runtimes instead of just liveness.
export function getCodeExample(
  language: string,
  baseUrl: string,
  options?: CodeExampleOptions,
): string {
  const url = `${baseUrl}/api/ping/YOUR_MONITOR_ID`
  const headers = options?.authHeaders ?? []
  const hasHeaders = headers.length > 0

  // Language-specific header rendering helpers
  const curlHeaderFlags = headers
    .map((h) => ` \\\n  -H "${h.name}: ${h.value}"`)
    .join('')
  const pyHeaders = hasHeaders
    ? `, headers={${headers.map((h) => `"${h.name}": "${h.value}"`).join(', ')}}`
    : ''
  const nodeHeaderLines = hasHeaders
    ? `, headers: { ${headers.map((h) => `"${h.name}": "${h.value}"`).join(', ')} }`
    : ''
  const phpHeaderLines = hasHeaders
    ? `\n\$opts = ['http' => ['header' => "${headers.map((h) => `${h.name}: ${h.value}`).join('\\r\\n')}"]];\n`
    : ''

  const examples: Record<string, string> = {
    curl: `# Simple "I'm alive" ping
curl -fsS${curlHeaderFlags} "${url}"

# With timeout
curl -fsS --max-time 10${curlHeaderFlags} "${url}"

# Report how long the job took (in milliseconds)
START=$(date +%s%3N)
./my-script.sh
DURATION=$(($(date +%s%3N) - START))
curl -fsS -X POST${curlHeaderFlags} \\
  -H "Content-Type: application/json" \\
  -d "{\\"success\\":true,\\"duration\\":$DURATION}" \\
  "${url}"

# Report failure on error
./my-script.sh && curl -fsS${curlHeaderFlags} "${url}" \\
  || curl -fsS -X POST${curlHeaderFlags} -d '{"success":false}' "${url}"`,

    bash: `#!/bin/bash
set -e

URL="${url}"

# Time the job and report duration (in ms) on success
START=$(date +%s%3N)
echo "Running backup..."
./backup.sh
DURATION=$(($(date +%s%3N) - START))

curl -fsS -X POST${curlHeaderFlags} \\
  -H "Content-Type: application/json" \\
  -d "{\\"success\\":true,\\"duration\\":$DURATION}" \\
  "$URL"`,

    python: `import time
import requests

URL = "${url}"

def main():
    start = time.monotonic()
    # Your job logic here
    print("Running scheduled task...")

    duration_ms = int((time.monotonic() - start) * 1000)

    # Report success + how long the job ran
    requests.post(
        URL,
        json={"success": True, "duration": duration_ms}${pyHeaders}
    )

if __name__ == "__main__":
    main()`,

    node: `// Simple "I'm alive" ping
fetch("${url}"${hasHeaders ? `, { ${nodeHeaderLines.slice(2)} }` : ''});

// Report success + duration (ms) so you can see how long the job ran
async function runJob() {
  const start = Date.now();
  try {
    await doSomething();
    await fetch("${url}", {
      method: "POST"${nodeHeaderLines.replace(', headers', ',\n      headers')},
      headers: { "Content-Type": "application/json"${hasHeaders ? ', ' + headers.map((h) => `"${h.name}": "${h.value}"`).join(', ') : ''} },
      body: JSON.stringify({ success: true, duration: Date.now() - start })
    });
  } catch (error) {
    await fetch("${url}", {
      method: "POST",
      headers: { "Content-Type": "application/json"${hasHeaders ? ', ' + headers.map((h) => `"${h.name}": "${h.value}"`).join(', ') : ''} },
      body: JSON.stringify({ success: false, duration: Date.now() - start })
    });
  }
}`,

    go: `package main

import (
    "bytes"
    "fmt"
    "net/http"
    "time"
)

func main() {
    start := time.Now()

    // Your job logic here
    runJob()

    // Report success + duration in ms
    durationMs := time.Since(start).Milliseconds()
    body := bytes.NewBufferString(fmt.Sprintf(\`{"success":true,"duration":%d}\`, durationMs))
    req, _ := http.NewRequest("POST", "${url}", body)
    req.Header.Set("Content-Type", "application/json")${headers
      .map((h) => `\n    req.Header.Set("${h.name}", "${h.value}")`)
      .join('')}
    http.DefaultClient.Do(req)
}`,

    k8s: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: backup:latest
            command:
            - /bin/sh
            - -c
            - |
              START=$(date +%s%3N)
              ./run.sh
              DURATION=$(($(date +%s%3N) - START))
              wget -q -O- --post-data="{\\"success\\":true,\\"duration\\":\$DURATION}" \\
                --header="Content-Type: application/json"${headers
                  .map((h) => ` \\\n                --header="${h.name}: ${h.value}"`)
                  .join('')} \\
                "${url}"`,

    php: `<?php
\$start = microtime(true);

// Your job logic here
runBackup();

\$durationMs = (int) ((microtime(true) - \$start) * 1000);
${phpHeaderLines}\$payload = json_encode(['success' => true, 'duration' => \$durationMs]);
\$ctx = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json${headers.map((h) => `\\r\\n${h.name}: ${h.value}`).join('')}",
        'content' => \$payload,
    ],
]);
file_get_contents("${url}", false, \$ctx);`,

    ruby: `require 'net/http'
require 'json'

start = Process.clock_gettime(Process::CLOCK_MONOTONIC)

# Your job logic here
run_backup

duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).to_i

uri = URI("${url}")
req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json'${headers
  .map((h) => `, '${h.name}' => '${h.value}'`)
  .join('')})
req.body = { success: true, duration: duration_ms }.to_json
Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') { |http| http.request(req) }`,

    java: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class CronJob {
    public static void main(String[] args) throws Exception {
        long start = System.currentTimeMillis();

        // Your job logic here
        runJob();

        long durationMs = System.currentTimeMillis() - start;
        String body = String.format("{\\"success\\":true,\\"duration\\":%d}", durationMs);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${url}"))
            .header("Content-Type", "application/json")${headers
              .map((h) => `\n            .header("${h.name}", "${h.value}")`)
              .join('')}
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }
}`,

    csharp: `using System.Net.Http;
using System.Text;
using System.Diagnostics;

var sw = Stopwatch.StartNew();

// Your job logic here
await RunJob();

sw.Stop();

var payload = $"{{\\"success\\":true,\\"duration\\":{sw.ElapsedMilliseconds}}}";
var content = new StringContent(payload, Encoding.UTF8, "application/json");
var http = new HttpClient();${headers
      .map((h) => `\nhttp.DefaultRequestHeaders.Add("${h.name}", "${h.value}");`)
      .join('')}
await http.PostAsync("${url}", content);`,

    rust: `use std::time::Instant;
use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() {
    let start = Instant::now();

    // Your job logic here
    run_job().await;

    let duration_ms = start.elapsed().as_millis() as u64;

    Client::new()
        .post("${url}")${headers
          .map((h) => `\n        .header("${h.name}", "${h.value}")`)
          .join('')}
        .json(&json!({ "success": true, "duration": duration_ms }))
        .send()
        .await
        .unwrap();
}`,

    powershell: `\$sw = [System.Diagnostics.Stopwatch]::StartNew()

# Your job logic here
& .\\backup.ps1

\$sw.Stop()

\$body = @{ success = \$true; duration = \$sw.ElapsedMilliseconds } | ConvertTo-Json
\$headers = @{${headers
      .map((h) => ` "${h.name}" = "${h.value}";`)
      .join('')} }
Invoke-RestMethod -Uri "${url}" -Method POST -ContentType "application/json" -Body \$body${
      hasHeaders ? ' -Headers $headers' : ''
    }`,
  }

  return examples[language] || examples.curl
}
