import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { SystemSettings } from "@/models/SystemSettings";
import { logAction } from "@/lib/audit";
import { auth } from "../../../../../../auth";

// ─── GET /api/invoices/[id]/pdf ───────────────────────────────────────────────
// All roles — server-side PDF generation via @react-pdf/renderer

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const invoice = await Invoice.findById(id)
      .populate("orderId", "orderNumber")
      .lean();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const settings = await SystemSettings.findOne({}).lean() ?? {
      businessName: "My Business",
      businessAddress: "",
      taxRate: 0,
    };

    // Dynamically import @react-pdf/renderer — server only, never in client bundles
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { InvoiceTemplate } = await import("@/components/pdf/InvoiceTemplate");

    let pdfBuffer: Buffer;
    try {
      const element = InvoiceTemplate({
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          issuedTo: invoice.issuedTo,
          createdAt: invoice.createdAt,
          items: invoice.items,
          subtotal: invoice.subtotal,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount,
          status: invoice.status,
        },
        order: {
          orderNumber:
            typeof invoice.orderId === "object" && invoice.orderId !== null
              ? (invoice.orderId as { orderNumber?: string }).orderNumber ?? ""
              : "",
        },
        settings: {
          businessName: settings.businessName,
          businessAddress: settings.businessAddress,
        },
      });

      pdfBuffer = await renderToBuffer(element);
    } catch (renderErr) {
      console.error("[PDF render error]", renderErr);
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }

    // Fire-and-forget audit log
    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "invoice.downloaded",
      targetModel: "Invoice",
      targetId: id,
      details: { invoiceNumber: invoice.invoiceNumber },
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="INV-${invoice.invoiceNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("[GET /api/invoices/[id]/pdf]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
