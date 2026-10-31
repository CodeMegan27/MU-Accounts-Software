// Indian State GST Codes Map
export const GST_STATE_CODES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh"
};

export function getStateFromGstin(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.substring(0, 2);
  return {
    code,
    name: GST_STATE_CODES[code] || "Other State"
  };
}

export function isInterStateSupply(buyerGstin, vendorGstin, defaultBuyerState = "33") {
  const buyerCode = buyerGstin && buyerGstin.length >= 2 ? buyerGstin.substring(0, 2) : defaultBuyerState;
  const vendorCode = vendorGstin && vendorGstin.length >= 2 ? vendorGstin.substring(0, 2) : null;
  
  if (!vendorCode) return false;
  return buyerCode !== vendorCode;
}

export function calculateBillTotals({
  items = [],
  packing = 0,
  discount = 0,
  isGst = false,
  taxType = 'exclusive',
  taxRate = 18,
  isInterState = false,
  isRoundOff = true,
  customSubtotal = null
}) {
  let calculatedSubtotal = 0;
  
  const processedItems = items.map(item => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    // Respect manually altered line item amount if specified
    const hasManualAmount = item.amount !== undefined && item.amount !== null && item.amount !== '' && !isNaN(parseFloat(item.amount));
    const amount = hasManualAmount ? parseFloat(parseFloat(item.amount).toFixed(2)) : parseFloat((qty * rate).toFixed(2));
    calculatedSubtotal += amount;
    return {
      ...item,
      qty,
      rate,
      amount
    };
  });

  // Use customSubtotal if manually entered, otherwise use calculated sum
  const subtotal = customSubtotal !== null && customSubtotal !== undefined && customSubtotal !== '' && !isNaN(parseFloat(customSubtotal))
    ? parseFloat(parseFloat(customSubtotal).toFixed(2))
    : calculatedSubtotal;

  const p = parseFloat(packing) || 0;
  const d = parseFloat(discount) || 0;
  let taxableBase = subtotal + p - d;
  if (taxableBase < 0) taxableBase = 0;

  let taxAmount = 0;
  let unroundedTotal = taxableBase;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const rate = parseFloat(taxRate) || 0;

  if (isGst && rate > 0) {
    if (taxType === 'inclusive') {
      const baseWithoutTax = taxableBase / (1 + (rate / 100));
      taxAmount = taxableBase - baseWithoutTax;
      unroundedTotal = taxableBase;
      taxableBase = baseWithoutTax;
    } else {
      taxAmount = taxableBase * (rate / 100);
      unroundedTotal = taxableBase + taxAmount;
    }

    if (isInterState) {
      igst = taxAmount;
    } else {
      cgst = taxAmount / 2;
      sgst = taxAmount / 2;
    }
  }

  // Round Off Feature: calculate exact round off to nearest rupee
  let roundOff = 0;
  let grandTotal = unroundedTotal;

  if (isRoundOff) {
    const rounded = Math.round(unroundedTotal);
    roundOff = parseFloat((rounded - unroundedTotal).toFixed(2));
    grandTotal = rounded;
  } else {
    grandTotal = parseFloat(unroundedTotal.toFixed(2));
  }

  return {
    subtotal,
    taxableBase,
    packing: p,
    discount: d,
    taxAmount,
    cgst,
    sgst,
    igst,
    roundOff,
    unroundedTotal,
    grandTotal,
    items: processedItems
  };
}
