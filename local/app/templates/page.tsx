"use client";

import {
  TemplateLibrarySurface,
  type TemplateLibraryAdapter,
} from "@subboost/ui/templates/template-library-surface";
import { readJsonResponse } from "@subboost/ui/product/client-response";
import type { TabValue, Template } from "@subboost/ui/templates/types";

type TemplateListResponse = {
  templates?: Template[];
  error?: string;
};

type TemplateDetailResponse = {
  template?: {
    name?: string;
    description?: string;
    kind?: string;
    config?: unknown;
  };
  error?: string;
};

const localTemplateAdapter: TemplateLibraryAdapter = {
  enabledTabs: { default: true, catalog: false, my: true },
  allowUpload: true,
  allowEngagement: false,
  allowDelete: true,
  allowPublicTemplates: false,
  uploadSearchParam: true,
  configuratorHref: "/builder",
  loadTemplates: async (tab: TabValue) => {
    const data = await readJsonResponse<TemplateListResponse>(
      await fetch(`/api/templates?type=${encodeURIComponent(tab)}`, { cache: "no-store" })
    );
    return Array.isArray(data.templates) ? data.templates : [];
  },
  loadTemplateDetail: async (id: string) => {
    const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (response.status === 404) return null;
    const data = await readJsonResponse<TemplateDetailResponse>(response);
    return data.template ?? null;
  },
  uploadTemplate: async (payload) => {
    await readJsonResponse(
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
  },
  deleteTemplate: async (id: string) => {
    await readJsonResponse(await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
  },
  updateTemplate: async (id, payload) => {
    await readJsonResponse(await fetch(`/api/templates/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
  },
  resetTemplate: async (id) => {
    await readJsonResponse(await fetch(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" }));
  },
};

export default function TemplatesPage() {
  return <TemplateLibrarySurface adapter={localTemplateAdapter} />;
}
