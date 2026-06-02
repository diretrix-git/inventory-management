import { Types } from "mongoose";

export type Role = "admin" | "staff";

export interface IUser {
  _id: string | Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  role: Role;
  isActive: boolean;
  image?: string;
  createdAt: Date;
}

export interface IProduct {
  _id: string | Types.ObjectId;
  name: string;
  sku?: string;        // optional — auto-generated at creation if not provided
  category?: string;
  description?: string;
  price: number;
  quantity: number;
  lowStockThreshold: number;
  supplierId?: string | Types.ObjectId;
  imageUrl?: string;
  isLowStock?: boolean;
  createdAt: Date;
}

export interface ISupplier {
  _id: string | Types.ObjectId;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
}

export interface IOrderLine {
  productId: string | Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IOrder {
  _id: string | Types.ObjectId;
  orderNumber: string;
  items: IOrderLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "cancelled";
  requiresApproval: boolean;
  customerName: string;
  customerEmail?: string;
  notes?: string;
  createdBy: string | Types.ObjectId;
  createdAt: Date;
}

export interface IInvoiceLine {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IInvoice {
  _id: string | Types.ObjectId;
  invoiceNumber: string;
  orderId: string | Types.ObjectId;
  issuedTo: string;
  items: IInvoiceLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: "issued" | "void";
  createdAt: Date;
}

export interface IAuditLog {
  _id: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  userName: string;
  action: string;
  targetModel: string;
  targetId?: string | Types.ObjectId;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface ISystemSettings {
  _id: string | Types.ObjectId;
  businessName: string;
  businessAddress: string;
  taxRate: number;
  lowStockThreshold: number;
}
