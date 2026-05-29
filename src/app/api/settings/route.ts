import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { SystemSettings } from "@/models/SystemSettings";
import { requireRole } from "@/lib/auth-utils";
import { auth } from "../../../../auth";

// ─── GET /api/settings ────────────────────────────────────────────────────────
// All authenticated roles — read settings (needed for tax rate in order form)

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const settings = await SystemSettings.findOne({}).lean() ?? {
      businessName: "My Business",
      businessAddress: "",
      taxRate: 0,
      lowStockThreshold: 10,
    };
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/settings ────────────────────────────────────────────────────────
// Admin only — upsert settings

const settingsSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  businessAddress: z.string().max(500).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export async function PUT(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const settings = await SystemSettings.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { upsert: true, new: true }
    ).lean();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[PUT /api/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
