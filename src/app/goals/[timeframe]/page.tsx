// src/app/goals/[timeframe]/page.tsx

import GoalsClient from "./ui/GoalsClient";
import { Timeframe } from "@/lib/types";

const TIMEFRAMES: Timeframe[] = ["daily", "weekly", "monthly", "yearly"];

export function generateStaticParams() {
  return TIMEFRAMES.map((timeframe) => ({ timeframe }));
}

export const dynamicParams = false;

export default async function Page({ params }: any) {
  const resolved = await Promise.resolve(params);
  return <GoalsClient timeframe={resolved.timeframe as Timeframe} />;
}
