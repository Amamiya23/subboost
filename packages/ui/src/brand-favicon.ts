import { SUBBOOST_FAVICON_ICO_PATH } from "@subboost/ui/brand";

export function createSubBoostFaviconRedirect(): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: SUBBOOST_FAVICON_ICO_PATH,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
