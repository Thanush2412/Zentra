import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const resolvedParams = await params;
    const requestId = resolvedParams.id;

    if (!requestId) {
      return NextResponse.json({ success: false, message: "Missing request ID" }, { status: 400 });
    }

    const req = await db.get("SELECT * FROM handover_requests WHERE id = ?", requestId);
    
    if (!req) {
      return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    }

    if (req.status !== "pending") {
      return NextResponse.json({ success: false, message: "Only pending requests can be cancelled" }, { status: 400 });
    }

    await db.run("DELETE FROM handover_requests WHERE id = ?", requestId);

    return NextResponse.json({ success: true, message: "Request cancelled successfully" });
  } catch (error: any) {
    console.error("Failed to delete request:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete request", error: error.message },
      { status: 500 }
    );
  }
}
