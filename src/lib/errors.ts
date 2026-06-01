/**
 * Maps technical API/server error messages to user-friendly messages.
 * Never expose raw DB errors, stack traces, or internal field names to users.
 */
export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return "Something went wrong. Please try again.";

  const msg = raw.toLowerCase();

  // Auth
  if (msg.includes("unauthorized") || msg.includes("401")) return "You need to be logged in to do that.";
  if (msg.includes("forbidden") || msg.includes("403")) return "You don't have permission to do that.";

  // Not found
  if (msg.includes("not found") || msg.includes("404")) return "The item you're looking for doesn't exist or has been removed.";

  // Duplicate / unique constraint
  if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("409") || msg.includes("unique")) {
    if (msg.includes("email")) return "An account with this email already exists.";
    if (msg.includes("sku")) return "A product with this SKU already exists. Please use a different SKU.";
    if (msg.includes("supplier") || msg.includes("name")) return "A supplier with this name already exists.";
    return "This item already exists. Please use a different value.";
  }

  // Stock / inventory
  if (msg.includes("insufficient stock") || msg.includes("out of stock")) {
    return "Some products don't have enough stock for this order. Please reduce the quantity or remove those items.";
  }
  if (msg.includes("cannot delete product referenced")) {
    return "This product can't be deleted because it's part of a confirmed order. Cancel the order first, or keep the product.";
  }
  if (msg.includes("cannot delete supplier") || msg.includes("linked product")) {
    return "This supplier can't be deleted because products are linked to it. Remove or reassign those products first.";
  }

  // Order / status
  if (msg.includes("invalid status transition")) return "This status change isn't allowed. Check the current order status and try again.";
  if (msg.includes("cart") || msg.includes("at least one item")) return "Please add at least one product to the order before submitting.";
  if (msg.includes("customer name")) return "Please enter a valid customer name (1–200 characters, not blank).";

  // Validation
  if (msg.includes("validation") || msg.includes("invalid") || msg.includes("required")) {
    return "Some fields have invalid values. Please check the form and try again.";
  }

  // Network / server
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Couldn't connect to the server. Check your internet connection and try again.";
  }
  if (msg.includes("internal server error") || msg.includes("500")) {
    return "Something went wrong on our end. Please try again in a moment.";
  }

  // PDF
  if (msg.includes("pdf generation failed")) return "Couldn't generate the PDF. Please try again.";

  // Password
  if (msg.includes("current password is incorrect")) return "The current password you entered is wrong. Please try again.";
  if (msg.includes("password change is not available")) return "Password changes aren't available for accounts that signed in with Google or GitHub.";

  // Fallback — return a generic message, never the raw technical error
  return "Something went wrong. Please try again or contact support if the problem continues.";
}
