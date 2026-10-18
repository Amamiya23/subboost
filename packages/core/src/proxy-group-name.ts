export type EmojiSplitResult = {
  emoji: string;
  label: string;
  hasEmojiPrefix: boolean;
};

// Match a complete leading emoji, including flags, keycaps and joined sequences.
const LEADING_EMOJI = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/u;

export function stripProxyGroupEmojiPrefix(name: string): string {
  let label = name.trim();
  let match: RegExpMatchArray | null;
  while ((match = label.match(LEADING_EMOJI))) {
    label = label.slice(match[0].length).trimStart();
  }
  // An emoji-only group still needs a valid, nonempty policy name.
  return label || name.trim();
}

export function splitLeadingEmoji(raw: string): EmojiSplitResult {
  const name = typeof raw === "string" ? raw.trim() : "";
  const separatorIndex = (() => {
    for (let i = 0; i < name.length; i += 1) {
      if (name[i].trim() === "") return i;
    }
    return -1;
  })();
  if (separatorIndex <= 0) return { emoji: "", label: name, hasEmojiPrefix: false };

  const first = name.slice(0, separatorIndex);
  const rest = name.slice(separatorIndex).trim();
  if (!rest) return { emoji: "", label: name, hasEmojiPrefix: false };

  // 若首段包含字母/数字/中文，大概率不是“emoji 前缀”
  if (/[A-Za-z0-9\u4e00-\u9fff]/.test(first)) {
    return { emoji: "", label: name, hasEmojiPrefix: false };
  }

  return { emoji: first, label: rest, hasEmojiPrefix: true };
}

export function resolveProxyGroupModuleName(
  module: { emoji: string; name: string },
  override?: string
): string {
  const raw = typeof override === "string" ? override.trim() : "";
  if (!raw) return module.name;

  const parsed = splitLeadingEmoji(raw);
  if (parsed.hasEmojiPrefix) return raw;

  return `${module.emoji} ${raw}`.trim();
}

export function normalizeGroupNameWithDefaultEmoji(
  raw: string,
  defaultEmoji: string
): { full: string; emoji: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  const fallbackEmoji = typeof defaultEmoji === "string" && defaultEmoji.trim() ? defaultEmoji.trim() : "🧩";
  if (!name) return { full: "", emoji: fallbackEmoji };

  const parsed = splitLeadingEmoji(name);
  if (parsed.hasEmojiPrefix) return { full: name, emoji: parsed.emoji || fallbackEmoji };

  return { full: `${fallbackEmoji} ${name}`.trim(), emoji: fallbackEmoji };
}

