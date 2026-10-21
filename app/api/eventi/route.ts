import { NextResponse } from "next/server";
import { INITIAL_DATA } from "../../../lib/initialData";

export type { TimelineRow, TimelineEvent, TimelineData } from "../../../lib/initialData";

// GET /api/eventi - Endpoint API servito dal backend Node.js integrato in Next.js
export async function GET() {
  return NextResponse.json(INITIAL_DATA);
}
