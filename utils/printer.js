/**
 * Storeman Thermal Receipt Printer Utility
 * Uses RawBT App (Android Intent) for printing – no native compilation required.
 */
import { Alert, Linking, Platform } from "react-native";
import { Buffer } from "buffer";

// ESC/POS Commands Constants
const ESC = {
  RESET: "\x1b\x40",
  ALIGN_LEFT: "\x1b\x61\x00",
  ALIGN_CENTER: "\x1b\x61\x01",
  ALIGN_RIGHT: "\x1b\x61\x02",
  BOLD_ON: "\x1b\x45\x01",
  BOLD_OFF: "\x1b\x45\x00",
  FONT_SIZE_LARGE: "\x1d\x21\x11",
  FONT_SIZE_NORMAL: "\x1d\x21\x00",
  FEED_2: "\x1b\x64\x02",
  FEED_4: "\x1b\x64\x04",
  CUT: "\x1d\x56\x41\x03",
};

/**
 * Format receipt text for 58mm printer (32 characters per line)
 */
export function formatReceipt58mm(sale) {
  let commands = "";
  commands += ESC.RESET;

  // Title (Bold, Large, Center)
  commands += ESC.ALIGN_CENTER;
  commands += ESC.BOLD_ON;
  commands += ESC.FONT_SIZE_LARGE;
  commands += "STOREMAN POS\n";
  commands += ESC.FONT_SIZE_NORMAL;
  commands += "F2 Mobile Printer Receipt\n";
  commands += ESC.BOLD_OFF;

  // Metadata
  commands += ESC.ALIGN_LEFT;
  commands += `Ref: ${sale.reference || "N/A"}\n`;
  commands += `Date: ${sale.sale_date || sale.date || "N/A"}\n`;
  commands += `Customer: ${sale.customer_display_name || sale.supplier || "Guest"}\n`;
  if (sale.payment_method) {
    commands += `Pay Mode: ${sale.payment_method} (${sale.payment_status || "paid"})\n`;
  }
  commands += "--------------------------------\n";

  // Column Headers
  commands += ESC.BOLD_ON;
  commands += "Item Name       Qty   Subtotal\n";
  commands += ESC.BOLD_OFF;
  commands += "--------------------------------\n";

  // Items list
  (sale.items || []).forEach((item) => {
    const name = (item.name || "Item").toUpperCase();
    if (name.length > 15) {
      commands += `${name}\n`;
      const qtyStr = `${item.quantity}x`;
      const priceStr = `₹${Math.round(item.price || item.cost_price || 0)}`;
      const subtotalStr = `₹${Math.round(item.subtotal || (item.quantity * (item.price || item.cost_price || 0)))}`;
      const detailLine = `  ${qtyStr} @ ${priceStr}`.padEnd(20) + subtotalStr.padStart(10);
      commands += `${detailLine}\n`;
    } else {
      const qtyStr = `${item.quantity}x`;
      const subtotalStr = `₹${Math.round(item.subtotal || (item.quantity * (item.price || item.cost_price || 0)))}`;
      const leftPart = name.padEnd(16) + qtyStr.padStart(4);
      const rightPart = subtotalStr.padStart(10);
      commands += `${leftPart}${rightPart}\n`;
    }
  });

  commands += "--------------------------------\n";

  // Financial Summary
  commands += ESC.ALIGN_RIGHT;
  if (sale.subtotal) commands += `Subtotal: ₹${Math.round(sale.subtotal)}\n`;
  if (sale.tax_amount > 0) {
    const taxLabel = sale.is_outside_state ? "IGST" : "CGST+SGST";
    commands += `${taxLabel}: ₹${Math.round(sale.tax_amount)}\n`;
  }
  if (sale.discount > 0) commands += `Discount: -₹${Math.round(sale.discount)}\n`;
  if (sale.round_off && sale.round_off !== 0) {
    commands += `Round Off: ${sale.round_off > 0 ? "+" : ""}${sale.round_off.toFixed(2)}\n`;
  }

  commands += ESC.BOLD_ON;
  const total = sale.grand_total || sale.total || 0;
  commands += `GRAND TOTAL: ₹${Math.round(total)}\n`;
  commands += ESC.BOLD_OFF;

  const paid = sale.paid_amount || sale.paid || 0;
  if (paid > total) {
    commands += `Change Due: ₹${Math.round(paid - total)}\n`;
  } else if (paid > 0 && paid < total) {
    commands += `Due Balance: ₹${Math.round(total - paid)}\n`;
  }

  // Footer
  commands += ESC.ALIGN_CENTER;
  commands += "\nThank you!\n";
  commands += "Powered by Storeman Ledger\n";
  commands += ESC.FEED_4;
  commands += ESC.CUT;

  return commands;
}

/**
 * Print via RawBT app (Android Intent). Works without native compilation.
 */
export async function printViaRawBT(sale) {
  try {
    const escData = formatReceipt58mm(sale);
    const base64Data = Buffer.from(escData, "binary").toString("base64");
    const rawBtUri = `rawbt:base64,${base64Data}`;

    const canOpen = await Linking.canOpenURL(rawBtUri);
    if (canOpen) {
      await Linking.openURL(rawBtUri);
      return true;
    } else {
      Alert.alert(
        "RawBT App Required",
        "Install the free RawBT app from Play Store to print receipts.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Install RawBT",
            onPress: () => Linking.openURL("market://details?id=ru.a402d.rawbtprinter"),
          },
        ]
      );
      return false;
    }
  } catch (err) {
    Alert.alert("Print Error", `Failed to send to printer: ${err.message}`);
    return false;
  }
}

/**
 * Universal print method – uses RawBT on Android, shows alert on other platforms.
 */
export async function printThermalReceipt(sale) {
  if (Platform.OS === "android") {
    return await printViaRawBT(sale);
  }
  Alert.alert(
    "Printing Unsupported",
    "Thermal printing is currently only supported on Android via the RawBT app."
  );
  return false;
}
