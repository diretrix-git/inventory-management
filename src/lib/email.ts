import nodemailer from "nodemailer";

// ─── Transporter ─────────────────────────────────────────────────────────────
// Uses Gmail SMTP with App Password (not your regular Gmail password).
// Setup: Google Account → Security → 2-Step Verification → App passwords
// Add to .env.local:
//   GMAIL_USER=your@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn("[Email] GMAIL_USER or GMAIL_APP_PASSWORD not set — emails will be skipped");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  items: { productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  invoiceNumber: string;
  businessName: string;
  businessAddress?: string;
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function orderConfirmationHtml(data: OrderEmailData): string {
  const itemRows = data.items.map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${item.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-family:monospace;">${item.sku}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:right;font-family:monospace;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;text-align:right;font-family:monospace;">$${item.lineTotal.toFixed(2)}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:#185FA5;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">${data.businessName}</h1>
      ${data.businessAddress ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${data.businessAddress}</p>` : ""}
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#18181b;">Order Confirmation</h2>
      <p style="margin:0 0 24px;color:#71717a;font-size:14px;">
        Hi ${data.customerName}, your order has been received and is being processed.
      </p>

      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:13px;color:#71717a;">Order number</span>
          <span style="font-size:13px;font-family:monospace;font-weight:600;color:#18181b;">${data.orderNumber}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:13px;color:#71717a;">Invoice number</span>
          <span style="font-size:13px;font-family:monospace;font-weight:600;color:#18181b;">${data.invoiceNumber}</span>
        </div>
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f4f4f5;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;letter-spacing:0.05em;">Product</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;letter-spacing:0.05em;">SKU</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;letter-spacing:0.05em;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#71717a;letter-spacing:0.05em;">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#71717a;letter-spacing:0.05em;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="border-top:2px solid #e4e4e7;padding-top:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:#71717a;">Subtotal</span>
          <span style="font-size:13px;font-family:monospace;">$${data.subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:13px;color:#71717a;">Tax (${data.taxRate}%)</span>
          <span style="font-size:13px;font-family:monospace;">$${data.taxAmount.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:15px;font-weight:600;color:#18181b;">Total</span>
          <span style="font-size:15px;font-weight:600;font-family:monospace;color:#18181b;">$${data.totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f4f4f5;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;">Thank you for your order — ${data.businessName}</p>
    </div>
  </div>
</body>
</html>`;
}

function adminNotificationHtml(data: OrderEmailData): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;margin:0;padding:0;">
  <div style="max-width:500px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:40px;height:40px;background:#185FA5;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:18px;">📦</span>
      </div>
      <div>
        <h2 style="margin:0;font-size:16px;color:#18181b;">New Order Received</h2>
        <p style="margin:2px 0 0;font-size:13px;color:#71717a;">${data.businessName}</p>
      </div>
    </div>

    <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:13px;"><strong>Order:</strong> <span style="font-family:monospace;">${data.orderNumber}</span></p>
      <p style="margin:0 0 6px;font-size:13px;"><strong>Customer:</strong> ${data.customerName}</p>
      ${data.customerEmail ? `<p style="margin:0 0 6px;font-size:13px;"><strong>Email:</strong> ${data.customerEmail}</p>` : ""}
      <p style="margin:0;font-size:13px;"><strong>Total:</strong> <span style="font-family:monospace;font-weight:600;">$${data.totalAmount.toFixed(2)}</span></p>
    </div>

    <p style="margin:0;font-size:13px;color:#71717a;">
      ${data.items.length} item(s) ordered. Log in to the inventory system to confirm or manage this order.
    </p>
  </div>
</body>
</html>`;
}

// ─── Send functions ───────────────────────────────────────────────────────────

/**
 * Send order confirmation to customer and notification to admin.
 * Fire-and-forget — never throws.
 */
export async function sendOrderEmails(data: OrderEmailData): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) return;

  const adminEmail = process.env.GMAIL_USER!;
  const from = `"${data.businessName}" <${adminEmail}>`;

  const promises: Promise<unknown>[] = [];

  // Customer confirmation (only if email provided)
  if (data.customerEmail) {
    promises.push(
      transporter.sendMail({
        from,
        to: data.customerEmail,
        subject: `Order Confirmation — ${data.orderNumber}`,
        html: orderConfirmationHtml(data),
      }).catch((err) => console.error("[Email] Customer confirmation failed:", err))
    );
  }

  // Admin notification
  promises.push(
    transporter.sendMail({
      from,
      to: adminEmail,
      subject: `New Order: ${data.orderNumber} — ${data.customerName} ($${data.totalAmount.toFixed(2)})`,
      html: adminNotificationHtml(data),
    }).catch((err) => console.error("[Email] Admin notification failed:", err))
  );

  await Promise.allSettled(promises);
}
