import { NextResponse } from "next/server";
import { getMerchantCenterAccessToken } from "@/lib/merchant-center/auth";

export async function GET(request: Request) {
  const secret = request.headers.get("x-debug-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accountId = process.env.GOOGLE_MERCHANT_CENTER_ACCOUNT_ID;
  const token = await getMerchantCenterAccessToken();
  if (!token) return NextResponse.json({ error: "no token", accountId });

  const [accountRes, statusRes] = await Promise.all([
    fetch(`https://shoppingcontent.googleapis.com/content/v2.1/${accountId}/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`https://shoppingcontent.googleapis.com/content/v2.1/${accountId}/accountstatus/${accountId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const account = await accountRes.json();
  const status = await statusRes.json();

  return NextResponse.json({ accountId, accountHttpStatus: accountRes.status, account, statusHttpStatus: statusRes.status, status });
}
