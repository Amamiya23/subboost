"use client";

import { gray } from "@radix-ui/colors";
import { QRCodeSVG } from "qrcode.react";

export function SubscriptionQrCode({ subscriptionUrl }: { subscriptionUrl: string }) {
  if (!subscriptionUrl) return null;

  return (
    <div className="flex justify-center">
      <QRCodeSVG
        value={subscriptionUrl}
        title="订阅链接二维码"
        role="img"
        size={256}
        level="M"
        marginSize={4}
        bgColor={gray.gray1}
        fgColor={gray.gray12}
        className="h-auto max-w-full rounded-lg"
      />
    </div>
  );
}
