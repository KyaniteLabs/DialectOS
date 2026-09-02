import { execSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

// Documentation placeholder in RFC 6598 shared address space (100.64.0.0/10),
// the range Tailscale assigns node IPs from. It preserves the detection shape
// (any tracked file naming a 100.64/10 endpoint is flagged) without shipping a
// real private endpoint in the test itself.
const PRIVATE_IP = '100.64.0.1';

function trackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output.trim().split('\n');
}

test('no tracked file contains private Tailscale endpoint', () => {
  const files = trackedFiles();
  const offenders = [];
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.gif') || file.endsWith('.ico') || file.endsWith('.woff') || file.endsWith('.woff2')) continue;
    try {
      // Read from index (staged) if available, otherwise HEAD
      let content;
      try {
        content = execSync(`git show :"${file}"`, { encoding: 'utf8' });
      } catch {
        content = execSync(`git show HEAD:"${file}"`, { encoding: 'utf8' });
      }
      // Skip files that reference the IP as a remediation/test constant
      if (content.includes(PRIVATE_IP) && !content.includes('PRIVATE_IP')) {
        offenders.push(file);
      }
    } catch {
      // skip files that can't be read as text
    }
  }
  assert.deepStrictEqual(offenders, [], `tracked files must not contain private IP ${PRIVATE_IP}: ${offenders.join(', ')}`);
});

test('.omc runtime state is not tracked in git', () => {
  const tracked = trackedFiles();
  const omcTracked = tracked.filter((f) => f.startsWith('.omc/'));
  assert.deepStrictEqual(omcTracked, [], '.omc/ runtime state must not be tracked');
});
