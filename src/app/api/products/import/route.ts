import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Supplier } from "@/models/Supplier";
import { Category } from "@/models/Category";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";

interface CsvRow {
  name: string;
  category: string;
  supplierName: string;
  price: string;
  quantity: string;
  lowStockThreshold?: string;
  description?: string;
  sku?: string;
}

// ─── POST /api/products/import ────────────────────────────────────────────────
// Admin only — bulk import products from parsed CSV rows

export async function POST(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = body as CsvRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  if (rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 products per import" }, { status: 400 });
  }

  try {
    await connectDB();

    // Pre-fetch all existing suppliers by name for fast lookup
    const supplierNames = [...new Set(rows.map((r) => r.supplierName?.trim()).filter(Boolean))];
    const existingSuppliers = await Supplier.find({ name: { $in: supplierNames } }).lean();
    const supplierMap = new Map(existingSuppliers.map((s) => [s.name.toLowerCase(), String(s._id)]));

    // Auto-create missing suppliers
    for (const name of supplierNames) {
      if (name && !supplierMap.has(name.toLowerCase())) {
        const created = await Supplier.create({ name });
        supplierMap.set(name.toLowerCase(), String(created._id));
      }
    }

    // Auto-create missing categories
    const categoryNames = [...new Set(rows.map((r) => r.category?.trim()).filter(Boolean))];
    for (const name of categoryNames) {
      if (name) {
        await Category.findOneAndUpdate(
          { name: { $regex: `^${name}$`, $options: "i" } },
          { $setOnInsert: { name } },
          { upsert: true }
        );
      }
    }

    // Import products
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because header is row 1

      const name = row.name?.trim();
      const category = row.category?.trim();
      const supplierName = row.supplierName?.trim();
      const price = parseFloat(row.price);
      const quantity = parseInt(row.quantity ?? "0", 10);
      const lowStockThreshold = parseInt(row.lowStockThreshold ?? "10", 10);

      if (!name) { results.errors.push(`Row ${rowNum}: Name is required`); results.skipped++; continue; }
      if (!category) { results.errors.push(`Row ${rowNum}: Category is required for "${name}"`); results.skipped++; continue; }
      if (!supplierName) { results.errors.push(`Row ${rowNum}: Supplier is required for "${name}"`); results.skipped++; continue; }
      if (isNaN(price) || price < 0) { results.errors.push(`Row ${rowNum}: Invalid price for "${name}"`); results.skipped++; continue; }
      if (isNaN(quantity) || quantity < 0) { results.errors.push(`Row ${rowNum}: Invalid quantity for "${name}"`); results.skipped++; continue; }

      const supplierId = supplierMap.get(supplierName.toLowerCase());
      if (!supplierId) { results.errors.push(`Row ${rowNum}: Could not find supplier "${supplierName}"`); results.skipped++; continue; }

      try {
        // Generate SKU if not provided
        let sku = row.sku?.trim().toUpperCase() || undefined;
        if (!sku) {
          const count = await Product.countDocuments();
          sku = `PROD-${String(count + results.created + 1).padStart(6, "0")}`;
        }

        // Skip if SKU already exists
        const existing = await Product.findOne({ sku }).lean();
        if (existing) {
          results.errors.push(`Row ${rowNum}: SKU "${sku}" already exists — skipped`);
          results.skipped++;
          continue;
        }

        await Product.create({
          name,
          sku,
          category,
          supplierId,
          price,
          quantity,
          lowStockThreshold: isNaN(lowStockThreshold) ? 10 : lowStockThreshold,
          description: row.description?.trim() || undefined,
        });
        results.created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`Row ${rowNum}: Failed to create "${name}" — ${msg}`);
        results.skipped++;
      }
    }

    // Fire-and-forget audit log
    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "product.bulk_import",
      targetModel: "Product",
      details: { created: results.created, skipped: results.skipped, total: rows.length },
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[POST /api/products/import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
