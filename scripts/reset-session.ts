#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import path from 'path';
import readline from 'readline';

const dbPath = path.join(process.cwd(), 'store', 'messages.db');
const db = new Database(dbPath);

interface SessionRow {
  group_folder: string;
  session_id: string;
}

interface GroupRow {
  jid: string;
  name: string;
  folder: string;
  isMain: number;
}

const sessions = db
  .prepare('SELECT group_folder, session_id FROM sessions')
  .all() as SessionRow[];

const groups = db
  .prepare('SELECT jid, name, folder, isMain FROM registered_groups')
  .all() as GroupRow[];

if (sessions.length === 0) {
  console.log('No active sessions found.');
  process.exit(0);
}

console.log('\nActive sessions:\n');
sessions.forEach((s, i) => {
  const group = groups.find((g) => g.folder === s.group_folder);
  const name = group ? `${group.name} (${group.jid})` : s.group_folder;
  const main = group?.isMain ? ' [main]' : '';
  console.log(`  ${i + 1}. ${name}${main}`);
  console.log(`     session: ${s.session_id}`);
});

function resetSession(groupFolder: string): void {
  // Clear the session ID so a fresh Claude Code thread starts
  db.prepare('DELETE FROM sessions WHERE group_folder = ?').run(groupFolder);

  // Advance lastAgentTimestamp to now so old messages aren't re-fed.
  // This is stored as a JSON object keyed by JID in the router_state table.
  const group = groups.find((g) => g.folder === groupFolder);
  if (group) {
    const raw = db
      .prepare("SELECT value FROM router_state WHERE key = 'last_agent_timestamp'")
      .get() as { value: string } | undefined;
    const timestamps: Record<string, string> = raw ? JSON.parse(raw.value) : {};
    timestamps[group.jid] = new Date().toISOString();
    db.prepare("INSERT OR REPLACE INTO router_state (key, value) VALUES ('last_agent_timestamp', ?)").run(
      JSON.stringify(timestamps),
    );
    console.log(`Advanced message cursor for ${group.jid}`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const groupArg = process.argv[2];
if (groupArg) {
  // Non-interactive: reset by folder name or number
  const index = parseInt(groupArg, 10);
  const target = !isNaN(index)
    ? sessions[index - 1]
    : sessions.find((s) => s.group_folder === groupArg);

  if (!target) {
    console.error(`\nNo session found for: ${groupArg}`);
    process.exit(1);
  }

  resetSession(target.group_folder);
  console.log(`\nReset session for: ${target.group_folder}`);
  db.close();
  process.exit(0);
}

rl.question('\nEnter number to reset (or "all"): ', (answer) => {
  rl.close();

  if (answer.trim().toLowerCase() === 'all') {
    for (const s of sessions) {
      resetSession(s.group_folder);
    }
    console.log(`\nReset all ${sessions.length} sessions.`);
  } else {
    const index = parseInt(answer.trim(), 10);
    if (isNaN(index) || index < 1 || index > sessions.length) {
      console.error('Invalid selection.');
      db.close();
      process.exit(1);
    }
    const target = sessions[index - 1];
    resetSession(target.group_folder);
    console.log(`\nReset session for: ${target.group_folder}`);
  }

  console.log('Next message in that channel will start a fresh session.');
  db.close();
});
