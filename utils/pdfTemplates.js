export const generateModernA4HTML = (data, products = [], isSale = true, settings = {}) => {
  const sName = settings.store_name || data.store_name || "StoreManage";
  const storeAddress = settings.store_address || settings.address || "";
  const storePhone = settings.store_mobile || settings.phone || "";
  const storeGst = settings.gst_no || "";
  const ref = data.reference || data.id || "N/A";
  const docDate = data.sale_date || data.purchase_date || new Date().toISOString().split("T")[0];
  const participant = data.customer_display_name || data.supplier_name || (isSale ? "Walk-in Customer" : "Supplier");
  const payMethod = data.payment_method || "Cash";
  const payStatus = data.payment_status || "Paid";
  const isOutside = !!data.is_outside_state;

  const subtotalVal = Number(data.subtotal || 0);
  const taxAmountVal = Number(data.tax_amount || data.tax || 0);
  const discountVal = Number(data.discount || 0);
  const grandTotalVal = Number(data.grand_total || 0);
  const paidAmountVal = Number(data.paid_amount || 0);
  const roundOffVal = Number(data.round_off || 0);

  const itemRows = (data.items || []).map((item, idx) => {
    const prod = products.find((p) => p.id === item.product_id);
    const name = item.name || prod?.name || `Item ${idx + 1}`;
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || item.unit_price || item.cost || 0);
    const taxRate = Number(item.tax_rate || 0);
    const discount = Number(item.discount || 0);
    const subtotal = Number(item.subtotal || 0);
    const taxLabel = isOutside
      ? `IGST ${taxRate}%`
      : `CGST ${taxRate / 2}% + SGST ${taxRate / 2}%`;

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${name}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">₹${price.toFixed(2)}</td>
        <td style="text-align:center">${discount > 0 ? `₹${discount.toFixed(2)}` : "—"}</td>
        <td style="text-align:center;font-size:10px">${taxRate > 0 ? taxLabel : "—"}</td>
        <td style="text-align:right;color:#f97316;font-weight:700">₹${subtotal.toFixed(2)}</td>
      </tr>`;
  }).join("");

  const cgst = isOutside ? 0 : taxAmountVal / 2;
  const sgst = isOutside ? 0 : taxAmountVal / 2;
  const igst = isOutside ? taxAmountVal : 0;

  const taxBreakdown = isOutside
    ? `<div class="tax-row"><span>IGST:</span><span>₹${igst.toFixed(2)}</span></div>`
    : `<div class="tax-row"><span>CGST:</span><span>₹${cgst.toFixed(2)}</span></div>
       <div class="tax-row"><span>SGST:</span><span>₹${sgst.toFixed(2)}</span></div>`;

  const balanceDue = Math.max(0, grandTotalVal - paidAmountVal);
  const changeReturned = Math.max(0, paidAmountVal - grandTotalVal);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Invoice ${ref}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #f97316; padding-bottom: 24px; }
  .brand-name { font-size: 28px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
  .brand-sub { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; }
  .invoice-badge { background: #f97316; color: #fff; padding: 8px 20px; border-radius: 8px; text-align: right; }
  .invoice-badge .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }
  .invoice-badge .ref { font-size: 18px; font-weight: 900; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
  .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
  .meta-box .title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 6px; }
  .meta-box .value { font-size: 14px; font-weight: 700; color: #1e293b; }
  .meta-box .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #1e293b; color: #fff; padding: 10px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child { border-radius: 0 8px 0 0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: middle; }
  .totals-section { display: flex; justify-content: flex-end; }
  .totals-box { width: 320px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #475569; border-bottom: 1px solid #f1f5f9; }
  .totals-row span:last-child { font-weight: 700; }
  .tax-row { display: flex; justify-content: space-between; padding: 4px 0 4px 16px; font-size: 11px; color: #64748b; }
  .grand-total-row { display: flex; justify-content: space-between; padding: 12px 0 8px; font-size: 16px; font-weight: 900; color: #f97316; border-top: 2px solid #f97316; margin-top: 4px; }
  .paid-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #16a34a; font-weight: 700; }
  .balance-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #ef4444; font-weight: 700; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-paid { background: #dcfce7; color: #16a34a; }
  .badge-partial { background: #fef3c7; color: #d97706; }
  .badge-unpaid { background: #fee2e2; color: #dc2626; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  .footer strong { color: #f97316; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand-name">${sName}</div>
    <div class="brand-sub">GST Tax Invoice</div>
    ${storeAddress ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${storeAddress}</div>` : ""}
    ${storePhone ? `<div style="font-size:11px;color:#64748b">Ph: ${storePhone}</div>` : ""}
    ${storeGst ? `<div style="font-size:11px;color:#64748b;font-weight:700">GSTIN: ${storeGst}</div>` : ""}
  </div>
  <div class="invoice-badge">
    <div class="label">${isSale ? "Invoice" : "Purchase Order"}</div>
    <div class="ref">${ref}</div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-box">
    <div class="title">${isSale ? "Bill To" : "Supplier"}</div>
    <div class="value">${participant}</div>
  </div>
  <div class="meta-box">
    <div class="title">Invoice Details</div>
    <div class="value">${docDate}</div>
    <div class="sub">Payment: ${payMethod} &nbsp;|&nbsp; <span class="status-badge badge-${payStatus.toLowerCase()}">${payStatus}</span></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Item Description</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Rate</th>
      <th style="text-align:center">Discount</th>
      <th style="text-align:center">Tax</th>
      <th style="text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals-section">
  <div class="totals-box">
    <div class="totals-row"><span>Taxable Subtotal</span><span>₹${subtotalVal.toFixed(2)}</span></div>
    ${taxBreakdown}
    ${discountVal > 0 ? `<div class="totals-row" style="color:#ef4444"><span>Discount</span><span>-₹${discountVal.toFixed(2)}</span></div>` : ""}
    ${Math.abs(roundOffVal) > 0 ? `<div class="totals-row"><span>Round Off</span><span>${roundOffVal > 0 ? '+' : ''}₹${roundOffVal.toFixed(2)}</span></div>` : ""}
    <div class="grand-total-row"><span>GRAND TOTAL</span><span>₹${grandTotalVal.toFixed(2)}</span></div>
    <div class="paid-row"><span>Amount Paid</span><span>₹${paidAmountVal.toFixed(2)}</span></div>
    ${changeReturned > 0 ? `<div class="paid-row"><span>Change Returned</span><span>₹${changeReturned.toFixed(2)}</span></div>` : ""}
    ${balanceDue > 0 ? `<div class="balance-row"><span>Balance Due</span><span>₹${balanceDue.toFixed(2)}</span></div>` : ""}
  </div>
</div>

<div class="footer">
  Thank you for your business! &mdash; Powered by <strong>StoreManage by Fillosoft</strong>
</div>
</body>
</html>`;
};

export const generateClassicA4HTML = (data, products = [], isSale = true, settings = {}) => {
  const storeName = settings.store_name || data.store_name || settings.store_name_receipt || "Store";
  const ref = data.reference || data.id || "N/A";
  const docDate = data.sale_date || data.purchase_date || new Date().toISOString().split("T")[0];
  const participant = data.customer_display_name || data.supplier_name || (isSale ? "Walk-in Customer" : "Supplier");
  const address = settings.store_address || settings.address || "";
  const phone = settings.store_mobile || settings.phone || "";
  const email = settings.email || "";
  const gst_no = settings.gst_no || "";

  const subtotalVal = Number(data.subtotal || 0);
  const taxAmountVal = Number(data.tax_amount || data.tax || 0);
  const discountVal = Number(data.discount || 0);
  const grandTotalVal = Number(data.grand_total || 0);
  const paidAmountVal = Number(data.paid_amount || 0);
  const roundOffVal = Number(data.round_off || 0);
  const isOutside = !!data.is_outside_state;

  const totalQty = (data.items || []).reduce((s, i) => s + Number(i.quantity), 0);

  const itemRows = (data.items || []).map((item, idx) => {
    const prod = products.find((p) => p.id === item.product_id);
    const name = item.name || prod?.name || `Item ${idx + 1}`;
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || item.unit_price || item.cost || 0);
    const discount = Number(item.discount || 0);
    const tax = Number(item.tax || 0);
    const taxRate = Number(item.tax_rate || 0);
    const subtotal = Number(item.subtotal || 0);
    const unit = item.unit || prod?.unit || "pcs";

    return `
      <tr>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; font-weight: bold;">${name}</td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; text-align: center;">${qty}</td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; text-align: right;">₹${price.toFixed(2)}</td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; text-align: center;">${unit}</td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; text-align: right;">₹${discount.toFixed(2)}</td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; border-right: 2px solid #000; text-align: right;">₹${tax.toFixed(2)}<br /><span style="font-size: 9px; color: #555">(${taxRate}%)</span></td>
        <td style="padding: 8px; font-size: 12px; border-bottom: 1px solid #d1d5db; text-align: right; font-weight: bold;">₹${subtotal.toFixed(2)}</td>
      </tr>`;
  }).join("");

  const balanceDue = Math.max(0, grandTotalVal - paidAmountVal);
  const refundAmount = (data.returns || []).reduce((s, r) => s + Number(r.cash_refund || 0), 0);
  
  let taxesHtml = "";
  if (taxAmountVal > 0) {
    if (isOutside) {
      taxesHtml = `
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">IGST:</span>
          <span style="font-weight: bold;">₹${taxAmountVal.toFixed(2)}</span>
        </div>`;
    } else {
      taxesHtml = `
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">CGST:</span>
          <span style="font-weight: bold;">₹${(taxAmountVal / 2).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">SGST:</span>
          <span style="font-weight: bold;">₹${(taxAmountVal / 2).toFixed(2)}</span>
        </div>`;
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${ref}</title>
</head>
<body style="margin: 0; padding: 32px; background: #fff;">
  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; width: 100%; max-width: 210mm; margin: 0 auto; border: 2px solid #000; box-sizing: border-box;">
    <div style="text-align: center; border-bottom: 2px solid #000; padding: 10px 0;">
      <h1 style="font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 0;">${isSale ? "Sales Invoice" : "Purchase Invoice"}</h1>
    </div>

    <div style="display: flex; border-bottom: 2px solid #000;">
      <div style="width: 50%; padding: 12px; border-right: 2px solid #000; box-sizing: border-box;">
        <div style="font-weight: bold; text-transform: uppercase; font-size: 13px; margin-bottom: 6px;">${storeName}</div>
        <div style="font-size: 11px; margin-bottom: 2px;">${address}</div>
        <div style="font-size: 11px; margin-bottom: 2px;">Phone: ${phone}</div>
        <div style="font-size: 11px; margin-bottom: 2px;">Email: ${email}</div>
        ${gst_no ? `<div style="font-size: 11px; margin-bottom: 2px;">GST: <strong>${gst_no}</strong></div>` : ""}
      </div>
      <div style="width: 50%; display: flex; flex-direction: column; box-sizing: border-box;">
        <div style="display: flex; border-bottom: 2px solid #000;">
          <div style="width: 50%; padding: 6px 8px; box-sizing: border-box;">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 2px;">Document No.</div>
            <div style="font-weight: bold; font-size: 12px;">${ref}</div>
          </div>
          <div style="width: 50%; padding: 6px 8px; border-left: 2px solid #000; box-sizing: border-box;">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 2px;">Dated</div>
            <div style="font-weight: bold; font-size: 12px;">${docDate}</div>
          </div>
        </div>
        <div style="display: flex;">
          <div style="width: 50%; padding: 6px 8px; box-sizing: border-box;">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 2px;">Payment Mode</div>
            <div style="font-weight: bold; font-size: 12px;">${(data.payment_method || "cash").replace('_', ' ').toUpperCase()}</div>
          </div>
          <div style="width: 50%; padding: 6px 8px; border-left: 2px solid #000; box-sizing: border-box;">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 2px;">Status</div>
            <div style="font-weight: bold; font-size: 12px;">${(data.payment_status || "paid").toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="padding: 12px; border-bottom: 2px solid #000; min-height: 80px;">
      <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 4px;">${isSale ? "Buyer (Bill to)" : "Supplier (Bill from)"}</div>
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 2px;">${participant}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; border-bottom: none;">
      <thead>
        <tr>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 5%; text-align: center;">Sl.</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 34%; text-align: left;">Description of Goods</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 9%; text-align: center;">Qty</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 12%; text-align: right;">Rate</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 8%; text-align: center;">Per</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 10%; text-align: right;">Disc</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; border-right: 2px solid #000; width: 12%; text-align: right;">GST</th>
          <th style="padding: 6px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #f3f4f6; border-bottom: 2px solid #000; width: 10%; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="display: flex; border-top: 2px solid #000;">
      <div style="width: 66.66%; padding: 16px; border-right: 2px solid #000; box-sizing: border-box; font-size: 11px;">
        <p style="font-weight: bold; text-decoration: underline; margin-bottom: 6px;">Declaration:</p>
        <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
      </div>
      <div style="width: 33.33%; padding: 12px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">Subtotal:</span>
          <span style="font-weight: bold;">₹${subtotalVal.toFixed(2)}</span>
        </div>
        ${taxesHtml}
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">Total Tax:</span>
          <span style="font-weight: bold;">₹${taxAmountVal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">Discount:</span>
          <span style="font-weight: bold; color: #dc2626;">-₹${discountVal.toFixed(2)}</span>
        </div>
        ${Math.abs(roundOffVal) > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: #555;">Round Off:</span>
          <span style="font-weight: bold;">${roundOffVal >= 0 ? '+' : ''}₹${Math.abs(roundOffVal).toFixed(2)}</span>
        </div>` : ""}

        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; padding: 10px 0; border-top: 2px solid #000; margin-top: 6px;">
          <span>BILL TOTAL</span>
          <span>₹${grandTotalVal.toFixed(2)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; padding: 4px 0; border-top: 1px dashed #9ca3af; margin-top: 6px;">
          <span>Amount Paid</span>
          <span>₹${paidAmountVal.toFixed(2)}</span>
        </div>
        ${refundAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: #2563eb;">
          <span>Refund Given</span>
          <span>₹${refundAmount.toFixed(2)}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-top: 1px solid #d1d5db; margin-top: 4px; color: #4b5563;">
          <span>Balance Due</span>
          <span style="font-weight: bold;">₹${balanceDue.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div style="padding: 6px 12px; border-top: 2px solid #000; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold;">
      <span>Items: ${(data.items || []).length}</span>
      <span>Total Qty: ${totalQty}</span>
    </div>

    <div style="padding: 16px; border-top: 2px solid #000; text-align: right; min-height: 80px; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end;">
      <p style="font-weight: bold; font-size: 11px; text-transform: uppercase;">for ${storeName}</p>
      <div style="margin-top: 32px; border-top: 1px solid #000; width: 180px; padding-top: 4px; text-align: center;">
        <p style="font-size: 9px; text-transform: uppercase; font-weight: bold;">Authorized Signatory</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};
