/**
 * LLM response extraction and sanitization.
 *
 * Handles extracting translated text from OpenAI, Anthropic, and LM Studio
 * API responses, plus stripping preamble/format-injection artifacts that
 * small models commonly emit.
 */

// Tags stripped from LLM output before preamble removal.
const REASONING_TAGS = ["thinking", "think", "tiz"];
// Liquid and other local-model templates expose control tokens in this form.
const CONTROL_TOKEN_PATTERN = /<\|[^<>|\r\n]+\|>/g;
const ASSISTANT_HEADER_PATTERN = /<\|im_start\|>[ \t]*assistant\b[ \t]*(?:\r?\n)?/gi;

// Common conversational preambles small models emit before the actual translation.
const PREAMBLE_PATTERNS: Array<[RegExp, string]> = [
  [/^[\s\S]*?(Sure,? I can help[^\n]*\n+)/i, ""],
  [/^[\s\S]*?(Okay,? I understand[^\n]*\n+)/i, ""],
  [/^[\s\S]*?(Here is (a |the )?(translated |Spanish )?[^\n]*:\s*\n+)/i, ""],
  [/^[\s\S]*?(Here's (a |the )?(translated |Spanish )?[^\n]*:\s*\n+)/i, ""],
  [/^[\s\S]*?(Below is (a |the )?[^\n]*:\s*\n+)/i, ""],
  [/^[\s\S]*?(Let me (help|translate|provide|begin)[^\n]*\n+)/i, ""],
  [/^[\s\S]*?(Let's begin[^\n]*\n+)/i, ""],
  [/^\s*<<<\s*\n/m, ""],
  [/\n\s*>>>\s*$/m, ""],
  // Spanish conversational preambles (weak models)
  [/^\s*¡?Bienvenido!?[ \t]*\r?\n+/i, ""],
  [/^\s*Entiendo\.?\s*Estoy listo[^\n]*\n+/i, ""],
  [/^\s*Claro,?\s*(puedo|te puedo)[^\n]*\n+/i, ""],
];

// Chat template format markers that can be abused for prompt injection.
const FORMAT_INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/<\|im_start\|>\s*(system|assistant|user)\b[^<]*<\|im_end\|>/gi, ""],
  [ASSISTANT_HEADER_PATTERN, ""],
  [/<\|im_start\|>/gi, ""],
  [/<\|im_end\|>/gi, ""],
  [/\[INST\][\s\S]*?\[\/INST\]/gi, ""],
  [/\[INST\]/gi, ""],
  [/\[\/INST\]/gi, ""],
  [/###\s*Instruction:/gi, ""],
  [/###\s*Response:/gi, ""],
  [/###\s*System:/gi, ""],
  [/<system>[\s\S]*?<\/system>/gi, ""],
  [/<system>/gi, ""],
  [/<\/system>/gi, ""],
  [/<\|assistant\|>/gi, ""],
  [/<\|user\|>/gi, ""],
  [/<\|system\|>/gi, ""],
  [/^\s*(SYSTEM|ASSISTANT|USER|INSTRUCTION)\s*:\s*/gm, ""],
  [CONTROL_TOKEN_PATTERN, ""],
];

const SANITIZE_MAP: Array<[RegExp, string]> = [
  [/—/g, "-"],
  [/–/g, "-"],
  [/‘|’/g, "'"],
  [/“|”/g, '"'],
  [/€/g, "EUR"],
  [/£/g, "GBP"],
  [/¥/g, "JPY"],
  [/…/g, "..."],
];

/**
 * Extract text from an OpenAI-format chat completion response.
 * Handles both legacy `choices[0].text` and modern `choices[0].message.content`
 * formats, including content arrays.
 */
export function extractChatCompletionText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as {
    message?: { content?: unknown; refusal?: unknown }; text?: unknown;
  } | undefined;
  if (first?.message?.refusal) return null;
  const content = first?.message?.content ?? first?.text;
  // Modern OpenAI responses may return content as an array of parts
  if (Array.isArray(content)) {
    if (content.some((part) => part && typeof part === "object" && part.type === "refusal")) {
      return null;
    }
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const typed = part as { type?: unknown; text?: unknown };
        return extractTextPart(typed);
      })
      .join("")
      .trim();
    return text.length > 0 ? stripReasoningTags(text) : null;
  }
  if (typeof content !== "string" || content.trim().length === 0) return null;
  return stripReasoningTags(content.trim());
}

function extractTextPart(part: { type?: unknown; text?: unknown }): string {
  // Retain untyped gateway parts, but never treat reasoning/tool metadata as text.
  if (part.type !== undefined && part.type !== "text" && part.type !== "output_text") return "";
  return typeof part.text === "string" ? part.text : "";
}

function stripReasoningTags(text: string): string {
  // Remove the header first: deleting adjacent reasoning can join the role
  // name to the answer, hiding the boundary needed to recognize the header.
  return stripTaggedBlocks(text.replace(ASSISTANT_HEADER_PATTERN, ""), REASONING_TAGS).trim();
}

function stripTaggedBlocks(text: string, tagNames: string[]): string {
  let result = text;
  for (const tagName of tagNames) {
    result = stripTagBlock(result, tagName);
  }
  return result;
}

function stripTagBlock(text: string, tagName: string): string {
  // Match against the original text so Unicode case folding cannot shift offsets.
  const pattern = new RegExp(`<(/?)${tagName}(?=[\\s/>]|$)[^>]*(?:>|$)`, "gi");
  let result = "";
  let cursor = 0;
  let depth = 0;

  for (const match of text.matchAll(pattern)) {
    if (match[1] === "/") {
      if (depth > 0) depth--;
      // An orphan close terminates reasoning prefilled by the chat template.
      if (depth === 0) cursor = match.index + match[0].length;
    } else {
      if (depth === 0) result += text.slice(cursor, match.index);
      depth++;
    }
  }

  // Unclosed outer blocks remain private even after an inner block closes.
  return depth === 0 ? result + text.slice(cursor) : result;
}

/**
 * Extract text from an Anthropic-format messages response.
 */
export function extractAnthropicText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  const text = content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      return extractTextPart(part as { type?: unknown; text?: unknown });
    })
    .join("")
    .trim();

  return text.length > 0 ? text : null;
}

