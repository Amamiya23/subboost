"use client";

import { Globe, Loader2, Lock, Upload } from "lucide-react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@subboost/ui/components/coss/compat/dialog";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { cn } from "@subboost/ui/lib/utils";

type UploadMode = "config" | "yaml";

interface TemplateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIsAdmin: boolean;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  isPublic: boolean;
  onPublicChange: (value: boolean) => void;
  asDefault: boolean;
  onDefaultChange: (value: boolean) => void;
  isUploading: boolean;
  mode: UploadMode;
  onModeChange: (value: UploadMode) => void;
  yamlContent: string;
  onYamlContentChange: (value: string) => void;
  onUpload: () => void;
  showVisibilityControls?: boolean;
}

export function TemplateUploadDialog({
  open,
  onOpenChange,
  userIsAdmin,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  isPublic,
  onPublicChange,
  asDefault,
  onDefaultChange,
  isUploading,
  mode,
  onModeChange,
  yamlContent,
  onYamlContentChange,
  onUpload,
  showVisibilityControls = true,
}: TemplateUploadDialogProps) {
  const visibilityLabel = asDefault ? "默认模板" : isPublic ? "公开模板" : "私有模板";
  const visibilityDescription = asDefault
    ? "将展示在默认模板中"
    : isPublic
      ? "其他用户可以搜索和使用此模板"
      : "仅自己可见和使用";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary-500" />
            上传模板
          </DialogTitle>
          <DialogDescription>
            推荐使用“配置模板”：仅保存生成策略（不包含节点），可被一键应用到配置器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">模板名称 *</label>
            <Input
              placeholder="例如：流媒体优化配置"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">描述（可选）</label>
            <Textarea
              placeholder="简要描述模板的特点和适用场景..."
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">模板类型</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === "config" ? "default" : "outline"}
                size="sm"
                onClick={() => onModeChange("config")}
              >
                配置模板
              </Button>
              <Button
                type="button"
                variant={mode === "yaml" ? "default" : "outline"}
                size="sm"
                onClick={() => onModeChange("yaml")}
                disabled={true}
              >
                YAML（开发中）
              </Button>
            </div>
            {mode === "config" ? (
              <p className="text-xs text-muted-foreground">
                将保存你当前的配置器设置（模板/分组/规则/DNS/自定义分流/中转等），不包含节点，可直接“使用”应用到配置器。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">YAML 模板上传开发中。</p>
            )}
          </div>

          {userIsAdmin && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div className="min-w-0">
                <div className="text-sm font-medium">作为默认模板</div>
                <div className="text-xs text-muted-foreground">
                  开启后将发布到“默认模板”（公开）
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !asDefault;
                  onDefaultChange(next);
                  if (next) {
                    onPublicChange(true);
                    onModeChange("config");
                    onYamlContentChange("");
                  }
                }}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                  asDefault ? "bg-primary-500" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-muted shadow transition-all duration-200",
                    asDefault && "translate-x-5"
                  )}
                />
              </button>
            </div>
          )}

          {mode === "yaml" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">配置内容（YAML）*</label>
              <Textarea
                placeholder="粘贴您的 YAML 配置内容..."
                value={yamlContent}
                onChange={(event) => onYamlContentChange(event.target.value)}
                className="min-h-[150px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                注意：系统会自动移除实际节点信息，只保留配置结构
              </p>
            </div>
          )}

          {showVisibilityControls && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div className="flex items-center gap-2">
                {asDefault || isPublic ? (
                  <Globe className="h-4 w-4 text-success-foreground" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <div className="text-sm font-medium">{visibilityLabel}</div>
                  <div className="text-xs text-muted-foreground">{visibilityDescription}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (asDefault) return;
                  onPublicChange(!isPublic);
                }}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                  asDefault
                    ? "bg-success/10 opacity-60 cursor-not-allowed"
                    : isPublic
                      ? "bg-success/10"
                      : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-muted shadow transition-all duration-200",
                    (asDefault || isPublic) && "translate-x-5"
                  )}
                />
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={onUpload}
            disabled={!name.trim() || isUploading || (mode === "yaml" && !yamlContent.trim())}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            上传
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
