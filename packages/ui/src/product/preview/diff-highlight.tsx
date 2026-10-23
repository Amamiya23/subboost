"use client";

import * as React from "react";
import { cn } from "@subboost/ui/lib/utils";

interface DiffLine {
  type: "add" | "remove" | "unchanged";
  content: string;
  lineNumber: number;
}

interface DiffHighlightProps {
  oldText: string;
  newText: string;
  className?: string;
}

/**
 * 变更高亮组件
 * 对比两个文本并高亮显示差异
 */
export function DiffHighlight({ oldText, newText, className }: DiffHighlightProps) {
  const diffLines = React.useMemo(() => {
    return computeDiff(oldText, newText);
  }, [oldText, newText]);

  const stats = React.useMemo(() => {
    const added = diffLines.filter(l => l.type === "add").length;
    const removed = diffLines.filter(l => l.type === "remove").length;
    return { added, removed };
  }, [diffLines]);

  if (!oldText && !newText) {
    return null;
  }

  return (
    <div className={cn("rounded-lg overflow-hidden", className)}>
      {/* 统计信息 */}
      {(stats.added > 0 || stats.removed > 0) && (
        <div className="flex items-center gap-3 px-3 py-2 bg-muted border-b border-border text-xs">
          <span className="text-muted-foreground">变更统计:</span>
          {stats.added > 0 && (
            <span className="text-success-foreground">+{stats.added} 行</span>
          )}
          {stats.removed > 0 && (
            <span className="text-destructive-foreground">-{stats.removed} 行</span>
          )}
        </div>
      )}

      {/* 差异内容 */}
      <div className="overflow-auto max-h-[500px]">
        <pre className="text-xs font-mono">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "flex",
                line.type === "add" && "bg-success/10",
                line.type === "remove" && "bg-destructive/10"
              )}
            >
              {/* 行号 */}
              <span className="w-10 px-2 py-0.5 text-right text-muted-foreground select-none border-r border-border flex-shrink-0">
                {line.lineNumber}
              </span>
              
              {/* 差异标记 */}
              <span className={cn(
                "w-6 px-1.5 py-0.5 text-center select-none flex-shrink-0",
                line.type === "add" && "text-success-foreground",
                line.type === "remove" && "text-destructive-foreground",
                line.type === "unchanged" && "text-muted-foreground"
              )}>
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </span>
              
              {/* 内容 */}
              <span className={cn(
                "flex-1 px-2 py-0.5 whitespace-pre",
                line.type === "add" && "text-success-foreground",
                line.type === "remove" && "text-destructive-foreground",
                line.type === "unchanged" && "text-dark-300"
              )}>
                {line.content || " "}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

/**
 * 简单的行级差异算法
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];
  
  // 使用 LCS (最长公共子序列) 简化版本
  const lcs = computeLCS(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let lineNumber = 1;
  
  for (const match of lcs) {
    // 添加删除的行
    while (oldIdx < match.oldIndex) {
      result.push({
        type: "remove",
        content: oldLines[oldIdx],
        lineNumber: lineNumber++,
      });
      oldIdx++;
    }
    
    // 添加新增的行
    while (newIdx < match.newIndex) {
      result.push({
        type: "add",
        content: newLines[newIdx],
        lineNumber: lineNumber++,
      });
      newIdx++;
    }
    
    // 添加未变更的行
    result.push({
      type: "unchanged",
      content: newLines[newIdx],
      lineNumber: lineNumber++,
    });
    
    oldIdx++;
    newIdx++;
  }
  
  // 添加剩余的删除行
  while (oldIdx < oldLines.length) {
    result.push({
      type: "remove",
      content: oldLines[oldIdx],
      lineNumber: lineNumber++,
    });
    oldIdx++;
  }
  
  // 添加剩余的新增行
  while (newIdx < newLines.length) {
    result.push({
      type: "add",
      content: newLines[newIdx],
      lineNumber: lineNumber++,
    });
    newIdx++;
  }
  
  return result;
}

interface LCSMatch {
  oldIndex: number;
  newIndex: number;
}

/**
 * 计算最长公共子序列
 */
function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length;
  const n = newLines.length;
  
  // 构建 LCS 表
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // 回溯找出匹配
  const matches: LCSMatch[] = [];
  let i = m;
  let j = n;
  
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return matches;
}

/**
 * YAML 语法高亮（简单版本）
 */
