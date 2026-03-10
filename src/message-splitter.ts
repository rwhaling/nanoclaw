/**
 * Split a message into chunks that fit within a character limit,
 * preserving markdown code fences across splits.
 */
export function splitMessage(text: string, maxLength = 2000): string[] {
  if (text.length <= maxLength) return [text];

  const FENCE_RESERVE = 4; // "\n```" appended when closing a fence
  const safeMax = maxLength - FENCE_RESERVE;
  const chunks: string[] = [];
  let remaining = text;
  let insideCodeFence = false;
  let currentFenceTag = '```';

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    const candidate = remaining.slice(0, safeMax);

    // Find best split point: blank line > newline > space > hard cut
    const minSplit = safeMax * 0.25;
    let splitAt = candidate.lastIndexOf('\n\n');
    if (splitAt === -1 || splitAt < minSplit) {
      splitAt = candidate.lastIndexOf('\n');
    }
    if (splitAt === -1 || splitAt < minSplit) {
      splitAt = candidate.lastIndexOf(' ');
    }
    if (splitAt === -1 || splitAt < minSplit) {
      splitAt = safeMax;
    }

    let chunk = remaining.slice(0, splitAt);
    remaining = remaining.slice(splitAt).replace(/^\n/, '');

    // Track code fence state by scanning lines in this chunk
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed.startsWith('```')) {
        if (insideCodeFence) {
          insideCodeFence = false;
        } else {
          insideCodeFence = true;
          currentFenceTag = trimmed;
        }
      }
    }

    // Close/reopen fences at split boundary
    if (insideCodeFence) {
      chunk = chunk + '\n```';
      remaining = currentFenceTag + '\n' + remaining;
      // Reset state — we closed the fence in this chunk.
      // The reopened fence in `remaining` will toggle it back to true
      // when scanned in the next iteration.
      insideCodeFence = false;
    }

    chunks.push(chunk);
  }

  return chunks;
}
