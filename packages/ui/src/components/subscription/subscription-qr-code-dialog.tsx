"use client";

import { QrCode } from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@subboost/ui/components/ui/dialog";
import { SubscriptionQrCode } from "./subscription-qr-code";

export function SubscriptionQrCodeDialog({
  subscriptionUrl,
  subscriptionName,
}: {
  subscriptionUrl: string;
  subscriptionName: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label={`显示${subscriptionName}的订阅二维码`}
          disabled={!subscriptionUrl}
        >
          <QrCode className="h-4 w-4" />
          二维码
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%_-_2rem)] border-[var(--gray-6)] bg-[var(--gray-2)] text-[var(--gray-12)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="break-words text-[var(--gray-12)]">{subscriptionName}</DialogTitle>
          <DialogDescription className="text-[var(--gray-11)]">使用其他设备的客户端扫码导入</DialogDescription>
        </DialogHeader>
        <SubscriptionQrCode subscriptionUrl={subscriptionUrl} />
      </DialogContent>
    </Dialog>
  );
}
