import { redirect } from "next/navigation";
import DashboardPage from "./dashboard/page";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  // Preserve builder links issued when the workbench lived at the root.
  if (values.editSubscriptionId || values.copySubscriptionId || values.newSubscription) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
        params.append(key, item);
      }
    }
    redirect(`/builder?${params}`);
  }
  return <DashboardPage />;
}
