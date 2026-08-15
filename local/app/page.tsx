"use client";

import * as React from "react";
import { HomeHero } from "@subboost/ui/product/home/home-hero";

/**
 * 落地页：巨型 Hero + 进入工作台 CTA。
 * 兼容旧深链：/?editSubscriptionId=x 自动跳转到 /builder。
 */
export default function Page() {
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editSubscriptionId = params.get("editSubscriptionId");
    if (editSubscriptionId) {
      window.location.replace(`/builder?editSubscriptionId=${encodeURIComponent(editSubscriptionId)}`);
    }
  }, []);

  return <HomeHero />;
}
