import { describe, it, expect } from 'vitest';
import { splitMessage } from './message-splitter.js';

describe('splitMessage', () => {
  it('returns single chunk for short messages', () => {
    expect(splitMessage('hello')).toEqual(['hello']);
  });

  it('returns single chunk for exactly max length', () => {
    const text = 'a'.repeat(2000);
    expect(splitMessage(text)).toEqual([text]);
  });

  it('splits at newline boundary', () => {
    const line = 'a'.repeat(100) + '\n';
    const text = line.repeat(25); // 2525 chars
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(2);
    // No chunk should exceed the limit
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
    // All content should be preserved
    expect(chunks.join('\n').replace(/\n+/g, '\n')).toContain('a'.repeat(100));
  });

  it('splits at blank line when available', () => {
    const para1 = 'a'.repeat(900);
    const para2 = 'b'.repeat(900);
    const para3 = 'c'.repeat(900);
    const text = `${para1}\n\n${para2}\n\n${para3}`;
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('aaa');
    expect(chunks[0]).toContain('bbb');
    expect(chunks[1]).toContain('ccc');
  });

  it('closes and reopens code fences at split', () => {
    const codeLine = 'x = 1\n';
    // Build a code block that exceeds 2000 chars
    const code = codeLine.repeat(400); // 2400 chars of code
    const text = '```python\n' + code + '```';
    const chunks = splitMessage(text);
    expect(chunks.length).toBeGreaterThan(1);
    // First chunk should end with closing fence
    expect(chunks[0].trimEnd().endsWith('```')).toBe(true);
    // Second chunk should start with reopened fence
    expect(chunks[1].startsWith('```python')).toBe(true);
  });

  it('handles code fence that fits in one chunk', () => {
    const text = 'Hello\n```python\nprint("hi")\n```\nDone';
    const chunks = splitMessage(text);
    expect(chunks).toEqual([text]);
  });

  it('preserves fence language tag across splits', () => {
    const code = 'line\n'.repeat(500);
    const text = '```typescript\n' + code + '```';
    const chunks = splitMessage(text);
    expect(chunks[1].startsWith('```typescript')).toBe(true);
  });

  it('handles multiple code blocks', () => {
    const block1 = '```js\n' + 'a\n'.repeat(100) + '```\n';
    const block2 = '```py\n' + 'b\n'.repeat(100) + '```\n';
    const text = block1 + '\n' + block2;
    // Should not mangle fence state across separate blocks
    const chunks = splitMessage(text);
    const rejoined = chunks.join('\n');
    // Count opening and closing fences — should be balanced
    const fences = rejoined.match(/```/g) || [];
    expect(fences.length % 2).toBe(0);
  });

  it('falls back to space split when no newlines', () => {
    const words = Array(500).fill('hello').join(' '); // 2999 chars
    const chunks = splitMessage(words);
    expect(chunks.length).toBe(2);
    // Should not cut mid-word
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/^ello/);
      expect(chunk).not.toMatch(/hel$/);
    }
  });

  it('hard cuts when no good split point exists', () => {
    const text = 'a'.repeat(5000); // no spaces or newlines
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(3);
    expect(chunks.join('')).toBe(text);
  });

  it('respects custom max length', () => {
    const text = 'a'.repeat(100);
    const chunks = splitMessage(text, 30);
    expect(chunks.length).toBe(4);
  });

  it('no chunk exceeds maxLength even with fence close/reopen', () => {
    const code = 'x = 1\n'.repeat(400);
    const text = '```python\n' + code + '```';
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it('handles real-world agent output with prose and code', () => {
    const prose = 'Here is the implementation:\n\n';
    const code = '```python\n' + '    def method(self):\n        pass\n'.repeat(80) + '```\n';
    const outro = '\nLet me know if you have questions!';
    const text = prose + code + outro;
    const chunks = splitMessage(text);

    // All chunks should be valid length
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }

    // Every chunk that starts mid-code-block should open with a fence
    // Every chunk that ends mid-code-block should close with a fence
    for (let i = 0; i < chunks.length; i++) {
      const fences = (chunks[i].match(/^```/gm) || []).length;
      // Fences should be balanced (even count) within each chunk
      expect(fences % 2).toBe(0);
    }
  });
});
