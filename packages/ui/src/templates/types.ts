export interface Template {
  id: string;
  name: string;
  description: string;
  downloads: number;
  engagementCount: number;
  createdAt: string;
  tags: string[];
  isEngaged?: boolean;
  isOfficial?: boolean;
  isPublic?: boolean;
  isOwner?: boolean;
  isModified?: boolean;
  proxyGroupCount?: number | null;
  ruleCount?: number | null;
}

export type TabValue = "default" | "catalog" | "my";