type YamlRenderMode = "highlight" | "plain";

const YAML_RENDER_LIMITS = {
  lineCount: 2500,
  charCount: 300000,
  longestLine: 4000,
} as const;

type YamlRenderStats = {
  lineCount: number;
  charCount: number;
  longestLine: number;
  shouldUsePlain: boolean;
};

function analyzeYamlRenderStats(content: string): YamlRenderStats {
  const charCount = content.length;
  if (!content) {
    return {
      lineCount: 0,
      charCount: 0,
      longestLine: 0,
      shouldUsePlain: false,
    };
  }

  let lineCount = 1;
  let longestLine = 0;
  let currentLineLength = 0;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content.charCodeAt(i);
    if (ch === 10) {
      if (currentLineLength > longestLine) longestLine = currentLineLength;
      currentLineLength = 0;
      lineCount += 1;
      continue;
    }
    if (ch !== 13) currentLineLength += 1;
  }

  if (currentLineLength > longestLine) longestLine = currentLineLength;

  const shouldUsePlain =
    lineCount > YAML_RENDER_LIMITS.lineCount ||
    charCount > YAML_RENDER_LIMITS.charCount ||
    longestLine > YAML_RENDER_LIMITS.longestLine;

  return { lineCount, charCount, longestLine, shouldUsePlain };
}