/**
 * Extract text from an LM Studio native response.
 */
export function extractLMStudioText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  const text = output
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const typed = item as { type?: unknown; content?: unknown };
      return typed.type === "message" && typeof typed.content === "string"
        ? typed.content
        : "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : null;
}

/**
 * Dispatch to the correct extractor based on the API format string.
 * Returns the extracted text or an empty string if nothing was found.
 */
export function extractResponseText(format: string, data: unknown): string | undefined {
  switch (format) {
    case "anthropic":
      return extractAnthropicText(data) ?? undefined;
    case "lmstudio":
      return extractLMStudioText(data) ?? undefined;
    default:
      return extractChatCompletionText(data) ?? undefined;
  }
}

/**
 * Remove common preamble patterns that small models emit before the
 * actual translation output.
 */
export function stripPreamble(text: string, sourceText?: string): string {
  // Strip reasoning/thinking tags first (qwen3, etc.)
  let result = stripReasoningTags(text).replace(CONTROL_TOKEN_PATTERN, "");
  for (const [pattern, replacement] of PREAMBLE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  result = result.trim();
  // Only unwrap model-added fences when the source has no fenced blocks.
  // Without source context, Markdown/code fences are legitimate content.
  if (sourceText !== undefined && !/^[ \t]*(?:`{3,}|~{3,})/m.test(sourceText)) {
    const fence = result.match(/^(`{3,}|~{3,})(?:json|text|plaintext|markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/i);
    if (fence) result = fence[2].trim();
  }
  return result;
}

/**
 * Remove chat-template format injection artifacts (ChatML, Llama, Alpaca, etc.).
 */
export function stripFormatInjection(text: string): string {
  let result = text;
  for (const [pattern, replacement] of FORMAT_INJECTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Sanitize text for inclusion in LLM prompts.
 * Strips format injection and normalises Unicode punctuation.
 */
export function sanitizeForPrompt(text: string): string {
  let result = stripFormatInjection(text);
  for (const [pattern, replacement] of SANITIZE_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
