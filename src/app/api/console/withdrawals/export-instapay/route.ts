import { format } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { buildInstapayExportBuffer } from "@/lib/console/instapay-export";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const snap = await auth.db
      .collection("withdrawalRequests")
      .where("status", "==", "pending")
      .get();

    const withdrawals = snap.docs
      .map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt as
          | FirebaseFirestore.Timestamp
          | undefined;
        return {
          id: doc.id,
          userEmail: (data.userEmail as string) ?? "",
          amount: (data.amount as number) ?? 0,
          netPayout: data.netPayout as number | undefined,
          createdAtMs: createdAt?.toMillis?.() ?? 0,
          accountSnapshot: data.accountSnapshot as {
            accountType: string;
            accountNumber: string;
            accountName: string;
            bankName?: string;
          },
        };
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map(({ createdAtMs: _createdAtMs, ...row }) => row);

    const buffer = await buildInstapayExportBuffer(withdrawals);
    const filename = `instapay-pending-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to export InstaPay file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
