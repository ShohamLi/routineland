// /Users/shoham/Desktop/routine/src/app/goals/[timeframe]/page.tsx

import GoalsClient from "./ui/GoalsClient";
import { Timeframe } from "@/lib/types";

const TIMEFRAMES: Timeframe[] = ["daily", "weekly", "monthly", "yearly"];

export function generateStaticParams() {
  return TIMEFRAMES.map((timeframe) => ({ timeframe }));
}

export const dynamicParams = false;

// ✅ Next לפעמים נותן params כ-Promise, אז מפרקים עם await
export default async function Page({
  params,
}: {
  params: Promise<{ timeframe: Timeframe }> | { timeframe: Timeframe };
}) {
  const resolved = await Promise.resolve(params);
  return <GoalsClient timeframe={resolved.timeframe} />;
}