export function YamlHighlight({ content, className }: { content: string; className?: string }) {
  const [forceHighlight, setForceHighlight] = React.useState(false);

  const renderStats = React.useMemo(() => analyzeYamlRenderStats(content), [content]);

  React.useEffect(() => {
    setForceHighlight(false);
  }, [content]);

  const renderMode: YamlRenderMode =
    renderStats.shouldUsePlain && !forceHighlight ? "plain" : "highlight";

  const highlightedLines = React.useMemo(() => {
    if (renderMode !== "highlight") return [];
    return content.split("\n").map((line, idx) => ({
      number: idx + 1,
      html: highlightYamlLine(line),
    }));
  }, [content, renderMode]);

  return (
    <div className={cn("overflow-auto", className)}>
      {renderStats.shouldUsePlain && (
        <div className="mb-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>
              YAML 内容较大，已切换纯文本模式以避免卡顿
              {!forceHighlight &&
                `（${renderStats.lineCount} 行 / ${renderStats.charCount} 字符）`}
            </span>
            {forceHighlight ? (
              <button
                type="button"
                onClick={() => setForceHighlight(false)}
                className="rounded border border-warning/30 px-2 py-0.5 text-[10px] text-warning-foreground transition-colors hover:bg-warning/10"
              >
                恢复纯文本
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setForceHighlight(true)}
                className="rounded border border-warning/30 px-2 py-0.5 text-[10px] text-warning-foreground transition-colors hover:bg-warning/10"
              >
                强制语法高亮
              </button>
            )}
          </div>
        </div>
      )}

      {renderMode === "plain" ? (
        <pre className="px-3 py-2 text-xs font-mono whitespace-pre text-foreground">{content}</pre>
      ) : (
        <pre className="text-xs font-mono">
          {highlightedLines.map(({ number, html }) => (
            <div key={number} className="flex hover:bg-accent">
              <span className="w-10 px-2 py-0.5 text-right text-muted-foreground select-none border-r border-border flex-shrink-0">
                {number}
              </span>
              <span
                className="flex-1 px-3 py-0.5 whitespace-pre text-foreground"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

/**
 * 高亮单行 YAML
 */
function highlightYamlLine(line: string): string {
  // 注释
  if (line.trim().startsWith("#")) {
    return `<span class="text-muted-foreground">${escapeHtml(line)}</span>`;
  }

  // 空行
  if (!line.trim()) {
    return line;
  }

  // 数组项（必须在键值对之前检测，否则 `- {name: xxx}` 会被当作键值对）
  const arrayMatch = line.match(/^(\s*)(-)(\s+)(.*)$/);
  if (arrayMatch) {
    const [, indent, dash, space, value] = arrayMatch;
    const trimmedValue = value.trim();
    const highlightedValue = highlightYamlValue(trimmedValue);
    return `${escapeHtml(indent)}<span class="text-warning-foreground">${dash}</span>${escapeHtml(space)}${highlightedValue}`;
  }

  // 键值对
  const keyMatch = line.match(/^(\s*)([^:]+)(:)(.*)$/);
  if (keyMatch) {
    const [, indent, key, colon, value] = keyMatch;
    const highlightedValue = highlightYamlValue(value.trim());
    return `${escapeHtml(indent)}<span class="text-cyan-400">${escapeHtml(key)}</span><span class="text-foreground">${colon}</span> ${highlightedValue}`;
  }

  return escapeHtml(line);
}

/**
 * 高亮 YAML 值
 */
function highlightYamlValue(value: string): string {
  if (!value) return "";

  // 内联对象 {key: value, ...}
  if (value.startsWith("{") && value.endsWith("}")) {
    return highlightInlineObject(value);
  }

  // 内联数组 [item, ...]
  if (value.startsWith("[") && value.endsWith("]")) {
    return highlightInlineArray(value);
  }

  // 字符串（带引号）
  if (/^".*"$/.test(value)) {
    return `<span class="text-success-foreground">${escapeHtml(value)}</span>`;
  }

  // 数字
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return `<span class="text-orange-400">${escapeHtml(value)}</span>`;
  }

  // 布尔值
  if (/^(true|false)$/i.test(value)) {
    const color = value.toLowerCase() === "true" ? "text-success-foreground" : "text-destructive-foreground";
    return `<span class="${color}">${escapeHtml(value)}</span>`;
  }

  // null
  if (/^(null|~)$/i.test(value)) {
    return `<span class="text-destructive-foreground">${escapeHtml(value)}</span>`;
  }

  // 协议类型关键词
  if (/^(ss|ssr|vmess|vless|trojan|anytls|hysteria2|hy2|socks5|socks4|http|https|relay)$/.test(value)) {
    return `<span class="text-pink-400 font-medium">${escapeHtml(value)}</span>`;
  }

  // 特殊值关键词
  if (/^(auto|chrome|firefox|safari|edge|qq|random|tcp|ws|grpc|h2|quic)$/.test(value)) {
    return `<span class="text-info-foreground">${escapeHtml(value)}</span>`;
  }

  return `<span class="text-foreground">${escapeHtml(value)}</span>`;
}

/**
 * 高亮内联对象 {key: value, key2: value2}
 */
function highlightInlineObject(obj: string): string {
  const inner = obj.slice(1, -1);
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (inQuote && char === quoteChar && inner[i - 1] !== "\\") {
      inQuote = false;
      quoteChar = "";
      current += char;
    } else if (!inQuote && (char === "{" || char === "[")) {
      depth++;
      current += char;
    } else if (!inQuote && (char === "}" || char === "]")) {
      depth--;
      current += char;
    } else if (!inQuote && char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  const highlighted = parts.map((part) => {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) return highlightYamlValue(part);

    const key = part.slice(0, colonIdx).trim();
    const val = part.slice(colonIdx + 1).trim();

    let keyColor = "text-cyan-400";
    if (["name", "type", "server", "port"].includes(key)) {
      keyColor = "text-warning-foreground font-medium";
    } else if (["password", "uuid", "cipher"].includes(key)) {
      keyColor = "text-violet-400";
    } else if (["tls", "sni", "servername", "skip-cert-verify", "client-fingerprint"].includes(key)) {
      keyColor = "text-teal-400";
    } else if (key === "dialer-proxy") {
      keyColor = "text-destructive-foreground font-medium";
    }

    return `<span class="${keyColor}">${escapeHtml(key)}</span><span class="text-muted-foreground">:</span> ${highlightYamlValue(val)}`;
  });

  return `<span class="text-muted-foreground">{</span>${highlighted.join(`<span class="text-muted-foreground">,</span> `)}<span class="text-muted-foreground">}</span>`;
}

/**
 * 高亮内联数组 [item1, item2]
 */
function highlightInlineArray(arr: string): string {
  const inner = arr.slice(1, -1);
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (inQuote && char === quoteChar && inner[i - 1] !== "\\") {
      inQuote = false;
      quoteChar = "";
      current += char;
    } else if (!inQuote && (char === "{" || char === "[")) {
      depth++;
      current += char;
    } else if (!inQuote && (char === "}" || char === "]")) {
      depth--;
      current += char;
    } else if (!inQuote && char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  const highlighted = parts.map((part) => highlightYamlValue(part));
  return `<span class="text-muted-foreground">[</span>${highlighted.join(`<span class="text-muted-foreground">,</span> `)}<span class="text-muted-foreground">]</span>`;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
