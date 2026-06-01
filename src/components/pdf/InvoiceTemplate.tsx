// "use server" — this file imports @react-pdf/renderer and must never be imported in client components
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { IInvoiceLine } from "@/types";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 48,
    color: "#18181b",
    backgroundColor: "#ffffff",
  },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  businessBlock: { flex: 1 },
  businessName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  businessAddress: { fontSize: 9, color: "#71717a", lineHeight: 1.5 },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#185FA5", marginBottom: 6 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  metaLabel: { fontSize: 9, color: "#71717a", width: 80, textAlign: "right" },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  // Bill to
  billSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 8, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  billName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  // Table
  table: { marginBottom: 24 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  colDescription: { flex: 3 },
  colSku: { flex: 2 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  headerText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#71717a", textTransform: "uppercase" },
  cellText: { fontSize: 9 },
  skuText: { fontSize: 8, color: "#71717a", fontFamily: "Courier" },
  // Totals
  totalsSection: { alignItems: "flex-end", marginBottom: 32 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: "#71717a" },
  totalValue: { fontSize: 9, fontFamily: "Courier" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1.5,
    borderTopColor: "#18181b",
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", fontFamily2: "Courier" },
  // Footer
  footer: { position: "absolute", bottom: 32, left: 48, right: 48 },
  footerText: { fontSize: 8, color: "#a1a1aa", textAlign: "center" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  statusText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceTemplateProps {
  invoice: {
    invoiceNumber: string;
    issuedTo: string;
    createdAt: Date | string;
    items: IInvoiceLine[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    status: "issued" | "void";
  };
  order: {
    orderNumber: string;
  };
  settings: {
    businessName: string;
    businessAddress: string;
  };
}

// ─── InvoiceTemplate ──────────────────────────────────────────────────────────

export function InvoiceTemplate({ invoice, order, settings }: InvoiceTemplateProps) {
  const date = new Date(invoice.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isVoid = invoice.status === "void";

  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber}`}
      author={settings.businessName}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.businessBlock}>
            <Text style={styles.businessName}>{settings.businessName}</Text>
            {settings.businessAddress ? (
              <Text style={styles.businessAddress}>{settings.businessAddress}</Text>
            ) : null}
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice #</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Order #</Text>
              <Text style={styles.metaValue}>{order.orderNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{formattedDate}</Text>
            </View>
            {isVoid && (
              <View style={[styles.statusBadge, { backgroundColor: "#fee2e2" }]}>
                <Text style={[styles.statusText, { color: "#A32D2D" }]}>VOID</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billSection}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.billName}>{invoice.issuedTo}</Text>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDescription]}>Description</Text>
            <Text style={[styles.headerText, styles.colSku]}>SKU</Text>
            <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
            <Text style={[styles.headerText, styles.colUnit]}>Unit Price</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
          </View>

          {/* Table rows */}
          {invoice.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.cellText, styles.colDescription]}>{item.productName}</Text>
              <Text style={[styles.skuText, styles.colSku]}>{item.sku}</Text>
              <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.cellText, styles.colUnit]}>Rs {item.unitPrice.toFixed(2)}</Text>
              <Text style={[styles.cellText, styles.colTotal]}>Rs {item.lineTotal.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>Rs {invoice.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({invoice.taxRate}%)</Text>
              <Text style={styles.totalValue}>Rs {invoice.taxAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalLabel}>Rs {invoice.totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {settings.businessName} · {invoice.invoiceNumber} · Thank you for your business
          </Text>
        </View>
      </Page>
    </Document>
  );
}
