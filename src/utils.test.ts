import { describe, it, expect } from 'vitest';

// --- cleanJsonText ---

function cleanJsonText(text: string): string {
  if (!text) return '{}';
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  return cleaned.trim();
}

// --- safeJsonParse ---

function safeJsonParse(text: string) {
  const cleaned = cleanJsonText(text);
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    let inString = false;
    let escaped = false;
    let sanitized = '';

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"' && !escaped) {
        inString = !inString;
        sanitized += char;
      } else if (inString && (char === '\n' || char === '\r' || char === '\t')) {
        if (char === '\n') sanitized += '\\n';
        else if (char === '\r') sanitized += '\\r';
        else if (char === '\t') sanitized += '\\t';
      } else {
        sanitized += char;
      }
      if (char === '\\' && !escaped) escaped = true;
      else escaped = false;
    }

    return JSON.parse(sanitized);
  }
}

// --- splitText ---

function splitText(text: string, maxChars: number = 2500): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    if ((currentChunk + para).length < maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      if (para.length > maxChars) {
        const sentences = para.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [para];
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length < maxChars) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = para;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// --- Tests ---

describe('cleanJsonText', () => {
  it('returns empty object for empty input', () => {
    expect(cleanJsonText('')).toBe('{}');
  });

  it('strips markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(cleanJsonText(input)).toBe('{"key": "value"}');
  });

  it('extracts first JSON object from mixed text', () => {
    const input = 'Some preamble text {"key": "value"} trailing';
    expect(cleanJsonText(input)).toBe('{"key": "value"}');
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' });
  });

  it('sanitizes unescaped newlines in strings', () => {
    const input = '{"text": "line1\nline2"}';
    expect(safeJsonParse(input)).toEqual({ text: 'line1\nline2' });
  });

  it('handles markdown-wrapped JSON', () => {
    const input = '```json\n{"a": 1}\n```';
    expect(safeJsonParse(input)).toEqual({ a: 1 });
  });
});

describe('splitText', () => {
  it('returns single chunk for short text', () => {
    expect(splitText('Hello world')).toEqual(['Hello world']);
  });

  it('splits text at paragraph boundaries', () => {
    const text = 'A'.repeat(1500) + '\n\n' + 'B'.repeat(1500);
    const chunks = splitText(text, 2000);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBeLessThanOrEqual(2000);
    expect(chunks[1].length).toBeLessThanOrEqual(2000);
  });

  it('handles long paragraph without sentence breaks', () => {
    const text = 'A'.repeat(5000);
    const chunks = splitText(text, 2500);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(5000);
  });

  it('returns empty array for empty input', () => {
    expect(splitText('')).toEqual([]);
  });
});
