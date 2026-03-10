#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const dbPath = path.join(process.cwd(), 'store', 'messages.db');
const db = new Database(dbPath);

interface GroupRow {
  jid: string;
  name: string;
  folder: string;
  requiresTrigger: number;
  isMain: number;
}

const groups = db
  .prepare('SELECT jid, name, folder, requiresTrigger, isMain FROM registered_groups')
  .all() as GroupRow[];

if (groups.length === 0) {
  console.log('No registered groups found.');
  process.exit(0);
}

console.log('\nRegistered groups:\n');
groups.forEach((g, i) => {
  const flags = [
    g.isMain ? 'main' : 'trigger-only',
  ].join(', ');
  console.log(`  ${i + 1}. ${g.name} (${g.jid}) [${flags}]`);
  console.log(`     folder: ${g.folder}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
  const groupArg = process.argv[2];
  let target: GroupRow | undefined;

  if (groupArg) {
    const index = parseInt(groupArg, 10);
    target = !isNaN(index)
      ? groups[index - 1]
      : groups.find((g) => g.folder === groupArg || g.name === groupArg);
  } else {
    const answer = await ask('\nEnter number to unregister: ');
    const index = parseInt(answer.trim(), 10);
    if (isNaN(index) || index < 1 || index > groups.length) {
      console.error('Invalid selection.');
      db.close();
      rl.close();
      process.exit(1);
    }
    target = groups[index - 1];
  }

  if (!target) {
    console.error(`\nNo group found for: ${groupArg}`);
    db.close();
    rl.close();
    process.exit(1);
  }

  if (target.isMain) {
    const confirm = await ask(
      `\n⚠ "${target.name}" is your main group. Unregister anyway? (y/N): `,
    );
    if (confirm.trim().toLowerCase() !== 'y') {
      console.log('Cancelled.');
      db.close();
      rl.close();
      process.exit(0);
    }
  }

  // Always: remove registration and orphaned session
  db.prepare('DELETE FROM registered_groups WHERE jid = ?').run(target.jid);
  db.prepare('DELETE FROM sessions WHERE group_folder = ?').run(target.folder);
  console.log(`\nUnregistered: ${target.name} (${target.jid})`);
  console.log('Cleared session.');

  // Prompt: delete group files on disk
  const groupDir = path.join(process.cwd(), 'groups', target.folder);
  const sessionDir = path.join(process.cwd(), 'data', 'sessions', target.folder);
  const hasGroupDir = fs.existsSync(groupDir);
  const hasSessionDir = fs.existsSync(sessionDir);

  if (hasGroupDir || hasSessionDir) {
    console.log('\nFiles on disk:');
    if (hasGroupDir) console.log(`  ${groupDir}`);
    if (hasSessionDir) console.log(`  ${sessionDir}`);

    const deleteFiles = await ask(
      '\nDelete files on disk? Keep if you might re-register. (y/N): ',
    );
    if (deleteFiles.trim().toLowerCase() === 'y') {
      if (hasGroupDir) fs.rmSync(groupDir, { recursive: true });
      if (hasSessionDir) fs.rmSync(sessionDir, { recursive: true });
      console.log('Deleted.');
    } else {
      console.log('Files kept.');
    }
  }

  console.log('\nDone. Restart the service for changes to take effect.');
  db.close();
  rl.close();
}

run();
