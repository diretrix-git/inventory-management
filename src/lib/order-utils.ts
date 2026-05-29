import { Order } from "@/models/Order";
import { Invoice } from "@/models/Invoice";

/**
 * Formats a date as YYYYMMDD for use in order/invoice numbers.
 */
function formatDateSegment(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Generates the next order number in ORD-YYYYMMDD-XXXX format.
 * The sequence resets per day and is zero-padded to 4 digits.
 * Requires an active DB connection before calling.
 */
export async function generateOrderNumber(date: Date = new Date()): Promise<string> {
  const dateSegment = formatDateSegment(date);
  const prefix = `ORD-${dateSegment}-`;

  // Count existing orders for today to determine next sequence number
  const count = await Order.countDocuments({
    orderNumber: { $regex: `^${prefix}` },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}${sequence}`;
}

/**
 * Generates the next invoice number in INV-YYYYMMDD-XXXX format.
 * Requires an active DB connection before calling.
 */
export async function generateInvoiceNumber(date: Date = new Date()): Promise<string> {
  const dateSegment = formatDateSegment(date);
  const prefix = `INV-${dateSegment}-`;

  const count = await Invoice.countDocuments({
    invoiceNumber: { $regex: `^${prefix}` },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}${sequence}`;
}
