/**
 * Minimal ICU MessageFormat renderer for the comparison UI.
 *
 * Goal: make strings readable for non-technical reviewers WITHOUT hiding quality.
 *  - Simple placeholders `{name}` become inline "chips".
 *  - Plural/select blocks expand into one labelled line per branch (e.g. `one`, `other`),
 *    each rendered as a full sentence with surrounding text folded in.
 *
 * This is a pragmatic parser, not a spec-complete one — it handles the constructs that
 * appear in the data (plain placeholders, `plural`, `select`, `selectordinal`, `#`) and
 * falls back to showing the raw text if anything looks malformed.
 */

/** One rendered piece of a line: either literal text or a placeholder chip. */
export interface InlineNode {
  chip: boolean;
  value: string;
}

/** A rendered line. `key` is the plural/select branch label, or null for a flat message. */
export interface MessageLine {
  key: string | null;
  nodes: InlineNode[];
}

export interface RenderedMessage {
  lines: MessageLine[];
  hasPlural: boolean;
}

type Ast = AstPart[];
type AstPart =
  | { kind: 'text'; value: string }
  | { kind: 'arg'; name: string }
  | { kind: 'hash' }
  | { kind: 'plural'; name: string; options: PluralOption[] };
interface PluralOption {
  key: string;
  value: Ast;
}

const SELECTORS = new Set(['plural', 'select', 'selectordinal']);

function parse(input: string): Ast {
  let i = 0;

  function parseParts(stopAtBrace: boolean): Ast {
    const parts: AstPart[] = [];
    let text = '';
    const flush = () => {
      if (text) {
        parts.push({ kind: 'text', value: text });
        text = '';
      }
    };
    while (i < input.length) {
      const ch = input[i];
      if (ch === '}' && stopAtBrace) break;
      if (ch === '#') {
        flush();
        parts.push({ kind: 'hash' });
        i++;
        continue;
      }
      if (ch === '{') {
        flush();
        parts.push(parseBrace());
        continue;
      }
      text += ch;
      i++;
    }
    flush();
    return parts;
  }

  function parseBrace(): AstPart {
    i++; // consume '{'
    let name = '';
    while (i < input.length && input[i] !== ',' && input[i] !== '}') name += input[i++];
    name = name.trim();
    if (input[i] === '}') {
      i++;
      return { kind: 'arg', name };
    }
    i++; // consume ','
    let type = '';
    while (i < input.length && input[i] !== ',' && input[i] !== '}') type += input[i++];
    type = type.trim();

    if (SELECTORS.has(type)) {
      if (input[i] === ',') i++;
      const options: PluralOption[] = [];
      while (i < input.length && input[i] !== '}') {
        while (i < input.length && /\s/.test(input[i])) i++;
        if (input[i] === '}') break;
        let key = '';
        while (i < input.length && input[i] !== '{' && !/\s/.test(input[i])) key += input[i++];
        while (i < input.length && /\s/.test(input[i])) i++;
        if (input[i] !== '{') break; // malformed → stop
        i++; // consume '{'
        const value = parseParts(true);
        if (input[i] === '}') i++; // consume option's closing '}'
        options.push({ key, value });
        while (i < input.length && /\s/.test(input[i])) i++;
      }
      if (input[i] === '}') i++; // consume the selector's closing '}'
      return { kind: 'plural', name, options };
    }

    // Unsupported format (e.g. {x, number}); skip to the matching brace, render as a chip.
    let depth = 1;
    while (i < input.length && depth > 0) {
      if (input[i] === '{') depth++;
      else if (input[i] === '}') depth--;
      i++;
    }
    return { kind: 'arg', name };
  }

  return parseParts(false);
}

function firstPlural(ast: Ast): Extract<AstPart, { kind: 'plural' }> | null {
  for (const part of ast) if (part.kind === 'plural') return part;
  return null;
}

function pushText(nodes: InlineNode[], value: string): void {
  const last = nodes[nodes.length - 1];
  if (last && !last.chip) last.value += value;
  else nodes.push({ chip: false, value });
}

function render(
  ast: Ast,
  target: AstPart | null,
  chosenKey: string | null,
  hashVar: string | null,
  out: InlineNode[],
): void {
  for (const part of ast) {
    if (part.kind === 'text') pushText(out, part.value);
    else if (part.kind === 'arg') out.push({ chip: true, value: part.name });
    else if (part.kind === 'hash') {
      if (hashVar) out.push({ chip: true, value: hashVar });
      else pushText(out, '#');
    } else {
      const key = part === target && chosenKey ? chosenKey : 'other';
      const opt =
        part.options.find((o) => o.key === key) ??
        part.options.find((o) => o.key === 'other') ??
        part.options[part.options.length - 1];
      if (opt) render(opt.value, target, chosenKey, part.name, out);
    }
  }
}

export function renderMessage(input: string): RenderedMessage {
  if (!input) return { lines: [{ key: null, nodes: [{ chip: false, value: '' }] }], hasPlural: false };

  let ast: Ast;
  try {
    ast = parse(input);
  } catch {
    return { lines: [{ key: null, nodes: [{ chip: false, value: input }] }], hasPlural: false };
  }

  const target = firstPlural(ast);
  if (!target) {
    const nodes: InlineNode[] = [];
    render(ast, null, null, null, nodes);
    return { lines: [{ key: null, nodes }], hasPlural: false };
  }

  const lines: MessageLine[] = target.options.map((opt) => {
    const nodes: InlineNode[] = [];
    render(ast, target, opt.key, null, nodes);
    return { key: opt.key, nodes };
  });
  return { lines, hasPlural: true };
}
