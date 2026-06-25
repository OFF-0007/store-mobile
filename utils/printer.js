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

// ─── Helper: pad/truncate to fixed char width ──────────────────────────────
function padL(str, width) {
    str = String(str ?? '');
    if (str.length > width) str = str.slice(0, width);
    return str.padEnd(width, ' ');
}
function padR(str, width) {
    str = String(str ?? '');
    if (str.length > width) str = str.slice(0, width);
    return str.padStart(width, ' ');
}
function repeat(ch, n) {
    return ch.repeat(Math.max(0, n));
}
function center(str, width) {
    str = String(str ?? '');
    if (str.length >= width) return str.slice(0, width);
    const totalPad = width - str.length;
    const left = Math.floor(totalPad / 2);
    const right = totalPad - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
}

// ─── Build receipt as array of plain-text lines ────────────────────────────
function buildLines(type, data, settings, gst_no, storeNameStr, store_address, userNameStr) {
    const isSale = type === 'sale';
    const sym = settings?.currency_symbol || 'Rs. ';
    // Use fixed 32 characters width for strict 58mm POS thermal printers
    const W = 32; 

    const items = data.items || [];
    const returns = data.returns || [];
    const totalReturned = returns.reduce((s, r) => s + Number(r.grand_total || r.total_amount || 0), 0);

    // Date/time
    let displayDate = '';
    try {
        const raw = isSale ? data.sale_date : data.purchase_date;
        const d = raw ? new Date(raw) : new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yr = d.getFullYear();
        let hours = d.getHours();
        const mins = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hh = String(hours).padStart(2, '0');
        displayDate = `${dd}-${mm}-${yr} ${hh}:${mins} ${ampm}`;
    } catch (_) {
        displayDate = new Date().toLocaleDateString('en-IN');
    }

    const invId = isSale
        ? (data.formatted_id || `INV-${String(data.id).padStart(5, '0')}`)
        : (data.reference || `PRCH-${String(data.id).padStart(5, '0')}`);

    const storeName = storeNameStr.toUpperCase();
    const cashier = (userNameStr || 'ADMIN').toUpperCase();
    const customer = (isSale ? (data.customer_name || data.customer?.name || 'WALK-IN') : (data.supplier?.name || data.supplier_name || 'SUPPLIER')).toUpperCase();

    const fmt = (n) => `${Math.round(Number(n))}`;
    const fmtD = (n) => `${Number(n).toFixed(2)}`;

    const lines = [];
    const L = (text, style) => lines.push({ text, style: style || 'normal' });
    const DASH = () => L(repeat('-', W), 'dash');

    // ── Header
    L(center(storeName, W), 'bold-lg');
    
    if (store_address && store_address !== 'Address not configured in Settings') {
        store_address.split('\n').forEach(line => {
            if (line.trim()) L(center(line.trim(), W), 'small');
        });
    }

    let contactLine = '';
    const phone = settings?.phone || settings?.store_mobile || '';
    if (phone) contactLine += `Ph: ${phone}`;
    if (gst_no) contactLine += (contactLine ? ' | ' : '') + `GSTIN: ${gst_no}`;
    if (contactLine) L(center(contactLine, W), 'small');

    DASH();
    L(center(isSale ? 'TAX INVOICE' : 'PURCHASE INVOICE', W), 'normal');

    // ── Invoice Details Info
    const leftColW = 16; // fixed left column width
    
    L(padL(`Bill No: ${invId}`, leftColW) + `POS: 01`);
    L(padL(`Date: ${displayDate.split(' ')[0]}`, leftColW) + `Time: ${displayDate.split(' ').slice(1).join(' ')}`);
    L(padL(`Cash: ${cashier.slice(0, 10)}`, leftColW) + `Cust: ${customer.slice(0, 10)}`);
    
    DASH();

    // ── Items Header
    // For W=32: Sr (3), Item Name (10), Qty (4), Rate (7), Amount (8)
    const srW = 3;
    const qtyW = 4;
    const rateW = 7;
    const amtW = 8;
    const nameW = W - srW - qtyW - rateW - amtW;

    const printItemRow = (sr, name, qty, rate, amt) => {
        const s = padL(sr, srW) + 
                  padL(name, nameW) + 
                  padR(qty, qtyW) + 
                  padR(rate, rateW) + 
                  padR(amt, amtW);
        L(s);
    }

    printItemRow('Sr', 'Item Name', 'Qty', 'Rate', 'Amount');
    DASH();

    let totalQty = 0;
    items.forEach((item, index) => {
        const sr = String(index + 1);
        const name = (item.product?.name || item.name || item.product_name || 'Item').toUpperCase();
        const qty = String(item.quantity);
        totalQty += Number(item.quantity);
        const rate = fmtD(isSale ? item.price : (item.cost || item.cost_price || item.unit_price || item.price || 0));
        const itemSubtotal = item.subtotal || (Number(qty) * Number(rate));
        const amt = fmtD(itemSubtotal);
        
        let remaining = name;
        if (remaining.length <= nameW) {
             printItemRow(sr, remaining, qty, rate, amt);
        } else {
             printItemRow(sr, remaining.slice(0, nameW), qty, rate, amt);
             remaining = remaining.slice(nameW);
             while(remaining.length > 0) {
                 printItemRow('', remaining.slice(0, nameW), '', '', '');
                 remaining = remaining.slice(nameW);
             }
        }
    });

    DASH();

    // ── Summary
    const summaryCol = (label, value, style = 'normal') => {
        const leftIndent = 1;
        const labelStr = ' '.repeat(leftIndent) + label;
        const valueStr = String(value);
        let lw = labelStr.length;
        if (lw > W - 10) lw = W - 10;
        L(labelStr.slice(0, lw) + padR(valueStr, W - lw), style);
    };

    summaryCol('SUB TOTAL', fmtD(data.subtotal || data.taxable_amount || (data.grand_total - (data.tax_amount||0) + (data.discount||0)) || 0));
    if (Number(data.discount) > 0) {
        summaryCol('DISCOUNT', `-${fmtD(data.discount)}`);
    }

    DASH();

    summaryCol('TAXABLE AMOUNT', fmtD(data.taxable_amount || data.subtotal || (data.grand_total - (data.tax_amount||0) + (data.discount||0)) || 0));
    if (data.is_outside_state) {
        summaryCol('IGST', fmtD(data.tax_amount || 0));
    } else {
        const halfTax = (Number(data.tax_amount || 0) / 2).toFixed(2);
        const taxRate = (data.items && data.items[0]?.tax_rate != null) ? Number(data.items[0].tax_rate) : 5;
        const halfRate = taxRate / 2;
        summaryCol(`CGST @ ${halfRate}%`, halfTax);
        summaryCol(`SGST @ ${halfRate}%`, halfTax);
    }

    DASH();

    summaryCol('GRAND TOTAL', `${sym} ${fmtD(data.grand_total || data.total || 0)}`, 'bold');
    
    const tItems = `Total Items: ${items.length}`;
    const tQty = `Total Qty: ${totalQty}`;
    L(padL(tItems, leftColW) + tQty);
    
    DASH();

    // ── Payment Mode
    const paidAmt = data.paid_amount != null ? Number(data.paid_amount) : (data.paid != null ? Number(data.paid) : 0);
    const grandTotal = Number(data.grand_total || data.total || 0);
    const change = paidAmt > grandTotal ? paidAmt - grandTotal : 0;
    
    const payLabelW = 16;
    const printPayInfo = (label, val) => {
        L(padL(label, payLabelW) + ': ' + val);
    };

    printPayInfo('PAYMENT MODE', (data.payment_method || 'CASH').toUpperCase());
    printPayInfo('AMOUNT PAID', `${sym} ${fmtD(paidAmt)}`);
    printPayInfo('CHANGE RETURNED', `${sym} ${fmtD(change)}`);

    L('');

    // ── Footer msg
    if (settings?.receipt_footer) {
        settings.receipt_footer.split('\n').forEach(line => {
            if (line.trim()) L(center(line.trim(), W), 'bold');
        });
    }

    return lines;
}

