// Starter knowledge base, created once when no SYSTEM documents exist.
// Policies are sample defaults; owners can edit or replace them from the Knowledge Base screen.

export const DEFAULT_KNOWLEDGE: Array<{ title: string; category: string; content: string }> = [
  {
    title: 'ShopOS User Guide',
    category: 'GUIDE',
    content: `# POS Billing
Open POS Billing from the sidebar. Scan a barcode or type a product name, SKU or alias in the search box (Ctrl+Space focuses it). Press Enter to add the highlighted product to the cart. Select a customer with the customer search on the right; walk-in sales need no customer.
Choose a payment method: CASH, UPI, CARD or CREDIT. CREDIT is only available when a customer with a credit limit is selected. Press F2 to check out. F4 toggles Quote Mode, which saves a quote without taking stock out.

# Prices and approvals
Every product has four price levels. Level 1 is the ideal selling price, Level 2 is the default price billers use, Level 3 is the minimum selling price and the Emergency price is the absolute floor.
Selling below Level 3 creates a bill with status PENDING_APPROVAL that a manager must approve. Selling below cost needs the owner's approval. The cashier sees a waiting screen until the approval is decided. Managers and owners review requests in the Approval Center.

# Order History
Order History lists every bill and quote. Filter by period (today, 7 days, 30 days, all time), status and payment method, or search by bill number, customer name or phone. Click a bill to see items, GST, payments, returns and approvals. From a finalized bill you can start a return.

# Returns
Open the Return Center, enter the bill number and choose the quantity and disposition for each item: RETURN_TO_STOCK puts the item back in inventory, DAMAGED and WARRANTY do not. Refunds for credit customers reduce their ledger balance.

# Customer and supplier ledgers
Customer Ledgers show what each customer owes. Record a payment against a customer to reduce their balance. Supplier Ledgers show what the shop owes suppliers. Credit limits can only be set or changed by the owner.

# Day sessions and cash drawer
Open a day session each morning with the opening cash count. Cash sales, deposits, withdrawals and expenses paid from the drawer are tracked against the session. When closing, count the cash: if the difference from expected cash is more than the threshold (default ₹500) the session needs owner approval.

# Expenses and reminders
Log Expense records shop expenses such as tea, transport, electricity, rent or salary, optionally paid from the cash drawer. Reminders track due dates for GST filing, supplier payments, customer dues, licences and insurance.

# Roles
OWNER can do everything, including seeing cost prices and profit, setting credit limits and approving loss sales. MANAGER can manage stock and prices, approve below-minimum prices and record supplier payments. CASHIER can bill, take customer payments, add customers and log expenses.

# AI assistant
The assistant can look things up, answer questions about sales and stock, and carry out tasks such as creating bills, recording payments or adding expenses. Any change to data is shown as a confirmation card first and only happens after you press Confirm.`,
  },
  {
    title: 'Store Policy: Returns, Refunds and Warranty (sample)',
    category: 'POLICY',
    content: `# Return window
Items can be returned within 7 days of purchase with the original bill. Electrical items that have been installed or used cannot be returned unless faulty.

# Condition
Returned items must be unused and in their original packaging to be put back into stock. Opened or damaged items are recorded with disposition DAMAGED.

# Refunds
Cash and UPI purchases are refunded in the same mode. Card refunds go back to the card. For credit (khata) customers the refund is adjusted against their outstanding balance.

# Warranty claims
Products under manufacturer warranty (fans, MCBs, drills, batteries) are accepted for warranty with the bill and recorded with disposition WARRANTY. The shop sends them to the brand service centre; replacement usually takes 7 to 15 days. Batteries need the warranty card.

# Non-returnable items
Cut lengths of wire and cable, paints that have been tinted, adhesives that have been opened, and items sold at clearance or emergency prices are not returnable.`,
  },
  {
    title: 'Store Policy: Credit and Payments (sample)',
    category: 'POLICY',
    content: `# Who gets credit
Credit (khata) is offered only to registered business customers such as contractors, garages and wholesale buyers. Retail walk-in customers pay in full.

# Credit limits
The owner sets each customer's credit limit. A sale that would take a customer over their limit is blocked. Contractors typically get ₹50,000 to ₹1,50,000; small retail buyers up to ₹5,000.

# Payment terms
Credit bills are due within 30 days. Customers with dues older than 45 days should not be given further credit until they pay. Send a reminder when a balance is more than ₹10,000 or older than 30 days.

# Accepted payment modes
Cash, UPI, debit and credit cards. Split payments are allowed. Cheques are accepted only from known business customers.`,
  },
  {
    title: 'Store Policy: Pricing, Discounts and GST (sample)',
    category: 'POLICY',
    content: `# Discounts
Billers may sell at Level 2 price by default and go down to Level 3 for regular customers. Below Level 3 requires a manager's approval; below cost requires the owner's approval.
Wholesale and contractor customers are billed at Level 2. Distributors may get extra discounts only with owner approval.

# GST
Most electrical, hardware, plumbing and paint items carry 18% GST (9% CGST + 9% SGST for sales within the state). Auto spares such as spark plugs, filters, brake pads and batteries carry 28% GST. Always enter the customer's GSTIN on bills for registered businesses so they can claim input credit.

# GST filing
GSTR-1 (outward sales) is due on the 11th of the following month. GSTR-3B (summary return and tax payment) is due on the 20th of the following month.`,
  },
  {
    title: 'Store Operations: Daily Checklist (sample)',
    category: 'GUIDE',
    content: `# Opening
Open the day session with the cash count from the safe (usually ₹2,000 float). Check pending approvals and today's reminders.

# During the day
Bill every sale, including small ones. Record tea, transport and other petty expenses as they happen. Re-order items that show as low stock.

# Closing
Count the cash drawer and close the day session. Any difference above ₹500 must be explained in the closing notes. Deposit excess cash above the float.

# Weekly
Review customers with overdue balances and call them. Check supplier dues and plan payments. Review slow-moving stock.`,
  },
];
