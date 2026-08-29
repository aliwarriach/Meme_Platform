#!/usr/bin/env node
// Stop hook: if this turn left UI files (frontend/src/{app,components,features}/**/*.tsx|jsx)
// with uncommitted changes, block finishing the turn and tell Claude to run the
// "edge-case-ux-auditor" skill on them first — unless the user's own last message this turn
// explicitly asked to skip it, or we've already nagged for this exact set of changes.
//
// Enforcement lives here (not in memory/CLAUDE.md) because a hook is the only thing the
// harness actually runs on every Stop — a skill description saying "use me proactively" is
// a judgment call Claude can miss under load; this can't be skipped by oversight.
//
// Fails open: any error (git missing, bad transcript, etc.) allows the stop rather than
// blocking the user's session over a hook bug.

'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const UI_FILE_RE = /^frontend\/src\/(app|components|features)\/.*\.(tsx|jsx)$/;
const TEST_FILE_RE = /\.test\.(tsx|jsx)$|__tests__\//;
// Needs a negation word AND an audit/edge-case word within ~40 chars — narrow enough to
// avoid firing on unrelated uses of "audit", broad enough to catch natural phrasings like
// "skip the ux audit for this one" or "don't run the edge-case auditor here".
const OPT_OUT_RE = /\b(skip|don'?t|do not|without|no need for)\b[^.!?\n]{0,40}\b(ux[- ]?audit\w*|edge[- ]?case\w*|audit\w*)\b/i;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function findLastTypedUserMessage(transcriptPath) {
  if (!transcriptPath) return '';
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  } catch {
    return '';
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type !== 'user' || !entry.message || entry.message.role !== 'user') continue;
    const content = entry.message.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      // A tool result is also sent as a role:"user" message — that's not something the
      // human typed, so skip it and keep looking further back.
      if (content.some((b) => b && b.type === 'tool_result')) continue;
      const text = content
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join(' ')
        .trim();
      if (text) return text;
    }
  }
  return '';
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readStdin() || '{}');
  } catch {
    input = {};
  }

  // Belt-and-suspenders: never block twice in a row even if our own hash guard below has a bug.
  if (input.stop_hook_active) {
    process.stdout.write('{}');
    return;
  }

  const unstaged = git(['diff', '--name-only']);
  const staged = git(['diff', '--name-only', '--cached']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  const allChanged = new Set(
    `${unstaged}\n${staged}\n${untracked}`
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
  );

  const uiFiles = [...allChanged]
    .filter((f) => UI_FILE_RE.test(f) && !TEST_FILE_RE.test(f))
    .sort();

  if (uiFiles.length === 0) {
    process.stdout.write('{}');
    return;
  }

  // Content-aware signature (path + blob hash) so a further edit to an already-audited file
  // re-triggers, but repeatedly stopping on the same unchanged diff does not loop forever.
  const signature = uiFiles.map((f) => `${f}@${git(['hash-object', f]).trim()}`).join('|');
  const diffHash = crypto.createHash('sha256').update(signature).digest('hex');

  const sessionId = input.session_id || 'unknown-session';
  const stateFile = path.join(os.tmpdir(), `claude-ux-audit-stop-${sessionId}.json`);
  let prevState = null;
  try {
    prevState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    prevState = null;
  }

  if (prevState && prevState.diffHash === diffHash) {
    process.stdout.write('{}');
    return;
  }

  const lastUserText = findLastTypedUserMessage(input.transcript_path);
  const optedOut = OPT_OUT_RE.test(lastUserText);

  try {
    fs.writeFileSync(stateFile, JSON.stringify({ diffHash, ts: Date.now() }));
  } catch {
    // Non-fatal — worst case we re-nag next stop instead of looping silently.
  }

  if (optedOut) {
    process.stdout.write('{}');
    return;
  }

  const fileList = uiFiles.map((f) => `- ${f}`).join('\n');
  const reason =
    'UI files changed this turn:\n' +
    fileList +
    '\n\nBefore finishing, invoke the "edge-case-ux-auditor" skill (Skill tool, skill: ' +
    '"edge-case-ux-auditor") on the screen(s)/feature(s) touched above, so it can surface ' +
    'edge cases and UX gaps in what changed. It only suggests — it never edits code or ' +
    'writes memory files — so this is quick. Skip it only if the user explicitly asked you ' +
    'not to run it in their message this turn.';

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason,
      systemMessage: 'UI changed — running the edge-case-ux-auditor skill before finishing.',
    })
  );
}

main();
