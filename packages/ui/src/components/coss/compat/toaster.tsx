"use client";

import * as React from "react";
import {
  AnchoredToastProvider,
  ToastProvider as CossToastProvider,
  toastManager,
} from "@subboost/ui/components/coss/toast";

export type ToastVariant = "default" | "info" | "success" | "warning" | "destructive";

type ToastActionProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  altText?: string;
};

export const ToastAction = React.forwardRef<HTMLButtonElement, ToastActionProps>(
  ({ altText: _altText, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={className}
      {...props}
    />
  ),
);
ToastAction.displayName = "ToastAction";

export type ToastOptions = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement<ToastActionProps>;
  variant?: ToastVariant;
  duration?: number;
  id?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ToastRecord = ToastOptions & { id: string };

const memoryToasts = new Map<string, ToastRecord>();
let toastSequence = 0;

function nextToastId(): string {
  toastSequence = (toastSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${toastSequence}`;
}

function toCossType(variant: ToastVariant | undefined): string | undefined {
  return variant === "destructive" ? "error" : variant === "default" ? undefined : variant;
}

function toCossOptions(record: Omit<ToastRecord, "id" | "open">, toastId: string) {
  const action = record.action;
  return {
    title: record.title,
    description: record.description,
    type: toCossType(record.variant),
    timeout: record.duration,
    actionProps: action
      ? {
          children: action.props.children,
          onClick: action.props.onClick,
          disabled: action.props.disabled,
          'aria-label': action.props.altText,
        }
      : undefined,
    onClose: () => {
      if (record.onOpenChange) record.onOpenChange(false);
    },
    onRemove: () => {
      memoryToasts.delete(toastId);
    },
  };
}

export function toast(options: ToastOptions) {
  const id = options.id ?? nextToastId();
  const record: ToastRecord = { ...options, id };
  memoryToasts.set(id, record);
  toastManager.add({ id, ...toCossOptions(record, id) });

  return {
    id,
    dismiss() {
      memoryToasts.delete(id);
      toastManager.close(id);
      options.onOpenChange?.(false);
    },
    update(next: Partial<ToastOptions>) {
      const previous = memoryToasts.get(id) ?? record;
      const updated = { ...previous, ...next, id };
      memoryToasts.set(id, updated);
      toastManager.update(id, toCossOptions(updated, id));
    },
  };
}

export function useToast() {
  return {
    toast,
    toasts: Array.from(memoryToasts.values()),
    dismiss(id?: string) {
      if (id) {
        memoryToasts.delete(id);
        toastManager.close(id);
      } else {
        for (const toastId of memoryToasts.keys()) toastManager.close(toastId);
        memoryToasts.clear();
      }
    },
  };
}

export function Toaster() {
  return (
    <CossToastProvider position="bottom-right">
      <AnchoredToastProvider>{null}</AnchoredToastProvider>
    </CossToastProvider>
  );
}

export { CossToastProvider as ToastProvider };
