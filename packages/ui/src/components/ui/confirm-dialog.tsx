"use client";

import * as React from "react";
import { AlertTriangle, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@subboost/ui/components/ui/dialog";

export type ConfirmDialogVariant = "default" | "warning" | "destructive";

export type ConfirmDialogOptions = {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
};

type ConfirmDialogRequest = Required<Pick<ConfirmDialogOptions, "variant">> &
  Omit<ConfirmDialogOptions, "variant"> & {
    id: string;
    resolve: (result: boolean) => void;
  };

type State = {
  active: ConfirmDialogRequest | null;
};

let idCount = 0;
function genId() {
  idCount = (idCount + 1) % Number.MAX_SAFE_INTEGER;
  return idCount.toString();
}

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { active: null };
let activeRequest: ConfirmDialogRequest | null = null;
const queue: ConfirmDialogRequest[] = [];

function emit() {
  listeners.forEach((listener) => listener(memoryState));
}

function setActive(next: ConfirmDialogRequest | null) {
  memoryState = { active: next };
  emit();
}

function openNext() {
  if (activeRequest) return;
  const next = queue.shift() ?? null;
  activeRequest = next;
  setActive(next);
}

function closeActive(result: boolean) {
  if (!activeRequest) return;
  const current = activeRequest;
  activeRequest = null;
  setActive(null);
  current.resolve(result);
  openNext();
}

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const request: ConfirmDialogRequest = {
      id: genId(),
      title: options.title,
      description: options.description,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      variant: options.variant ?? "default",
      resolve,
    };
    queue.push(request);
    openNext();
  });
}

function useConfirmDialog() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    active: state.active,
    confirm: () => closeActive(true),
    cancel: () => closeActive(false),
  };
}

function getVariantIcon(variant: ConfirmDialogVariant) {
  switch (variant) {
    case "destructive":
      return <XCircle className="h-5 w-5 text-red-400" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    default:
      return <HelpCircle className="h-5 w-5 text-white/70" />;
  }
}

export function ConfirmDialogHost() {
  const { active, confirm, cancel } = useConfirmDialog();

  const title = active?.title;
  const description = active?.description;
  const variant = active?.variant ?? "default";
  const confirmText = active?.confirmText ?? "确认";
  const cancelText = active?.cancelText ?? "取消";

  return (
    <Dialog
      open={Boolean(active)}
      onOpenChange={(open) => {
        if (!open && active) cancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getVariantIcon(variant)}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="whitespace-pre-wrap">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="secondary" onClick={cancel}>
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={confirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
