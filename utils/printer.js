/**
 * Storeman Thermal Receipt Printer Utility
 * Uses RawBT App (Android Intent) for printing – no native compilation required.
 * Pure JavaScript Implementation – 100% binary safe and does not rely on Node Buffer polyfills.
 */
import { Alert, Linking, Platform } from "react-native";
import apiClient from "@/lib/api/client";

// Helper: Convert string to UTF-8 byte array (Uint8Array)
function stringToUtf8(str) {
  const arr = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) arr.push(charcode);
    else if (charcode < 0x800) {
      arr.push(0xc0 | (charcode >> 6), 
               0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      arr.push(0xe0 | (charcode >> 12), 
               0x80 | ((charcode >> 6) & 0x3f), 
               0x80 | (charcode & 0x3f));
    } else {
      // surrogate pair
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                | (str.charCodeAt(i) & 0x3ff));
      arr.push(0xf0 | (charcode >> 18), 
               0x80 | ((charcode >> 12) & 0x3f), 
               0x80 | ((charcode >> 6) & 0x3f), 
               0x80 | (charcode & 0x3f));
    }
  }
  return new Uint8Array(arr);
}

// Helper: Convert Hex string to Uint8Array
function hexToUint8Array(hexString) {
  const l = hexString.length;
  const arr = new Uint8Array(l / 2);
  for (let i = 0; i < l; i += 2) {
    arr[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  return arr;
}

// Helper: Concatenate multiple Uint8Arrays
function concatUint8Arrays(arrays) {
  let totalLength = 0;
  for (let arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (let arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Helper: Pure JavaScript Base64 encoder for Uint8Array
function uint8ToBase64(uint8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const l = uint8.length;
  for (let i = 0; i < l; i += 3) {
    const b0 = uint8[i];
    const b1 = i + 1 < l ? uint8[i + 1] : 0;
    const b2 = i + 2 < l ? uint8[i + 2] : 0;
    
    const chunk = (b0 << 16) | (b1 << 8) | b2;
    
    const c0 = (chunk >> 18) & 63;
    const c1 = (chunk >> 12) & 63;
    const c2 = (chunk >> 6) & 63;
    const c3 = chunk & 63;
    
    result += chars[c0] + chars[c1];
    result += (i + 1 < l) ? chars[c2] : '=';
    result += (i + 2 < l) ? chars[c3] : '=';
  }
  return result;
}

// ESC/POS Hex Commands Constants
const ESC = {
  RESET: "1b40",
  ALIGN_LEFT: "1b6100",
  ALIGN_CENTER: "1b6101",
  ALIGN_RIGHT: "1b6102",
  BOLD_ON: "1b4501",
  BOLD_OFF: "1b4500",
  DOUBLE_STRIKE_ON: "1b4701",
  DOUBLE_STRIKE_OFF: "1b4700",
  FONT_SIZE_LARGE: "1d2111",
  FONT_SIZE_NORMAL: "1d2100",
  FEED_2: "1b6402",
  FEED_4: "1b6404",
  CUT: "1d564103",
};

/**
 * Format receipt text for 48mm printer (approx 24 characters per line to avoid wrapping)
 */
export function formatReceipt48mm(sale, settings = {}) {
  const parts = [];

  const addText = (str) => {
    parts.push(stringToUtf8(str));
  };

  const addRaw = (data) => {
    if (typeof data === "string") {
      parts.push(hexToUint8Array(data));
    } else {
      parts.push(data);
    }
  };

  addRaw(ESC.RESET);
  addRaw(ESC.DOUBLE_STRIKE_ON); // Make everything darker
  addRaw(ESC.BOLD_ON); // Global bold for maximum darkness

  // --- HEADER SECTION ---
  addRaw(ESC.FONT_SIZE_LARGE);
  addRaw(ESC.ALIGN_CENTER);
  
  // 1. Store Name
  const storeName = settings.store_name || sale.store?.name || sale.store_name || "STOREMAN POS";
  addText(`${storeName.toUpperCase()}\n`);
  
  addRaw(ESC.FONT_SIZE_NORMAL);
  addRaw(ESC.ALIGN_CENTER); // Re-align center for the rest of the header
  
  // 2. Store Address
  const address = settings.store_address || sale.store?.address;
  if (address) {
    addText(`${address}\n`);
  }

  // 3. GST Number
  const gstNo = settings.gst_no || sale.store?.gst_no;
  if (gstNo) {
    addText(`GSTIN: ${gstNo}\n`);
  }

  // Date & Time
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  addText(`\n${dateStr}  ${timeStr}\n\n`);

  // --- TOKEN / REFERENCE SECTION ---
  addText("      - - - Token - - -       \n");
  addText(". . . . . . . . . . . . . . . \n");
  const refText = String(sale.reference || sale.id || "N/A");
  addText(`${refText}\n`);
  addText(". . . . . . . . . . . . . . . \n\n");

  // --- DETAILS SECTION ---
  addRaw(ESC.ALIGN_LEFT);
  const totalWidth = 24; // Reduced to 24 to fit 48mm thermal printer width
  const leftCol = 13;
  const rightCol = 11;

  const printRow = (label, value) => {
    return `${label.padEnd(leftCol)}${String(value).padStart(rightCol)}\n`;
  };

  const isPurchase = sale.type === "purchase";
  addText(printRow("Token Type", isPurchase ? "Purchase" : "Sales"));
  addText("------------------------\n");

  const entityLabel = isPurchase ? "Supplier Name" : "Customer Name";
  const entityName = sale.customer_display_name || sale.supplier || (isPurchase ? "New Supplier" : "Walk-in Customer");
  addText(printRow(entityLabel, entityName.length > rightCol ? entityName.substring(0, rightCol - 3) + "..." : entityName));

  if (sale.payment_method) {
    addText(printRow("Pay Mode", sale.payment_method));
  }
  addText("------------------------\n\n");

  // --- ITEMS LIST ---
  addText("ITEM NAME  QTY    AMOUNT\n");
  addText("------------------------\n");

  (sale.items || []).forEach((item) => {
    const name = (item.name || item.product_name || item.product?.name || "Item").toUpperCase();
    const qty = `${item.quantity}`;
    const amount = `Rs.${Math.round(item.subtotal || (item.quantity * (item.price || item.cost_price || 0)))}`;

    // Column widths: Name(9), Qty(5), Amount(10) = 24 total
    if (name.length > 9) {
      addText(`${name}\n`);
      addText("".padEnd(9) + qty.padStart(5) + amount.padStart(10) + "\n");
    } else {
      addText(name.padEnd(9) + qty.padStart(5) + amount.padStart(10) + "\n");
    }
  });
  addText("------------------------\n");

  // --- FINANCIAL SUMMARY ---
  const subtotal = sale.subtotal || (sale.grand_total - (sale.tax_amount || 0) + (sale.discount || 0));
  addText(printRow("Amount", `Rs.${Math.round(subtotal)}`));

  if (sale.tax_amount > 0) {
    const taxLabel = sale.is_outside_state ? "Tax (IGST)" : "Tax (GST)";
    addText(printRow(taxLabel, `Rs.${Math.round(sale.tax_amount)}`));
  }

  if (sale.discount > 0) {
    addText(printRow("Discount", `-Rs.${Math.round(sale.discount)}`));
  }

  if (sale.round_off && sale.round_off !== 0) {
    const roundVal = typeof sale.round_off === "number" ? sale.round_off : parseFloat(sale.round_off);
    if (!isNaN(roundVal)) {
      addText(printRow("Round Off", `${roundVal > 0 ? "+" : ""}${roundVal.toFixed(2)}`));
    }
  }

  addText(printRow("Total", `Rs.${Math.round(sale.grand_total || sale.total || 0)}`));
  addText("------------------------\n\n");

  // --- FOOTER SECTION ---
  addRaw(ESC.ALIGN_CENTER);

  addRaw(ESC.FONT_SIZE_LARGE);
  addRaw(ESC.ALIGN_CENTER);
  addText("THANK YOU\n");
  addRaw(ESC.FONT_SIZE_NORMAL);
  addRaw(ESC.ALIGN_CENTER);
  addText("VISIT AGAIN\n\n");

  // Barcode (Reference ID) - Moved below "Thank You"
  if (sale.reference || sale.id) {
    const ref = sale.reference || String(sale.id);
    addRaw(ESC.ALIGN_CENTER);
    // ESC/POS Code128 Barcode: [GS k m n d1...dn]
    const barcodeData = stringToUtf8(ref);
    const barcodeCommand = concatUint8Arrays([
      hexToUint8Array("1d6840"), // Height: 64 dots
      hexToUint8Array("1d7702"), // Width: 2
      hexToUint8Array("1d4802"), // HRI (text) below barcode
      hexToUint8Array("1d6b49"), // Code128
      new Uint8Array([barcodeData.length]), // Length byte
      barcodeData
    ]);
    addRaw(barcodeCommand);
    addText("\n");
  }

  addRaw(ESC.BOLD_OFF);
  addRaw(ESC.DOUBLE_STRIKE_OFF);

  addRaw(ESC.FEED_4);
  addRaw(ESC.CUT);

  return concatUint8Arrays(parts);
}

/**
 * Print via RawBT app (Android Intent). Works without native compilation.
 */
export async function printViaRawBT(sale) {
  try {
    let settings = {};
    try {
      const res = await apiClient.get('/settings');
      if (res.data) settings = res.data;
    } catch (e) {
      console.warn("Could not fetch latest settings for print", e.message);
    }

    const escBuffer = formatReceipt48mm(sale, settings);
    const base64Data = uint8ToBase64(escBuffer);
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
