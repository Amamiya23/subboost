"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import { Textarea } from "@subboost/ui/components/ui/textarea";
import { cn } from "@subboost/ui/lib/utils";
import { YamlHighlight } from "@subboost/ui/product/preview/diff-highlight";

interface YamlPreviewEditorProps {
  content: string;
  onContentChange: (yaml: string) => void;
  className?: string;
}

/**
 * 可编辑 YAML 预览组件
 * 默认展示带语法高亮的只读视图，点击编辑按钮切换为草稿态 textarea，
 * 保存后通过 onContentChange 回写到 store；取消则丢弃草稿。
 */
export function YamlPreviewEditor({
  content,
  onContentChange,
  className,
}: YamlPreviewEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(content);

  // 外部（如重新生成配置）更新 content 时，若不在编辑态则同步草稿。
  React.useEffect(() => {
    if (!isEditing) {
      setDraft(content);
    }
  }, [content, isEditing]);

  const startEdit = React.useCallback(() => {
    setDraft(content);
    setIsEditing(true);
  }, [content]);

  const handleSave = React.useCallback(() => {
    onContentChange(draft);
    setIsEditing(false);
  }, [draft, onContentChange]);

  const handleCancel = React.useCallback(() => {
    setDraft(content);
    setIsEditing(false);
  }, [content]);

  if (isEditing) {
    const dirty = draft !== content;
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-xs text-white focus-visible:ring-0"
        />
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-white/5 px-3 py-2">
          <span className="mr-auto text-[11px] text-white/50">
            {dirty ? "有未保存的修改" : "编辑模式：保存后将作为下载与订阅内容"}
          </span>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="h-3.5 w-3.5" />
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty}>
            <Check className="h-3.5 w-3.5" />
            保存
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full", className)}>
      <YamlHighlight content={content} className="h-full" />
      <button
        type="button"
        onClick={startEdit}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
      >
        <Pencil className="h-3 w-3" />
        编辑
      </button>
    </div>
  );
}
