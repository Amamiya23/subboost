"use client";

import { QrCode } from "lucide-react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@subboost/ui/components/coss/compat/dialog";
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
          className="h-9 gap-1.5 text-xs sm:h-8 sm:text-sm"
          aria-label={`显示${subscriptionName}的订阅二维码`}
          disabled={!subscriptionUrl}
        >
          <QrCode className="h-4 w-4" />
          二维码
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="break-words">{subscriptionName}</DialogTitle>
          <DialogDescription>使用其他设备的客户端扫码导入</DialogDescription>
        </DialogHeader>
        <SubscriptionQrCode subscriptionUrl={subscriptionUrl} />
      </DialogContent>
    </Dialog>
  );
}
