"use client";

import {
  Badge as CossBadge,
  badgeVariants,
  type BadgeProps,
} from "@subboost/ui/components/coss/badge";

export type { BadgeProps };

export function Badge(props: BadgeProps) {
  return <CossBadge {...props} />;
}

export { badgeVariants };
