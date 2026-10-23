"use client";

import { HomeSurface, type HomeSurfaceAdapter } from "@subboost/ui/product/home/home-surface";
import { readJsonResponse, readSourceImportResponse } from "@subboost/ui/product/client-response";
import { createRulesProductApi } from "@subboost/ui/product/api-adapter";
import type { QuickTemplateDetail, QuickTemplateSummary } from "@subboost/ui/product/api-adapter";
import { LOCAL_AUTO_UPDATE_POLICY } from "@local/lib/auto-update-policy";

const localHomeAdapter: HomeSurfaceAdapter = {
  loginHref: "/login",
  templateUploadHref: "/templates?upload=1",
  productApi: {
    sourceImport: {
      importSource: async (request) => {
        const data = await readSourceImportResponse(
          await fetch("/api/source-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          })
        );
        return {
          content: typeof data.content === "string" ? data.content : "",
          headers: data.headers || {},
          parseResult: data.parseResult,
        };
      },
    },
    templates: {
      catalogEnabled: false,
      builtinEngagementEnabled: false,
      loadBuiltinTemplates: async () => {
        const data = await readJsonResponse<{ templates?: QuickTemplateSummary[] }>(
          await fetch("/api/templates?type=default", { cache: "no-store" })
        );
        return data.templates ?? [];
      },
      loadTemplateDetail: async (id) => {
        const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (response.status === 404) return null;
        const data = await readJsonResponse<{ template?: QuickTemplateDetail }>(response);
        return data.template ?? null;
      },
    },
    rules: createRulesProductApi(),
  },
  loadSubscription: (id) => fetch(`/api/subscriptions/${encodeURIComponent(id)}`, { cache: "no-store" }),
  subscription: {
    loginHref: "/login",
    autoUpdateIntervalPolicy: LOCAL_AUTO_UPDATE_POLICY,
    saveSubscription: ({ isEditing, subscriptionId, payload }) => {
      const endpoint =
        isEditing && subscriptionId
          ? `/api/subscriptions/${encodeURIComponent(subscriptionId)}`
          : "/api/subscriptions";
      return fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
  },
};

export default function LocalBuilder() {
  return <HomeSurface adapter={localHomeAdapter} />;
}
