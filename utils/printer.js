/**
 * Storeman Thermal Receipt Printer Utility
 * Supports Native BLE/Bluetooth Thermal Receipt Printer (react-native-thermal-receipt-printer)
 * and Fallbacks to RawBT App Scheme (for Android without native compile/Expo Go)
 */
import { Alert, Linking, Platform } from "react-native";
import { Buffer } from "buffer";

// Safely require native printer library
let BluetoothEscposPrinter = null;
let BLEPrinter = null;

try {
  const NativePrinter = require("react-native-thermal-receipt-printer");
  BLEPrinter = NativePrinter.BLEPrinter;
} catch (e) {
  console.warn("Native thermal printer module not compiled or loaded:", e.message);
}

// ESC/POS Commands Constants
const ESC = {
  RESET: "\x1b\x40",
  ALIGN_LEFT: "\x1b\x61\x00",
  ALIGN_CENTER: "\x1b\x61\x01",
  ALIGN_RIGHT: "\x1b\x61\x02",
  BOLD_ON: "\x1b\x45\x01",
  BOLD_OFF: "\x1b\x45\x00",
  FONT_SIZE_LARGE: "\x1d\x21\x11", // Double width + double height
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
  commands += `Date: ${sale.sale_date || "N/A"}\n`;
  commands += `Customer: ${sale.customer_display_name || "Guest"}\n`;
  commands += `Pay Mode: ${sale.payment_method} (${sale.payment_status})\n`;
  commands += "--------------------------------\n"; // 32 chars
  
  // Column Headers
  commands += ESC.BOLD_ON;
  commands += "Item Name       Qty   Subtotal\n";
  commands += ESC.BOLD_OFF;
  commands += "--------------------------------\n";
  
  // Items list
  (sale.items || []).forEach((item) => {
    // 58mm layout helper: If item name is long, print on separate line, then details
    const name = (item.name || "Item").toUpperCase();
    if (name.length > 15) {
      commands += `${name}\n`;
      const qtyStr = `${item.quantity}x`;
      const priceStr = `₹${Math.round(item.price)}`;
      const subtotalStr = `₹${Math.round(item.subtotal)}`;
      
      // Right align subtotal, format details
      const detailLine = `  ${qtyStr} @ ${priceStr}`.padEnd(20) + subtotalStr.padStart(10);
      commands += `${detailLine}\n`;
    } else {
      const qtyStr = `${item.quantity}x`;
      const subtotalStr = `₹${Math.round(item.subtotal)}`;
      const leftPart = name.padEnd(16) + qtyStr.padStart(4);
      const rightPart = subtotalStr.padStart(10);
      commands += `${leftPart}${rightPart}\n`;
    }
  });
  
  commands += "--------------------------------\n";
  
  // Financial Summary (Right aligned)
  commands += ESC.ALIGN_RIGHT;
  commands += `Subtotal: ₹${Math.round(sale.subtotal)}\n`;
  if (sale.tax_amount > 0) {
    const taxLabel = sale.is_outside_state ? "IGST" : "CGST+SGST";
    commands += `${taxLabel}: ₹${Math.round(sale.tax_amount)}\n`;
  }
  if (sale.discount > 0) {
    commands += `Discount: -₹${Math.round(sale.discount)}\n`;
  }
  if (sale.round_off !== 0) {
    commands += `Round Off: ${sale.round_off > 0 ? "+" : ""}${sale.round_off.toFixed(2)}\n`;
  }
  
  commands += ESC.BOLD_ON;
  commands += `GRAND TOTAL: ₹${Math.round(sale.grand_total)}\n`;
  commands += ESC.BOLD_OFF;
  
  if (sale.paid_amount > sale.grand_total) {
    commands += `Change Due: ₹${Math.round(sale.paid_amount - sale.grand_total)}\n`;
  } else if (sale.paid_amount < sale.grand_total) {
    commands += `Due Balance: ₹${Math.round(sale.grand_total - sale.paid_amount)}\n`;
  }
  
  // Footer
  commands += ESC.ALIGN_CENTER;
  commands += "\nThank you for shopping!\n";
  commands += "Powered by Storeman Ledger\n";
  commands += ESC.FEED_4;
  commands += ESC.CUT;
  
  return commands;
}

/**
 * Print via RawBT app (Intent) fallback. Works immediately on Android.
 */
export async function printViaRawBT(sale) {
  try {
    const escData = formatReceipt58mm(sale);
    // Encode raw ESC/POS text command into base64 bytes
    const base64Data = Buffer.from(escData, "binary").toString("base64");
    const rawBtUri = `rawbt:base64,${base64Data}`;
    
    const canOpen = await Linking.canOpenURL(rawBtUri);
    if (canOpen) {
      await Linking.openURL(rawBtUri);
      return true;
    } else {
      Alert.alert(
        "RawBT App Missing",
        "RawBT printer app is required to print on Android. Would you like to install it from Play Store?",
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
    Alert.alert("Print Error", `Failed to send to RawBT: ${err.message}`);
    return false;
  }
}

/**
 * Scan for and Connect to BLE Bluetooth Thermal Printer (Native)
 */
export async function connectAndPrintNative(sale) {
  if (!BLEPrinter) {
    throw new Error("Native printer module is not compiled into this build.");
  }
  
  try {
    // 1. Initialize
    await BLEPrinter.init();
    
    // 2. Fetch list of paired devices
    const devices = await BLEPrinter.getDeviceList();
    if (!devices || devices.length === 0) {
      throw new Error("No paired Bluetooth devices found.");
    }
    
    // 3. Find target printer (F2 or similar)
    const targetPrinter = devices.find(
      (d) =>
        (d.name && d.name.toLowerCase().includes("f2")) ||
        (d.name && d.name.toLowerCase().includes("printer")) ||
        (d.name && d.name.toLowerCase().includes("mpt"))
    ) || devices[0]; // fallback to first device
    
    // 4. Connect
    await BLEPrinter.connectPrinter(targetPrinter.inner_mac_address || targetPrinter.address);
    
    // 5. Build ESC/POS command string
    const escData = formatReceipt58mm(sale);
    
    // 6. Write raw data
    await BLEPrinter.printRaw(escData, "binary");
    
    return true;
  } catch (err) {
    console.error("Native BLE printing failed:", err);
    throw err;
  }
}

/**
 * Universal print method: tries native connection first, falls back to RawBT, and alerts user.
 */
export async function printThermalReceipt(sale) {
  // If native module is available, try connecting and printing natively
  if (BLEPrinter) {
    try {
      await connectAndPrintNative(sale);
      return true;
    } catch (err) {
      console.warn("Native BLE print failed, trying RawBT fallback. Error:", err.message);
    }
  }
  
  // Fallback to RawBT on Android
  if (Platform.OS === "android") {
    return await printViaRawBT(sale);
  }
  
  Alert.alert(
    "Printing Unsupported",
    "Thermal printing is currently only supported on Android devices via BLE or RawBT app."
  );
  return false;
}