/**
 * Format receipt text for 58mm printer using exactly the same logic as ThermalReceipt.jsx
 */
export function formatReceipt58mm(sale, settings = {}) {
  const parts = [];

  const addRaw = (data) => {
    if (typeof data === "string") {
      parts.push(hexToUint8Array(data));
    } else {
      parts.push(data);
    }
  };

  const addText = (str) => {
    parts.push(stringToUtf8(str));
  };

  addRaw(ESC.RESET);
  addRaw(ESC.DOUBLE_STRIKE_ON); // Make everything darker

  // Get auth store/user data from settings if possible, or fallback to sale
  const gst_no = settings?.gst_no || sale.store?.gst_no;
  const storeNameStr = settings?.store_name_receipt || settings?.store_name || sale.store?.name || sale.store_name || 'STORE';
  const storeAddressStr = settings?.address || settings?.store_address || sale.store?.address || 'Address not configured in Settings';
  const userNameStr = sale.user?.name || sale.cashier_name || 'ADMIN';
  const type = sale.type || (sale.supplier_name || sale.supplier ? 'purchase' : 'sale');

  const lines = buildLines(type, sale, settings, gst_no, storeNameStr, storeAddressStr, userNameStr);

  lines.forEach(line => {
      // ESC/POS commands based on style
      if (line.style === 'bold-lg') {
          addRaw(ESC.ALIGN_CENTER);
          addRaw(ESC.FONT_SIZE_LARGE);
          addRaw(ESC.BOLD_ON);
          addText(line.text.trim() + '\n');
          addRaw(ESC.BOLD_OFF);
          addRaw(ESC.FONT_SIZE_NORMAL);
          addRaw(ESC.ALIGN_LEFT);
      } else if (line.style === 'bold') {
          addRaw(ESC.BOLD_ON);
          addText(line.text + '\n');
          addRaw(ESC.BOLD_OFF);
      } else if (line.style === 'small') {
          addRaw(ESC.ALIGN_CENTER);
          addText(line.text.trim() + '\n');
          addRaw(ESC.ALIGN_LEFT);
      } else {
          addText(line.text + '\n');
      }
  });

  // Barcode
  const invId = (type === 'sale')
        ? (sale.formatted_id || `INV-${String(sale.id).padStart(5, '0')}`)
        : (sale.reference || `PRCH-${String(sale.id).padStart(5, '0')}`);

  if (invId) {
    addRaw(ESC.ALIGN_CENTER);
    // ESC/POS Code128 Barcode: [GS k m n d1...dn]
    const barcodeData = stringToUtf8(invId);
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

    const escBuffer = formatReceipt58mm(sale, settings);
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
