"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface OrderNotification {
  type: "ORDER_CREATED";
  orderNumber: string;
  customerName: string;
  totalAmount: number;
}

/**
 * Listens for new order notifications broadcast from the OrderForm.
 * Shows a toast notification on the admin dashboard when a new order is placed
 * (even from another tab or the staff's session on the same device).
 *
 * Uses the BroadcastChannel API — works across same-origin tabs.
 */
export function useOrderNotifications(onNewOrder?: (notification: OrderNotification) => void) {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("order_notifications");

    channel.onmessage = (event: MessageEvent<OrderNotification>) => {
      const data = event.data;
      if (data?.type === "ORDER_CREATED") {
        toast.info(
          `New order placed: ${data.orderNumber} — ${data.customerName} ($${data.totalAmount.toFixed(2)})`,
          {
            duration: 8000,
            action: {
              label: "View Orders",
              onClick: () => { window.location.href = "/orders"; },
            },
          }
        );
        onNewOrder?.(data);
      }
    };

    return () => channel.close();
  }, [onNewOrder]);
}
