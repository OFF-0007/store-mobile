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
  DOUBLE_STRIKE_ON: "\x1b\x47\x01",
  DOUBLE_STRIKE_OFF: "\x1b\x47\x00",
  FONT_SIZE_LARGE: "\x1d\x21\x11",
  FONT_SIZE_NORMAL: "\x1d\x21\x00",
  FEED_2: "\x1b\x64\x02",
  FEED_4: "\x1b\x64\x04",
  CUT: "\x1d\x56\x41\x03",
};

/**
 * Format receipt text for 58mm printer (approx 31 characters per line to avoid wrapping)
 */
export function formatReceipt58mm(sale) {
  let commands = "";
  commands += ESC.RESET;
  commands += ESC.DOUBLE_STRIKE_ON; // Make everything darker
  commands += ESC.BOLD_ON; // Global bold for maximum darkness

  // --- HEADER SECTION ---
  commands += ESC.ALIGN_CENTER;
  commands += ESC.FONT_SIZE_LARGE;
  // Use store name if provided, else default
  commands += `${(sale.store_name || "STOREMAN POS").toUpperCase()}\n`;
  commands += ESC.FONT_SIZE_NORMAL;

  // Date & Time
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  commands += `${dateStr}  ${timeStr}\n\n`;

  // --- TOKEN / REFERENCE SECTION ---
  commands += "      - - - Token - - -       \n";
  commands += ". . . . . . . . . . . . . . . \n";
  commands += `  ${sale.reference || sale.id || "N/A"}  \n`;
  commands += ". . . . . . . . . . . . . . . \n\n";

  // --- DETAILS SECTION ---
  commands += ESC.ALIGN_LEFT;
  const totalWidth = 30; // Reduced to 30 to prevent wrapping on 58mm
  const leftCol = 12;
  const rightCol = 18;

  const printRow = (label, value) => {
    return `${label.padEnd(leftCol)}${String(value).padStart(rightCol)}\n`;
  };

  const isPurchase = sale.type === 'purchase';
  commands += printRow("Token Type", isPurchase ? "Purchase" : "Sales");
  commands += "------------------------------\n";
  
  const entityLabel = isPurchase ? "Supplier Name" : "Customer Name";
  const entityName = sale.customer_display_name || sale.supplier || (isPurchase ? "New Supplier" : "Walk-in Customer");
  commands += printRow(entityLabel, entityName.length > rightCol ? entityName.substring(0, rightCol-3) + "..." : entityName);
  
  if (sale.payment_method) {
    commands += printRow("Pay Mode", sale.payment_method);
  }
  commands += "------------------------------\n\n";

  // --- ITEMS LIST ---
  commands += "ITEM NAME         QTY   AMOUNT\n";
  commands += "------------------------------\n";

  (sale.items || []).forEach((item) => {
    const name = (item.name || item.product_name || item.product?.name || "Item").toUpperCase();
    const qty = `${item.quantity}`;
    const amount = `₹${Math.round(item.subtotal || (item.quantity * (item.price || item.cost_price || 0)))}`;

    // Column widths: Name(17), Qty(3), Amount(10) = 30 total
    if (name.length > 17) {
      commands += `${name}\n`;
      commands += "".padEnd(17) + qty.padStart(3) + amount.padStart(10) + "\n";
    } else {
      commands += name.padEnd(17) + qty.padStart(3) + amount.padStart(10) + "\n";
    }
  });
  commands += "------------------------------\n";

  // --- FINANCIAL SUMMARY ---
  const subtotal = sale.subtotal || (sale.grand_total - (sale.tax_amount || 0) + (sale.discount || 0));
  commands += printRow("Amount", `₹${Math.round(subtotal)}`);
  
  if (sale.tax_amount > 0) {
    const taxLabel = sale.is_outside_state ? "Tax (IGST)" : "Tax (GST)";
    commands += printRow(taxLabel, `₹${Math.round(sale.tax_amount)}`);
  }
  
  if (sale.discount > 0) {
    commands += printRow("Discount", `-₹${Math.round(sale.discount)}`);
  }
  
  if (sale.round_off && sale.round_off !== 0) {
    commands += printRow("Round Off", `${sale.round_off > 0 ? "+" : ""}${sale.round_off.toFixed(2)}`);
  }

  commands += printRow("Total", `₹${Math.round(sale.grand_total || sale.total || 0)}`);
  commands += "------------------------------\n\n";

  // --- FOOTER SECTION ---
  commands += ESC.ALIGN_CENTER;
  commands += printRow("Operator", "Admin");
  commands += "\n";
  
  commands += ESC.FONT_SIZE_LARGE;
  commands += "THANK YOU\n";
  commands += ESC.FONT_SIZE_NORMAL;
  commands += "VISIT AGAIN\n\n";

  // Barcode (Reference ID) - Moved below "Thank You"
  if (sale.reference || sale.id) {
    const ref = sale.reference || String(sale.id);
    commands += ESC.ALIGN_CENTER;
    // ESC/POS Code128 Barcode: [GS k m n d1...dn]
    const barcodeData = Buffer.from(ref, 'ascii');
    const barcodeCommand = Buffer.concat([
      Buffer.from([0x1d, 0x68, 0x40]), // Height: 64 dots
      Buffer.from([0x1d, 0x77, 0x02]), // Width: 2
      Buffer.from([0x1d, 0x48, 0x02]), // HRI (text) below barcode
      Buffer.from([0x1d, 0x6b, 0x49, barcodeData.length]), // Code128
      barcodeData
    ]);
    commands += barcodeCommand.toString('binary');
    commands += "\n";
  }
  
  commands += ESC.BOLD_OFF;
  commands += ESC.DOUBLE_STRIKE_OFF;
  
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
