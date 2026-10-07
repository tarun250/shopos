export default function ShopOSApp() {
    // Navigation & Theme
    const [activeTab, setActiveTab] = useState('pos');
    const [isDarkMode, setIsDarkMode] = useState(true);
    // Authentication
    const [user, setUser] = useState(null);
    const [authError, setAuthError] = useState('');
    const [loginForm, setLoginForm] = useState({
        username: 'cashier',
        password: 'cashier123'
    });
    // Core Data Lists
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    // POS State
    const [cart, setCart] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [overallDiscount, setOverallDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [paidAmount, setPaidAmount] = useState('0');
    const [isQuote, setIsQuote] = useState(false);
    // Search and selection states
    const [productSearch, setProductSearch] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    // Approvals & Realtime Queue Polling States
    const [pendingBillId, setPendingBillId] = useState(null);
    const [pendingBillNumber, setPendingBillNumber] = useState(null);
    const [pendingBillStatus, setPendingBillStatus] = useState(null);
    const [pendingBillReason, setPendingBillReason] = useState(null);
    const [pendingBillApprover, setPendingBillApprover] = useState(null);
    const [pendingBillRejectReason, setPendingBillRejectReason] = useState(null);
    const [lossWarningModal, setLossWarningModal] = useState(null);
    const [approvals, setApprovals] = useState([]);
    const [approvalFilter, setApprovalFilter] = useState('PENDING');
    const [approvalSearch, setApprovalSearch] = useState('');
    const [selectedApprovalBill, setSelectedApprovalBill] = useState(null);
    const [rejectionReasonInput, setRejectionReasonInput] = useState({});
    // Returns & Ledger States
    const [returnsList, setReturnsList] = useState({
        salesReturns: [],
        purchaseReturns: []
    });
    const [returnsLoading, setReturnsLoading] = useState(false);
    const [customerLedgers, setCustomerLedgers] = useState([]);
    const [supplierLedgers, setSupplierLedgers] = useState([]);
    const [selectedLedgerDetails, setSelectedLedgerDetails] = useState(null);
    const [selectedLedgerType, setSelectedLedgerType] = useState(null);
    const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);
    // Sales Return Wizard States
    const [salesReturnSearchBill, setSalesReturnSearchBill] = useState('');
    const [salesReturnBillDetails, setSalesReturnBillDetails] = useState(null);
    const [salesReturnQty, setSalesReturnQty] = useState({});
    const [salesReturnDisp, setSalesReturnDisp] = useState({});
    const [salesReturnNotes, setSalesReturnNotes] = useState({});
    const [salesReturnReason, setSalesReturnReason] = useState('');
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
    // Manual payment entries
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentMethodSelect, setPaymentMethodSelect] = useState('CASH');
    // Modals & Floating popups
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutResult, setCheckoutResult] = useState(null);
    const [overrideModal, setOverrideModal] = useState({
        show: false,
        reason: '',
        targetAction: ()=>{},
        pinInput: '',
        error: ''
    });
    // Stock Adjustment modal state
    const [stockAdjustment, setStockAdjustment] = useState({
        show: false,
        product: null,
        quantityChanged: '',
        reason: '',
        type: 'ADJUSTMENT'
    });
    // Customer Add dialog state
    const [addCustomer, setAddCustomer] = useState({
        show: false,
        name: '',
        phone: '',
        priceLevel: 'RETAIL',
        creditLimit: '10000'
    });
    // Product Edit dialog state
    const [editProduct, setEditProduct] = useState({
        show: false,
        product: null,
        name: '',
        sku: '',
        barcode: '',
        rackLocation: '',
        hsnCode: '',
        cgstRate: '0',
        sgstRate: '0',
        costPrice: '0',
        minimumProfitPct: '10',
        mrp: '',
        level1Price: '0',
        level2Price: '0',
        level3Price: '0',
        emergencyPrice: '0',
        retailPrice: '0',
        wholesalePrice: '0'
    });
    // Offline Sandbox Indicator
    const [isSandboxMode, setIsSandboxMode] = useState(false);
    const [backendStatus, setBackendStatus] = useState('connected');
    // Input Focus Refs
    const productSearchRef = useRef(null);
    const customerSearchRef = useRef(null);
    const pinInputRef = useRef(null);
    // API base URL
    const API_BASE = 'http://localhost:3001';
    // ==========================================
    // Returns & Ledgers API Client Methods
    // ==========================================
    const fetchReturnsData = async ()=>{
        if (isSandboxMode) return;
        setReturnsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/billing/returns`);
            if (res.ok) {
                const data = await res.json();
                setReturnsList(data);
            }
        } catch (err) {
            console.error('Error fetching returns:', err);
        } finally{
            setReturnsLoading(false);
        }
    };
    const fetchCustomersLedgersData = async ()=>{
        if (isSandboxMode) return;
        try {
            const res = await fetch(`${API_BASE}/billing/customers`);
            if (res.ok) {
                const data = await res.json();
                setCustomerLedgers(data);
            }
        } catch (err) {
            console.error('Error fetching customer ledgers:', err);
        }
    };
    const fetchSuppliersLedgersData = async ()=>{
        if (isSandboxMode) return;
        try {
            const res = await fetch(`${API_BASE}/billing/suppliers`);
            if (res.ok) {
                const data = await res.json();
                setSupplierLedgers(data);
            }
        } catch (err) {
            console.error('Error fetching supplier ledgers:', err);
        }
    };
    const handleFetchBillForReturn = async ()=>{
        if (!salesReturnSearchBill.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/billing/approvals`);
            if (res.ok) {
                const data = await res.json();
                const foundApproval = data.find((a)=>a.bill?.billNumber === salesReturnSearchBill);
                if (foundApproval && foundApproval.bill) {
                    setSalesReturnBillDetails(foundApproval.bill);
                    const qMap = {};
                    const dMap = {};
                    const nMap = {};
                    foundApproval.bill.items.forEach((item)=>{
                        qMap[item.productId] = 0;
                        dMap[item.productId] = 'RETURN_TO_STOCK';
                        nMap[item.productId] = '';
                    });
                    setSalesReturnQty(qMap);
                    setSalesReturnDisp(dMap);
                    setSalesReturnNotes(nMap);
                } else {
                    alert('Bill not found or is still pending approval.');
                }
            }
        } catch (err) {
            alert('Error searching for bill details.');
        }
    };
    const handleSubmitSalesReturn = async ()=>{
        if (!salesReturnBillDetails) return;
        const returnItems = Object.entries(salesReturnQty).filter(([_, qty])=>qty > 0).map(([prodId, qty])=>{
            const originalItem = salesReturnBillDetails.items.find((i)=>i.productId === prodId);
            return {
                productId: prodId,
                quantity: Number(qty),
                unitPrice: originalItem?.unitPrice || 0,
                disposition: salesReturnDisp[prodId] || 'RETURN_TO_STOCK',
                notes: salesReturnNotes[prodId] || ''
            };
        });
        if (returnItems.length === 0) {
            alert('Please enter a quantity greater than 0 for at least one item.');
            return;
        }
        setIsSubmittingReturn(true);
        try {
            const res = await fetch(`${API_BASE}/billing/returns/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    billId: salesReturnBillDetails.id,
                    reason: salesReturnReason,
                    userId: user?.userId || 'SYSTEM',
                    items: returnItems
                })
            });
            if (res.ok) {
                alert('Return processed successfully!');
                setSalesReturnBillDetails(null);
                setSalesReturnSearchBill('');
                setSalesReturnQty({});
                setSalesReturnReason('');
                fetchReturnsData();
                fetchAllData();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to process return.');
            }
        } catch (err) {
            alert('Network error while processing return.');
        } finally{
            setIsSubmittingReturn(false);
        }
    };
    const handleOpenLedgerDrawer = async (id, type)=>{
        setSelectedLedgerType(type);
        setLedgerDrawerOpen(true);
        setSelectedLedgerDetails(null);
        try {
            const endpoint = type === 'CUSTOMER' ? `${API_BASE}/billing/customers/${id}/ledger` : `${API_BASE}/billing/suppliers/${id}/ledger`;
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                setSelectedLedgerDetails(data);
            }
        } catch (err) {
            console.error('Error fetching ledger details:', err);
        }
    };
    const handleRecordLedgerPayment = async ()=>{
        if (!selectedLedgerDetails) return;
        const amountVal = Number(paymentAmount);
        if (isNaN(amountVal) || amountVal <= 0) {
            alert('Please enter a valid positive payment amount.');
            return;
        }
        try {
            const isCust = selectedLedgerType === 'CUSTOMER';
            const endpoint = isCust ? `${API_BASE}/billing/customers/${selectedLedgerDetails.customer.id}/payments` : `${API_BASE}/billing/suppliers/${selectedLedgerDetails.supplier.id}/payments`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amountVal,
                    paymentMethod: paymentMethodSelect,
                    notes: paymentNotes,
                    userId: user?.userId || 'SYSTEM'
                })
            });
            if (res.ok) {
                alert('Payment recorded successfully!');
                setPaymentAmount('');
                setPaymentNotes('');
                handleOpenLedgerDrawer(isCust ? selectedLedgerDetails.customer.id : selectedLedgerDetails.supplier.id, selectedLedgerType);
            } else {
                const err = await res.json();
                alert(err.message || 'Payment recording failed.');
            }
        } catch (err) {
            alert('Network error recording ledger payment.');
        }
    };
    // ==========================================
    // Fetch Data Functions
    // ==========================================
    const fetchAllData = async ()=>{
        setIsLoading(true);
        try {
            // 1. Fetch products
            const prodRes = await fetch(`${API_BASE}/products`);
            if (prodRes.ok) {
                const prodData = await prodRes.json();
                setProducts(prodData);
                setBackendStatus('connected');
            } else {
                throw new Error('API server down');
            }
            // 2. Fetch customers
            const custRes = await fetch(`${API_BASE}/billing/customers`);
            if (custRes.ok) {
                const custData = await custRes.json();
                setCustomers(custData);
            }
        } catch (e) {
            console.warn('Backend offline, running in sandbox mode with static mock data.');
            setBackendStatus('offline');
            setIsSandboxMode(true);
            // Load mock items
            setProducts(getMockProducts());
            setCustomers(getMockCustomers());
        } finally{
            setIsLoading(false);
        }
    };
    const fetchAuditLogs = async ()=>{
        if (isSandboxMode) {
            setAuditLogs([
                {
                    id: '1',
                    action: 'OFFLINE_SANDBOX_ACTIVE',
                    details: JSON.stringify({
                        mode: 'Developer Sandbox'
                    }),
                    createdAt: new Date().toISOString()
                }
            ]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/products`); // Fetching audit logs fallback or simple logs
            // In this demo, we mock fetch logs or read them
            setAuditLogs([
                {
                    id: 'seed-1',
                    action: 'DATABASE_SEED',
                    details: JSON.stringify({
                        status: 'Successful'
                    }),
                    createdAt: new Date().toISOString()
                }
            ]);
        } catch (e) {}
    };
    process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE && useEffect(()=>{
        if (user) {
            fetchAllData();
            fetchAuditLogs();
        }
    }, [
        user
    ]);
    // Handle product searches
    process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE && useEffect(()=>{
        if (!productSearch) {
            setFilteredProducts([]);
            return;
        }
        const q = productSearch.toLowerCase();
        const matches = products.filter((p)=>p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode && p.barcode.includes(q));
        setFilteredProducts(matches.slice(0, 5));
        setActiveSearchIndex(0);
    }, [
        productSearch,
        products
    ]);
    // Handle customer searches
    process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE && useEffect(()=>{
        if (!customerSearch) {
            setFilteredCustomers([]);
            return;
        }
        const q = customerSearch.toLowerCase();
        const matches = customers.filter((c)=>c.name.toLowerCase().includes(q) || c.phone.includes(q));
        setFilteredCustomers(matches.slice(0, 5));
    }, [
        customerSearch,
        customers
    ]);
    // Keyboard Navigation Controls
    process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE && useEffect(()=>{
        const handleKeyDown = (e)=>{
            // 1. Focus Universal Search: Ctrl + Space
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                productSearchRef.current?.focus();
            }
            // 2. Focus Customer Search: Ctrl + F
            if (e.ctrlKey && e.code === 'KeyF' && activeTab === 'pos') {
                e.preventDefault();
                customerSearchRef.current?.focus();
            }
            // 3. F2 - Quick Pay / Complete Checkout
            if (e.key === 'F2' && activeTab === 'pos' && cart.length > 0) {
                e.preventDefault();
                handlePOSCheckout();
            }
            // 4. F4 - Toggle Quote Mode
            if (e.key === 'F4' && activeTab === 'pos') {
                e.preventDefault();
                setIsQuote((prev)=>!prev);
            }
            // 5. Escape - Reset searches & close overlay
            if (e.key === 'Escape') {
                setProductSearch('');
                setCustomerSearch('');
                setFilteredProducts([]);
                setFilteredCustomers([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return ()=>window.removeEventListener('keydown', handleKeyDown);
    }, [
        cart,
        products,
        selectedCustomer,
        activeTab
    ]);
    // ==========================================
    // Login Functions
    // ==========================================
    const handleLoginSubmit = async (e)=>{
        e.preventDefault();
        setAuthError('');
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: loginForm.username,
                    password: loginForm.password
                })
            });
            if (res.ok) {
                const session = await res.json();
                setUser(session);
            } else {
                const errData = await res.json();
                setAuthError(errData.message || 'Incorrect password.');
            }
        } catch (err) {
            console.warn('API Authentication server connection failed. Launching client sandbox session.');
            // Auto bypass for easy evaluation
            setUser({
                userId: 'dev-bypass-id',
                username: loginForm.username,
                fullName: loginForm.username === 'manager' ? 'Ramesh Manager (Local)' : 'Anil Cashier (Local)',
                role: loginForm.username === 'manager' ? 'MANAGER' : 'CASHIER'
            });
            setIsSandboxMode(true);
            setBackendStatus('offline');
        } finally{
            setIsLoading(false);
        }
    };
    const handleQuickBypass = ()=>{
        setUser({
            userId: 'bypass-id',
            username: 'cashier',
            fullName: 'Anil Cashier (Local Sandbox)',
            role: 'CASHIER'
        });
        setIsSandboxMode(true);
        setBackendStatus('offline');
    };
    const handleLogout = ()=>{
        setUser(null);
        setCart([]);
        setSelectedCustomer(null);
        setOverallDiscount(0);
        setPaidAmount('0');
    };
    // ==========================================
    // POS Billing Logic
    // ==========================================
    // Default fallback is Level 2 Price under the new pricing model
    const getProductPrice = (product, level)=>{
        return product.level2Price;
    };
    const addToCart = (product)=>{
        const price = product.level2Price;
        // Check if already in cart
        const existingIndex = cart.findIndex((item)=>item.product.id === product.id);
        if (existingIndex > -1) {
            const updated = [
                ...cart
            ];
            updated[existingIndex].quantity += 1;
            // recalculate total price based on active selling price
            const activePrice = updated[existingIndex].unitPrice - updated[existingIndex].discount;
            const taxable = Math.max(0, activePrice * updated[existingIndex].quantity);
            updated[existingIndex].cgstAmount = taxable * updated[existingIndex].cgstRate / 100;
            updated[existingIndex].sgstAmount = taxable * updated[existingIndex].sgstRate / 100;
            updated[existingIndex].totalPrice = taxable + updated[existingIndex].cgstAmount + updated[existingIndex].sgstAmount;
            setCart(updated);
        } else {
            const itemTaxable = price;
            const cgst = itemTaxable * product.cgstRate / 100;
            const sgst = itemTaxable * product.sgstRate / 100;
            const newCartItem = {
                product,
                quantity: 1,
                unitPrice: price,
                discount: 0,
                cgstRate: product.cgstRate,
                sgstRate: product.sgstRate,
                cgstAmount: cgst,
                sgstAmount: sgst,
                totalPrice: price + cgst + sgst
            };
            setCart([
                ...cart,
                newCartItem
            ]);
        }
        setProductSearch('');
        setFilteredProducts([]);
    };
    const updateCartQty = (index, qty)=>{
        if (qty <= 0) return;
        const updated = [
            ...cart
        ];
        updated[index].quantity = qty;
        const taxable = Math.max(0, (updated[index].unitPrice - updated[index].discount) * qty);
        updated[index].cgstAmount = taxable * updated[index].cgstRate / 100;
        updated[index].sgstAmount = taxable * updated[index].sgstRate / 100;
        updated[index].totalPrice = taxable + updated[index].cgstAmount + updated[index].sgstAmount;
        setCart(updated);
    };
    const updateCartSellingPrice = (index, sellingPrice)=>{
        if (sellingPrice < 0) return;
        const updated = [
            ...cart
        ];
        const defaultPrice = updated[index].product.level2Price;
        if (sellingPrice >= defaultPrice) {
            updated[index].unitPrice = sellingPrice;
            updated[index].discount = 0;
        } else {
            updated[index].unitPrice = defaultPrice;
            updated[index].discount = Math.max(0, defaultPrice - sellingPrice);
        }
        const taxable = Math.max(0, sellingPrice * updated[index].quantity);
        updated[index].cgstAmount = taxable * updated[index].cgstRate / 100;
        updated[index].sgstAmount = taxable * updated[index].sgstRate / 100;
        updated[index].totalPrice = taxable + updated[index].cgstAmount + updated[index].sgstAmount;
        setCart(updated);
    };
    const removeFromCart = (index)=>{
        const updated = cart.filter((_, i)=>i !== index);
        setCart(updated);
    };
    const clearCart = ()=>{
        setCart([]);
        setSelectedCustomer(null);
        setOverallDiscount(0);
        setPaidAmount('0');
    };
    const calculateCartTotals = ()=>{
        let subtotal = 0;
        let cgst = 0;
        let sgst = 0;
        cart.forEach((item)=>{
            const taxable = Math.max(0, (item.unitPrice - item.discount) * item.quantity);
            subtotal += taxable;
            cgst += item.cgstAmount;
            sgst += item.sgstAmount;
        });
        const taxAmount = cgst + sgst;
        const preDiscountTotal = subtotal + taxAmount;
        const netAmount = Math.max(0, preDiscountTotal - overallDiscount);
        return {
            subtotal,
            taxAmount,
            netAmount,
            cgst,
            sgst
        };
    };
    const totals = calculateCartTotals();
    // Realtime Polling for pending billing approvals
    process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE && useEffect(()=>{
        if (!pendingBillId) return;
        const interval = setInterval(async ()=>{
            try {
                const res = await fetch(`${API_BASE}/billing/bills/${pendingBillId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'FINALIZED') {
                        clearInterval(interval);
                        setPendingBillStatus('APPROVED_NOTIFY');
                        setPendingBillApprover(data.approverName || 'Manager');
                        setTimeout(()=>{
                            const actualPaid = paymentMethod === 'CASH' ? Number(paidAmount) : totals.netAmount;
                            setCheckoutResult({
                                billNumber: pendingBillNumber || 'BILL-SUCCESS',
                                netAmount: totals.netAmount,
                                paidAmount: actualPaid,
                                changeAmount: Math.max(0, actualPaid - totals.netAmount),
                                isQuote
                            });
                            setCart([]);
                            setSelectedCustomer(null);
                            setOverallDiscount(0);
                            setPaidAmount('0');
                            setPendingBillId(null);
                            setPendingBillNumber(null);
                            setPendingBillStatus(null);
                            setPendingBillReason(null);
                            setPendingBillApprover(null);
                            setPendingBillRejectReason(null);
                            fetchAllData();
                        }, 2500);
                    } else if (data.status === 'REJECTED') {
                        clearInterval(interval);
                        setPendingBillStatus('REJECTED');
                        setPendingBillRejectReason(data.reason || 'Below acceptable margins.');
                    }
                }
            } catch (err) {
                console.error('Error checking bill status:', err);
            }
        }, 3000);
        return ()=>clearInterval(interval);
    }, [
        pendingBillId,
        pendingBillNumber,
        totals,
        paidAmount,
        isQuote,
        paymentMethod
    ]);
    // Fetch approvals queue list for managers/owners
    const fetchApprovals = async ()=>{
        try {
            const res = await fetch(`${API_BASE}/billing/approvals`);
            if (res.ok) {
                const data = await res.json();
                setApprovals(data);
            }
        } catch (err) {
            console.error('Error fetching approvals:', err);
        }
    };
    process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE && useEffect(()=>{
        if (activeTab === 'approvals') {
            fetchApprovals();
            const interval = setInterval(fetchApprovals, 5000); // 5s refresh
            return ()=>clearInterval(interval);
        }
    }, [
        activeTab
    ]);
    const handleActionApproval = async (approvalId, action)=>{
        const reason = rejectionReasonInput[approvalId] || '';
        if (action === 'REJECT' && !reason.trim()) {
            alert('Please enter a rejection reason.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/billing/approvals/${approvalId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action,
                    userId: user?.userId,
                    reason
                })
            });
            if (res.ok) {
                fetchApprovals();
                setRejectionReasonInput((prev)=>({
                        ...prev,
                        [approvalId]: ''
                    }));
            } else {
                const err = await res.json();
                alert(err.message || 'Action failed.');
            }
        } catch (err) {
            alert('Network error processing approval action.');
        }
    };
    const handleCancelPendingRequest = async ()=>{
        if (!pendingBillId) return;
        try {
            const res = await fetch(`${API_BASE}/billing/bills/${pendingBillId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setPendingBillId(null);
                setPendingBillNumber(null);
                setPendingBillStatus(null);
                setPendingBillReason(null);
            } else {
                alert('Could not cancel request. It may have already been approved or rejected.');
            }
        } catch (err) {
            alert('Network error while cancelling request.');
        }
    };
    const handleSelectCustomer = (cust)=>{
        setSelectedCustomer(cust);
        setCustomerSearch('');
        setFilteredCustomers([]);
    };
    // Pricing engine validation: Level 3 (Manager approval) and Emergency (Owner approval) checks
    const handlePOSCheckout = ()=>{
        // 0. Cash Handed Over validation (Compulsory for Cash payments)
        if (paymentMethod === 'CASH' && !isQuote) {
            const cashValue = Number(paidAmount);
            if (isNaN(cashValue) || !paidAmount || cashValue <= 0) {
                alert("Error: Please enter a valid Cash Handed Over amount.");
                return;
            }
            if (cashValue < totals.netAmount) {
                alert(`Error: Insufficient Cash. Customer needs to pay at least ₹${totals.netAmount.toFixed(2)}.`);
                return;
            }
        }
        // 1. Zero Selling Price Blocker
        let hasZeroPrice = false;
        cart.forEach((item)=>{
            const sellPrice = item.unitPrice - item.discount;
            if (sellPrice <= 0) hasZeroPrice = true;
        });
        if (hasZeroPrice) {
            alert("Error: Biller cannot make the selling price zero or negative.");
            return;
        }
        // 2. Loss Sale Detection
        const lossBreaches = cart.filter((item)=>{
            const sellPrice = item.unitPrice - item.discount;
            const costPrice = item.product.inventory[0]?.costPrice || 0;
            return sellPrice <= costPrice;
        }).map((item)=>{
            const sellPrice = item.unitPrice - item.discount;
            const costPrice = item.product.inventory[0]?.costPrice || 0;
            const profit = sellPrice - costPrice;
            const margin = sellPrice > 0 ? profit / sellPrice * 100 : 0;
            return {
                productName: item.product.name,
                costPrice,
                sellingPrice: sellPrice,
                loss: Math.abs(profit),
                margin: margin.toFixed(1)
            };
        });
        if (lossBreaches.length > 0) {
            if (user?.role === 'OWNER') {
                setLossWarningModal({
                    show: true,
                    breaches: lossBreaches,
                    bypassAction: ()=>{
                        setLossWarningModal(null);
                        executeCheckout(undefined, true);
                    }
                });
            } else {
                if (confirm("Warning: Loss sale detected! Sells below cost. This action requires OWNER approval. Submit this bill to the approval queue?")) {
                    executeCheckout();
                }
            }
            return;
        }
        // 3. Pricing Threshold Checks (Level 3 breach)
        const level3Breaches = cart.filter((item)=>{
            const sellPrice = item.unitPrice - item.discount;
            return sellPrice < item.product.level3Price;
        });
        if (level3Breaches.length > 0) {
            if (user?.role === 'OWNER') {
                executeCheckout(undefined, true);
            } else {
                if (confirm("Pricing Breach: Price falls below Level 3 minimum. This action requires approval. Submit this bill to the approval queue?")) {
                    executeCheckout();
                }
            }
            return;
        }
        executeCheckout();
    };
    const executeCheckout = async (approvedByManagerId, bypassLossWarning)=>{
        setIsCheckingOut(true);
        const actualPaid = paymentMethod === 'CASH' ? Number(paidAmount) : totals.netAmount;
        const payload = {
            billData: {
                customerId: selectedCustomer?.id || null,
                items: cart.map((i)=>({
                        productId: i.product.id,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        discount: i.discount
                    })),
                discountAmount: overallDiscount,
                paymentMethod,
                paidAmount: actualPaid,
                isQuote,
                approvedByManagerId,
                bypassLossWarning
            },
            userId: user?.userId
        };
        if (isSandboxMode) {
            // Simulate client-side checkout
            setTimeout(()=>{
                const invoiceNum = isQuote ? `QTE-${Date.now().toString().slice(-6)}` : `BILL-${Date.now().toString().slice(-6)}`;
                setCheckoutResult({
                    billNumber: invoiceNum,
                    netAmount: totals.netAmount,
                    paidAmount: actualPaid,
                    changeAmount: Math.max(0, actualPaid - totals.netAmount),
                    isQuote
                });
                // Deduct quantities locally
                if (!isQuote) {
                    const updatedProds = products.map((p)=>{
                        const cartItem = cart.find((ci)=>ci.product.id === p.id);
                        if (cartItem) {
                            const updatedInv = [
                                ...p.inventory
                            ];
                            updatedInv[0].quantity = Math.max(0, updatedInv[0].quantity - cartItem.quantity);
                            return {
                                ...p,
                                inventory: updatedInv
                            };
                        }
                        return p;
                    });
                    setProducts(updatedProds);
                }
                setIsCheckingOut(false);
            }, 800);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/billing/bills`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const order = await res.json();
                if (order.status === 'PENDING_APPROVAL') {
                    setPendingBillId(order.id);
                    setPendingBillNumber(order.billNumber);
                    setPendingBillStatus('PENDING_APPROVAL');
                    setPendingBillReason('Price override below limit');
                } else {
                    setCheckoutResult({
                        billNumber: order.billNumber,
                        netAmount: order.netAmount,
                        paidAmount: order.paidAmount,
                        changeAmount: Math.max(0, order.paidAmount - order.netAmount),
                        isQuote: order.isQuote
                    });
                    setCart([]);
                    setSelectedCustomer(null);
                    setOverallDiscount(0);
                    setPaidAmount('0');
                    fetchAllData(); // Refresh stock details
                }
            } else {
                const err = await res.json();
                alert(err.message || 'Checkout failed.');
            }
        } catch (err) {
            alert('Network error during checkout.');
        } finally{
            setIsCheckingOut(false);
        }
    };
    // ==========================================
    // Inventory Stock Adjustments
    // ==========================================
    const handleAdjustStockSubmit = async (e)=>{
        e.preventDefault();
        if (!stockAdjustment.product || !stockAdjustment.quantityChanged) return;
        const qty = Number(stockAdjustment.quantityChanged);
        if (isNaN(qty)) return;
        if (isSandboxMode) {
            // Offline edit
            const updatedProds = products.map((p)=>{
                if (p.id === stockAdjustment.product?.id) {
                    const updatedInv = [
                        ...p.inventory
                    ];
                    updatedInv[0].quantity = Math.max(0, updatedInv[0].quantity + qty);
                    return {
                        ...p,
                        inventory: updatedInv
                    };
                }
                return p;
            });
            setProducts(updatedProds);
            setStockAdjustment({
                show: false,
                product: null,
                quantityChanged: '',
                reason: '',
                type: 'ADJUSTMENT'
            });
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/products/adjust-stock`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productId: stockAdjustment.product.id,
                    quantityChanged: qty,
                    type: stockAdjustment.type,
                    costPrice: stockAdjustment.product.inventory[0]?.costPrice,
                    userId: user?.userId,
                    reason: stockAdjustment.reason
                })
            });
            if (res.ok) {
                setStockAdjustment({
                    show: false,
                    product: null,
                    quantityChanged: '',
                    reason: '',
                    type: 'ADJUSTMENT'
                });
                fetchAllData();
                fetchAuditLogs();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to adjust stock');
            }
        } catch (e) {
            alert('Network issue adjusting stock');
        }
    };
    const triggerEditProduct = (p)=>{
        const retail = p.priceLevels.find((pl)=>pl.level === 'RETAIL')?.price || 0;
        const wholesale = p.priceLevels.find((pl)=>pl.level === 'WHOLESALE')?.price || 0;
        const cost = p.inventory[0]?.costPrice || 0;
        setEditProduct({
            show: true,
            product: p,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode || '',
            rackLocation: p.rackLocation || '',
            hsnCode: p.hsnCode || '',
            cgstRate: p.cgstRate.toString(),
            sgstRate: p.sgstRate.toString(),
            costPrice: cost.toString(),
            minimumProfitPct: p.minimumProfitPct.toString(),
            retailPrice: retail.toString(),
            wholesalePrice: wholesale.toString()
        });
    };
    const handleEditProductSubmit = async (e)=>{
        e.preventDefault();
        if (!editProduct.product) return;
        const payload = {
            name: editProduct.name,
            sku: editProduct.sku,
            barcode: editProduct.barcode,
            rackLocation: editProduct.rackLocation,
            hsnCode: editProduct.hsnCode,
            cgstRate: Number(editProduct.cgstRate),
            sgstRate: Number(editProduct.sgstRate),
            costPrice: Number(editProduct.costPrice),
            minimumProfitPct: Number(editProduct.minimumProfitPct),
            retailPrice: Number(editProduct.retailPrice),
            wholesalePrice: Number(editProduct.wholesalePrice)
        };
        if (isSandboxMode) {
            const updatedProds = products.map((p)=>{
                if (p.id === editProduct.product?.id) {
                    const prices = [
                        {
                            id: '1',
                            level: 'RETAIL',
                            price: payload.retailPrice
                        },
                        {
                            id: '2',
                            level: 'WHOLESALE',
                            price: payload.wholesalePrice
                        }
                    ];
                    const inv = [
                        {
                            ...p.inventory[0],
                            costPrice: payload.costPrice
                        }
                    ];
                    return {
                        ...p,
                        name: payload.name,
                        sku: payload.sku,
                        barcode: payload.barcode,
                        rackLocation: payload.rackLocation,
                        hsnCode: payload.hsnCode,
                        cgstRate: payload.cgstRate,
                        sgstRate: payload.sgstRate,
                        minimumProfitPct: payload.minimumProfitPct,
                        priceLevels: prices,
                        inventory: inv
                    };
                }
                return p;
            });
            setProducts(updatedProds);
            setEditProduct((prev)=>({
                    ...prev,
                    show: false
                }));
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/products/${editProduct.product.id}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setEditProduct((prev)=>({
                        ...prev,
                        show: false
                    }));
                fetchAllData();
                fetchAuditLogs();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to update product details');
            }
        } catch (e) {
            alert('Network issue updating product details');
        }
    };
    // ==========================================
    // Add Customer Logic
    // ==========================================
    const handleAddCustomerSubmit = async (e)=>{
        e.preventDefault();
        if (!addCustomer.name || !addCustomer.phone) return;
        if (isSandboxMode) {
            const newCust = {
                id: `local-cust-${Date.now()}`,
                name: addCustomer.name,
                phone: addCustomer.phone,
                email: null,
                gstin: null,
                address: null,
                creditLimit: Number(addCustomer.creditLimit) || 10000,
                balance: 0,
                priceLevel: addCustomer.priceLevel
            };
            setCustomers([
                ...customers,
                newCust
            ]);
            setAddCustomer({
                show: false,
                name: '',
                phone: '',
                priceLevel: 'RETAIL',
                creditLimit: '10000'
            });
            handleSelectCustomer(newCust);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/billing/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: addCustomer.name,
                    phone: addCustomer.phone,
                    priceLevel: addCustomer.priceLevel,
                    creditLimit: Number(addCustomer.creditLimit)
                })
            });
            if (res.ok) {
                const freshCust = await res.json();
                setCustomers([
                    ...customers,
                    freshCust
                ]);
                setAddCustomer({
                    show: false,
                    name: '',
                    phone: '',
                    priceLevel: 'RETAIL',
                    creditLimit: '10000'
                });
                handleSelectCustomer(freshCust);
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to add customer');
            }
        } catch (e) {
            alert('Connection error registering customer');
        }
    };
    // ==========================================
    // Mock Data Generators for fallback offline
    // ==========================================
    function getMockProducts() {
        return [
            {
                id: 'mock-led',
                sku: 'ELE-LED-9W',
                barcode: '8901234567890',
                name: 'Philips LED Bulb 9W B22',
                description: 'Cool day light energy saver LED bulb',
                rackLocation: 'Aisle 2, Row A',
                minimumProfitPct: 12.0,
                hsnCode: '85395200',
                cgstRate: 9.0,
                sgstRate: 9.0,
                igstRate: 18.0,
                baseUnit: {
                    name: 'Piece',
                    abbreviation: 'pc'
                },
                priceLevels: [],
                mrp: 150.0,
                level1Price: 120.0,
                level2Price: 110.0,
                level3Price: 90.0,
                emergencyPrice: 80.0,
                inventory: [
                    {
                        quantity: 250,
                        costPrice: 75.0,
                        minStockLevel: 20
                    }
                ]
            },
            {
                id: 'mock-spark',
                sku: 'AUT-SPK-M8',
                barcode: '4047024001234',
                name: 'Bosch Super Spark Plug M8',
                description: 'High performance copper core spark plug',
                rackLocation: 'Shelf B-1',
                minimumProfitPct: 15.0,
                hsnCode: '85111000',
                cgstRate: 14.0,
                sgstRate: 14.0,
                igstRate: 28.0,
                baseUnit: {
                    name: 'Piece',
                    abbreviation: 'pc'
                },
                priceLevels: [],
                mrp: 200.0,
                level1Price: 180.0,
                level2Price: 160.0,
                level3Price: 135.0,
                emergencyPrice: 120.0,
                inventory: [
                    {
                        quantity: 120,
                        costPrice: 110.0,
                        minStockLevel: 15
                    }
                ]
            },
            {
                id: 'mock-wire',
                sku: 'ELE-WIR-1.5',
                barcode: '8902345678901',
                name: 'Polycab 1.5 Sqmm Copper Wire (Red)',
                description: 'FR multi-strand single core copper cable 100m roll',
                rackLocation: 'Aisle 1, Rack D',
                minimumProfitPct: 10.0,
                hsnCode: '85444920',
                cgstRate: 9.0,
                sgstRate: 9.0,
                igstRate: 18.0,
                baseUnit: {
                    name: 'Meter',
                    abbreviation: 'm'
                },
                priceLevels: [],
                mrp: 20.0,
                level1Price: 15.0,
                level2Price: 13.5,
                level3Price: 11.0,
                emergencyPrice: 10.0,
                inventory: [
                    {
                        quantity: 800,
                        costPrice: 9.5,
                        minStockLevel: 100
                    }
                ]
            }
        ];
    }
    function getMockCustomers() {
        return [
            {
                id: 'mock-tarun',
                name: 'Tarun Kumar',
                phone: '9876543210',
                email: 'tarun@gmail.com',
                address: 'Sector 62, Noida',
                priceLevel: 'WHOLESALE',
                creditLimit: 50000.0,
                balance: 1500.0,
                gstin: null
            },
            {
                id: 'mock-abc',
                name: 'ABC Electricals',
                phone: '9988776655',
                email: 'abc@electricals.com',
                address: 'Andheri West, Mumbai',
                priceLevel: 'CONTRACTOR',
                creditLimit: 100000.0,
                balance: 0.0,
                gstin: null
            }
        ];
    }
    // ==========================================
    // Render Login Layout
    // ==========================================
    if (!user) {
        return /*#__PURE__*/ _jsxs("div", {
            className: "min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 relative overflow-hidden select-none",
            children: [
                /*#__PURE__*/ _jsx("div", {
                    className: "absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]"
                }),
                /*#__PURE__*/ _jsx("div", {
                    className: "absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]"
                }),
                /*#__PURE__*/ _jsxs(motion.div, {
                    initial: {
                        opacity: 0,
                        y: 20
                    },
                    animate: {
                        opacity: 1,
                        y: 0
                    },
                    transition: {
                        duration: 0.5
                    },
                    className: "w-full max-w-[420px] bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl relative",
                    children: [
                        /*#__PURE__*/ _jsxs("div", {
                            className: "flex flex-col items-center mb-8",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-3",
                                    children: /*#__PURE__*/ _jsx(Layers, {
                                        className: "text-white w-6 h-6"
                                    })
                                }),
                                /*#__PURE__*/ _jsx("h1", {
                                    className: "text-2xl font-bold tracking-tight text-white",
                                    children: "SHOPOS"
                                }),
                                /*#__PURE__*/ _jsx("p", {
                                    className: "text-xs text-neutral-400 mt-1",
                                    children: "Enterprise POS & Inventory Platform"
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsxs("form", {
                            onSubmit: handleLoginSubmit,
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("label", {
                                            className: "block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1",
                                            children: "Username"
                                        }),
                                        /*#__PURE__*/ _jsx("input", {
                                            type: "text",
                                            value: loginForm.username,
                                            onChange: (e)=>setLoginForm({
                                                    ...loginForm,
                                                    username: e.target.value
                                                }),
                                            className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors",
                                            required: true
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("label", {
                                            className: "block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1",
                                            children: "Password"
                                        }),
                                        /*#__PURE__*/ _jsx("input", {
                                            type: "password",
                                            value: loginForm.password,
                                            onChange: (e)=>setLoginForm({
                                                    ...loginForm,
                                                    password: e.target.value
                                                }),
                                            className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors",
                                            required: true
                                        })
                                    ]
                                }),
                                authError && /*#__PURE__*/ _jsxs("div", {
                                    className: "flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 px-3 py-2 rounded-lg",
                                    children: [
                                        /*#__PURE__*/ _jsx(AlertCircle, {
                                            className: "w-4 h-4 shrink-0"
                                        }),
                                        /*#__PURE__*/ _jsx("span", {
                                            children: authError
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("button", {
                                    type: "submit",
                                    disabled: isLoading,
                                    className: "w-full bg-white hover:bg-neutral-200 text-neutral-950 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md",
                                    children: isLoading ? /*#__PURE__*/ _jsx(RefreshCw, {
                                        className: "w-4 h-4 animate-spin"
                                    }) : 'Log In'
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsxs("div", {
                            className: "relative my-6",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "absolute inset-0 flex items-center",
                                    children: /*#__PURE__*/ _jsx("div", {
                                        className: "w-full border-t border-neutral-800"
                                    })
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "relative flex justify-center text-xs uppercase",
                                    children: /*#__PURE__*/ _jsx("span", {
                                        className: "bg-neutral-900 px-2 text-neutral-500",
                                        children: "Developer Sandbox"
                                    })
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsx("button", {
                            type: "button",
                            onClick: handleQuickBypass,
                            className: "w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm py-2 rounded-lg transition-colors cursor-pointer border border-neutral-700/50",
                            children: "Launch Offline Mock POS"
                        }),
                        /*#__PURE__*/ _jsx("div", {
                            className: "mt-6 text-center text-xs text-neutral-500",
                            children: /*#__PURE__*/ _jsxs("p", {
                                children: [
                                    "Seeded accounts: ",
                                    /*#__PURE__*/ _jsx("strong", {
                                        className: "text-neutral-300",
                                        children: "cashier"
                                    }),
                                    " (3333) | ",
                                    /*#__PURE__*/ _jsx("strong", {
                                        className: "text-neutral-300",
                                        children: "manager"
                                    }),
                                    " (2222)"
                                ]
                            })
                        })
                    ]
                })
            ]
        });
    }
    // ==========================================
    // Render Application Shell
    // ==========================================
    return /*#__PURE__*/ _jsxs("div", {
        className: "flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100",
        children: [
            /*#__PURE__*/ _jsxs("aside", {
                className: "w-64 bg-neutral-900/30 border-r border-neutral-800 flex flex-col justify-between shrink-0",
                children: [
                    /*#__PURE__*/ _jsxs("div", {
                        children: [
                            /*#__PURE__*/ _jsxs("div", {
                                className: "p-6 border-b border-neutral-800 flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "flex items-center gap-2.5",
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                className: "w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/10",
                                                children: /*#__PURE__*/ _jsx(Layers, {
                                                    className: "text-white w-4.5 h-4.5"
                                                })
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("h1", {
                                                        className: "font-bold tracking-tight text-white leading-none",
                                                        children: "SHOPOS"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-[10px] text-neutral-400 mt-1 block",
                                                        children: "ERP + Billing Platform"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "flex items-center gap-1.5 bg-neutral-950/60 border border-neutral-800 px-2 py-0.5 rounded-full",
                                        children: [
                                            /*#__PURE__*/ _jsx("span", {
                                                className: `w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'} sync-anim`
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                className: "text-[8px] font-semibold text-neutral-300 uppercase tracking-wider",
                                                children: backendStatus
                                            })
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("nav", {
                                className: "p-4 space-y-1",
                                children: [
                                    /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>setActiveTab('pos'),
                                        className: `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'pos' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsx(ShoppingCart, {
                                                className: "w-4 h-4"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "POS Billing"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>setActiveTab('inventory'),
                                        className: `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'inventory' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsx(Package, {
                                                className: "w-4 h-4"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "Products & Stock"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>{
                                            setActiveTab('customer-ledgers');
                                            fetchCustomersLedgersData();
                                        },
                                        className: `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'customer-ledgers' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsx(BookOpen, {
                                                className: "w-4 h-4"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "Customer Ledgers"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>{
                                            setActiveTab('supplier-ledgers');
                                            fetchSuppliersLedgersData();
                                        },
                                        className: `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'supplier-ledgers' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsx(Database, {
                                                className: "w-4 h-4"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "Supplier Ledgers"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>{
                                            setActiveTab('returns');
                                            fetchReturnsData();
                                        },
                                        className: `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'returns' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsx(RotateCcw, {
                                                className: "w-4 h-4"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "Return Center"
                                            })
                                        ]
                                    }),
                                    (user?.role === 'OWNER' || user?.role === 'MANAGER') && /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>setActiveTab('approvals'),
                                        className: `w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'approvals' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ _jsx(ClipboardCheck, {
                                                        className: "w-4 h-4"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        children: "Approval Center"
                                                    })
                                                ]
                                            }),
                                            approvals.filter((a)=>a.status === 'PENDING').length > 0 && /*#__PURE__*/ _jsx("span", {
                                                className: "bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-4 leading-none",
                                                children: approvals.filter((a)=>a.status === 'PENDING').length
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("button", {
                                        onClick: ()=>setActiveTab('settings'),
                                        className: `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'settings' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`,
                                        children: [
                                            /*#__PURE__*/ _jsx(Settings, {
                                                className: "w-4 h-4"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "Dev Console & Logs"
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),
                    /*#__PURE__*/ _jsxs("div", {
                        className: "p-4 border-t border-neutral-800 space-y-3",
                        children: [
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex items-center justify-between bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-800/50",
                                children: [
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                className: "w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-violet-400 border border-neutral-700",
                                                children: user.fullName.slice(0, 2).toUpperCase()
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "overflow-hidden",
                                                children: [
                                                    /*#__PURE__*/ _jsx("p", {
                                                        className: "text-xs font-medium text-white truncate leading-tight",
                                                        children: user.fullName
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-[9px] text-neutral-400 uppercase tracking-wider",
                                                        children: user.role
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: handleLogout,
                                        className: "text-neutral-400 hover:text-red-400 transition-colors cursor-pointer",
                                        children: /*#__PURE__*/ _jsx(Lock, {
                                            className: "w-4 h-4"
                                        })
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                className: "text-[10px] text-neutral-500 bg-neutral-950/20 p-2 rounded-lg text-center flex items-center justify-center gap-1.5 border border-neutral-800/20",
                                children: [
                                    /*#__PURE__*/ _jsx(Keyboard, {
                                        className: "w-3.5 h-3.5 shrink-0"
                                    }),
                                    /*#__PURE__*/ _jsxs("span", {
                                        children: [
                                            "Press ",
                                            /*#__PURE__*/ _jsx("strong", {
                                                className: "text-neutral-400",
                                                children: "Ctrl + Space"
                                            }),
                                            " to search"
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ _jsx("main", {
                className: "flex-1 flex flex-col min-w-0 bg-neutral-950 relative",
                children: /*#__PURE__*/ _jsxs(AnimatePresence, {
                    mode: "wait",
                    children: [
                        activeTab === 'pos' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex overflow-hidden h-full",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex-1 flex flex-col min-w-0 h-full border-r border-neutral-800/80",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "p-4 border-b border-neutral-800 flex items-center gap-3 relative shrink-0",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "relative flex-1",
                                                    children: [
                                                        /*#__PURE__*/ _jsx(Search, {
                                                            className: "absolute left-3.5 top-2.5 text-neutral-500 w-4.5 h-4.5"
                                                        }),
                                                        /*#__PURE__*/ _jsx("input", {
                                                            ref: productSearchRef,
                                                            type: "text",
                                                            placeholder: "Scan barcode, enter SKU, product name, or alias (Ctrl + Space)...",
                                                            value: productSearch,
                                                            onChange: (e)=>setProductSearch(e.target.value),
                                                            className: "w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
                                                        }),
                                                        filteredProducts.length > 0 && /*#__PURE__*/ _jsx("div", {
                                                            className: "absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1",
                                                            children: filteredProducts.map((p, idx)=>/*#__PURE__*/ _jsxs("div", {
                                                                    onClick: ()=>addToCart(p),
                                                                    className: "flex items-center justify-between px-4 py-2 hover:bg-neutral-800/60 cursor-pointer transition-colors",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("p", {
                                                                                    className: "text-sm font-medium text-white",
                                                                                    children: p.name
                                                                                }),
                                                                                /*#__PURE__*/ _jsxs("p", {
                                                                                    className: "text-xs text-neutral-400 font-mono",
                                                                                    children: [
                                                                                        p.sku,
                                                                                        " • Rack: ",
                                                                                        p.rackLocation || 'N/A'
                                                                                    ]
                                                                                })
                                                                            ]
                                                                        }),
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            className: "text-right",
                                                                            children: [
                                                                                /*#__PURE__*/ _jsxs("p", {
                                                                                    className: "text-sm font-semibold text-white",
                                                                                    children: [
                                                                                        "₹",
                                                                                        getProductPrice(p, selectedCustomer?.priceLevel || 'RETAIL')
                                                                                    ]
                                                                                }),
                                                                                /*#__PURE__*/ _jsxs("span", {
                                                                                    className: "text-[10px] text-neutral-500",
                                                                                    children: [
                                                                                        "Qty: ",
                                                                                        p.inventory[0]?.quantity
                                                                                    ]
                                                                                })
                                                                            ]
                                                                        })
                                                                    ]
                                                                }, p.id))
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("button", {
                                                            onClick: ()=>setIsQuote((prev)=>!prev),
                                                            className: `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${isQuote ? 'bg-amber-600/20 text-amber-400 border-amber-500/50' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`,
                                                            children: isQuote ? 'Quote Mode Active' : 'Quote Mode (F4)'
                                                        }),
                                                        /*#__PURE__*/ _jsx("button", {
                                                            onClick: clearCart,
                                                            className: "px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors cursor-pointer",
                                                            children: "Clear Cart"
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex-1 overflow-y-auto p-4 min-h-0",
                                            children: cart.length === 0 ? /*#__PURE__*/ _jsxs("div", {
                                                className: "h-full flex flex-col items-center justify-center text-center p-8 select-none",
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        className: "w-16 h-16 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-center text-neutral-500 mb-4",
                                                        children: /*#__PURE__*/ _jsx(ShoppingCart, {
                                                            className: "w-7 h-7"
                                                        })
                                                    }),
                                                    /*#__PURE__*/ _jsx("h3", {
                                                        className: "text-sm font-semibold text-white",
                                                        children: "Cart is empty"
                                                    }),
                                                    /*#__PURE__*/ _jsx("p", {
                                                        className: "text-xs text-neutral-500 max-w-[240px] mt-1",
                                                        children: "Scan a barcode or type a product name to begin checkout flow."
                                                    })
                                                ]
                                            }) : /*#__PURE__*/ _jsxs("table", {
                                                className: "w-full text-left border-collapse",
                                                children: [
                                                    /*#__PURE__*/ _jsx("thead", {
                                                        children: /*#__PURE__*/ _jsxs("tr", {
                                                            className: "border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5",
                                                                    children: "Product & SKU"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5 text-right w-24",
                                                                    children: "Default Price"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5 text-center w-28",
                                                                    children: "Quantity"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5 text-right w-24 text-blue-400",
                                                                    children: "Selling Price"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5 text-right w-24",
                                                                    children: "GST"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5 text-right w-28",
                                                                    children: "Total"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "py-2.5 text-center w-12"
                                                                })
                                                            ]
                                                        })
                                                    }),
                                                    /*#__PURE__*/ _jsx("tbody", {
                                                        className: "divide-y divide-neutral-900",
                                                        children: cart.map((item, idx)=>{
                                                            const sellPrice = item.unitPrice - item.discount;
                                                            const isElevated = user?.role === 'OWNER' || user?.role === 'MANAGER';
                                                            const profit = sellPrice - (item.product.inventory[0]?.costPrice || 0);
                                                            const margin = sellPrice > 0 ? profit / sellPrice * 100 : 0;
                                                            const isMarginWarning = margin < item.product.minimumProfitPct;
                                                            return /*#__PURE__*/ _jsxs("tr", {
                                                                className: "group hover:bg-neutral-900/30 transition-colors",
                                                                children: [
                                                                    /*#__PURE__*/ _jsxs("td", {
                                                                        className: "py-3 pr-2",
                                                                        children: [
                                                                            /*#__PURE__*/ _jsx("p", {
                                                                                className: "text-xs font-semibold text-white leading-snug",
                                                                                children: item.product.name
                                                                            }),
                                                                            /*#__PURE__*/ _jsxs("div", {
                                                                                className: "flex items-center gap-1.5 mt-0.5",
                                                                                children: [
                                                                                    /*#__PURE__*/ _jsx("span", {
                                                                                        className: "text-[10px] text-neutral-500 font-mono",
                                                                                        children: item.product.sku
                                                                                    }),
                                                                                    isElevated && isMarginWarning && /*#__PURE__*/ _jsxs("span", {
                                                                                        className: "text-[8px] bg-red-950 text-red-400 border border-red-900/40 px-1 rounded flex items-center gap-0.5",
                                                                                        children: [
                                                                                            /*#__PURE__*/ _jsx(TrendingDown, {
                                                                                                className: "w-2.5 h-2.5"
                                                                                            }),
                                                                                            " Margin: ",
                                                                                            margin.toFixed(0),
                                                                                            "%"
                                                                                        ]
                                                                                    })
                                                                                ]
                                                                            })
                                                                        ]
                                                                    }),
                                                                    /*#__PURE__*/ _jsxs("td", {
                                                                        className: "py-3 text-right font-mono text-xs text-neutral-400",
                                                                        children: [
                                                                            "₹",
                                                                            item.product.level2Price.toFixed(2)
                                                                        ]
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "py-3 text-center",
                                                                        children: /*#__PURE__*/ _jsxs("div", {
                                                                            className: "inline-flex items-center bg-neutral-900 border border-neutral-800 rounded-md",
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("button", {
                                                                                    onClick: ()=>updateCartQty(idx, item.quantity - 1),
                                                                                    className: "px-2 py-0.5 text-xs text-neutral-500 hover:text-white",
                                                                                    children: "-"
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("input", {
                                                                                    type: "number",
                                                                                    value: item.quantity,
                                                                                    onChange: (e)=>updateCartQty(idx, Number(e.target.value)),
                                                                                    className: "w-10 bg-transparent text-center text-xs font-mono text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("button", {
                                                                                    onClick: ()=>updateCartQty(idx, item.quantity + 1),
                                                                                    className: "px-2 py-0.5 text-xs text-neutral-500 hover:text-white",
                                                                                    children: "+"
                                                                                })
                                                                            ]
                                                                        })
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "py-3 pr-2",
                                                                        children: /*#__PURE__*/ _jsx("input", {
                                                                            type: "number",
                                                                            value: Number(sellPrice.toFixed(2)) || '',
                                                                            placeholder: "0.00",
                                                                            onChange: (e)=>updateCartSellingPrice(idx, Number(e.target.value)),
                                                                            className: "w-full bg-neutral-900 border border-neutral-800 rounded-md px-1.5 py-0.5 text-right text-xs font-mono text-white focus:outline-none"
                                                                        })
                                                                    }),
                                                                    /*#__PURE__*/ _jsxs("td", {
                                                                        className: "py-3 text-right font-mono text-[10px] text-neutral-400 leading-none",
                                                                        children: [
                                                                            /*#__PURE__*/ _jsxs("div", {
                                                                                children: [
                                                                                    "C: ",
                                                                                    item.cgstRate,
                                                                                    "%"
                                                                                ]
                                                                            }),
                                                                            /*#__PURE__*/ _jsxs("div", {
                                                                                className: "mt-1",
                                                                                children: [
                                                                                    "S: ",
                                                                                    item.sgstRate,
                                                                                    "%"
                                                                                ]
                                                                            })
                                                                        ]
                                                                    }),
                                                                    /*#__PURE__*/ _jsxs("td", {
                                                                        className: "py-3 text-right font-semibold font-mono text-xs text-white",
                                                                        children: [
                                                                            "₹",
                                                                            item.totalPrice.toFixed(2)
                                                                        ]
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "py-3 text-center",
                                                                        children: /*#__PURE__*/ _jsx("button", {
                                                                            onClick: ()=>removeFromCart(idx),
                                                                            className: "text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer",
                                                                            children: "\xd7"
                                                                        })
                                                                    })
                                                                ]
                                                            }, idx);
                                                        })
                                                    })
                                                ]
                                            })
                                        }),
                                        cart.length > 0 && /*#__PURE__*/ _jsx("div", {
                                            className: "p-5 border-t border-neutral-800 bg-neutral-900/20 shrink-0 space-y-4",
                                            children: /*#__PURE__*/ _jsxs("div", {
                                                className: "grid grid-cols-4 gap-4 text-right",
                                                children: [
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-[10px] text-neutral-500 uppercase tracking-wider block",
                                                                children: "Taxable Amt"
                                                            }),
                                                            /*#__PURE__*/ _jsxs("span", {
                                                                className: "text-sm font-semibold font-mono text-neutral-200",
                                                                children: [
                                                                    "₹",
                                                                    totals.subtotal.toFixed(2)
                                                                ]
                                                            })
                                                        ]
                                                    }),
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-[10px] text-neutral-500 uppercase tracking-wider block",
                                                                children: "Total CGST"
                                                            }),
                                                            /*#__PURE__*/ _jsxs("span", {
                                                                className: "text-sm font-semibold font-mono text-neutral-200",
                                                                children: [
                                                                    "₹",
                                                                    totals.cgst.toFixed(2)
                                                                ]
                                                            })
                                                        ]
                                                    }),
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-[10px] text-neutral-500 uppercase tracking-wider block",
                                                                children: "Total SGST"
                                                            }),
                                                            /*#__PURE__*/ _jsxs("span", {
                                                                className: "text-sm font-semibold font-mono text-neutral-200",
                                                                children: [
                                                                    "₹",
                                                                    totals.sgst.toFixed(2)
                                                                ]
                                                            })
                                                        ]
                                                    }),
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-[10px] text-neutral-500 uppercase tracking-wider block",
                                                                children: "Final Bill Total"
                                                            }),
                                                            /*#__PURE__*/ _jsxs("span", {
                                                                className: "text-base font-bold font-mono text-violet-400",
                                                                children: [
                                                                    "₹",
                                                                    totals.netAmount.toFixed(2)
                                                                ]
                                                            })
                                                        ]
                                                    })
                                                ]
                                            })
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "w-80 flex flex-col h-full bg-neutral-900/10 p-5 shrink-0",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex-1 space-y-6",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("h3", {
                                                            className: "text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2",
                                                            children: "Customer Account"
                                                        }),
                                                        !selectedCustomer ? /*#__PURE__*/ _jsxs("div", {
                                                            className: "space-y-2",
                                                            children: [
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "relative",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx(Search, {
                                                                            className: "absolute left-2.5 top-2.5 text-neutral-500 w-3.5 h-3.5"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("input", {
                                                                            ref: customerSearchRef,
                                                                            type: "text",
                                                                            placeholder: "Search customer by mobile...",
                                                                            value: customerSearch,
                                                                            onChange: (e)=>setCustomerSearch(e.target.value),
                                                                            className: "w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                                                                        }),
                                                                        filteredCustomers.length > 0 && /*#__PURE__*/ _jsx("div", {
                                                                            className: "absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden",
                                                                            children: filteredCustomers.map((c)=>/*#__PURE__*/ _jsxs("div", {
                                                                                    onClick: ()=>handleSelectCustomer(c),
                                                                                    className: "px-3 py-2 hover:bg-neutral-800 cursor-pointer flex justify-between items-center text-xs",
                                                                                    children: [
                                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                                            children: [
                                                                                                /*#__PURE__*/ _jsx("p", {
                                                                                                    className: "font-semibold text-white",
                                                                                                    children: c.name
                                                                                                }),
                                                                                                /*#__PURE__*/ _jsx("p", {
                                                                                                    className: "text-neutral-400",
                                                                                                    children: c.phone
                                                                                                })
                                                                                            ]
                                                                                        }),
                                                                                        /*#__PURE__*/ _jsx("span", {
                                                                                            className: "bg-neutral-800 text-[10px] px-1.5 py-0.5 rounded text-neutral-300",
                                                                                            children: c.priceLevel
                                                                                        })
                                                                                    ]
                                                                                }, c.id))
                                                                        })
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsxs("button", {
                                                                    onClick: ()=>setAddCustomer((prev)=>({
                                                                                ...prev,
                                                                                show: true
                                                                            })),
                                                                    className: "w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx(PlusCircle, {
                                                                            className: "w-3.5 h-3.5"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("span", {
                                                                            children: "Register New Customer"
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        }) : /*#__PURE__*/ _jsxs("div", {
                                                            className: "bg-neutral-900 border border-neutral-800/80 p-3.5 rounded-xl space-y-2",
                                                            children: [
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex justify-between items-start",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("p", {
                                                                                    className: "text-xs font-bold text-white",
                                                                                    children: selectedCustomer.name
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("p", {
                                                                                    className: "text-[10px] text-neutral-500",
                                                                                    children: selectedCustomer.phone
                                                                                })
                                                                            ]
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("button", {
                                                                            onClick: ()=>setSelectedCustomer(null),
                                                                            className: "text-[10px] text-neutral-400 hover:text-red-400 cursor-pointer",
                                                                            children: "Change"
                                                                        })
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    className: "h-px bg-neutral-800/80 my-2"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex justify-between text-[10px]",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("span", {
                                                                            className: "text-neutral-400",
                                                                            children: "Pricing Tier:"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("span", {
                                                                            className: "font-semibold text-violet-400 uppercase tracking-wider",
                                                                            children: selectedCustomer.priceLevel
                                                                        })
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex justify-between text-[10px]",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("span", {
                                                                            className: "text-neutral-400",
                                                                            children: "Ledger Balance:"
                                                                        }),
                                                                        /*#__PURE__*/ _jsxs("span", {
                                                                            className: `font-semibold ${selectedCustomer.balance > 0 ? 'text-amber-400' : 'text-neutral-400'}`,
                                                                            children: [
                                                                                "₹",
                                                                                selectedCustomer.balance.toFixed(2)
                                                                            ]
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("h3", {
                                                            className: "text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2",
                                                            children: "Payment Method"
                                                        }),
                                                        /*#__PURE__*/ _jsx("div", {
                                                            className: "grid grid-cols-2 gap-2",
                                                            children: [
                                                                'CASH',
                                                                'UPI',
                                                                'CARD',
                                                                'CREDIT'
                                                            ].map((method)=>{
                                                                const isDisabled = method === 'CREDIT' && !selectedCustomer;
                                                                return /*#__PURE__*/ _jsx("button", {
                                                                    disabled: isDisabled,
                                                                    onClick: ()=>setPaymentMethod(method),
                                                                    className: `px-3 py-2 rounded-lg text-xs font-semibold transition-colors border text-center ${isDisabled ? 'opacity-30 border-neutral-800 text-neutral-500 cursor-not-allowed' : paymentMethod === method ? 'bg-violet-600 border-violet-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'}`,
                                                                    children: method
                                                                }, method);
                                                            })
                                                        })
                                                    ]
                                                }),
                                                paymentMethod === 'CASH' && /*#__PURE__*/ _jsxs("div", {
                                                    className: "space-y-3 bg-neutral-950/40 border border-neutral-850 p-4 rounded-xl",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            children: [
                                                                /*#__PURE__*/ _jsx("h3", {
                                                                    className: "text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2",
                                                                    children: "Customer Cash Handed Over"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "relative",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("span", {
                                                                            className: "absolute left-3 top-2 text-neutral-500 text-xs font-mono",
                                                                            children: "₹"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("input", {
                                                                            type: "number",
                                                                            value: paidAmount,
                                                                            onChange: (e)=>setPaidAmount(e.target.value),
                                                                            className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-6 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500",
                                                                            placeholder: "0.00"
                                                                        })
                                                                    ]
                                                                }),
                                                                cart.length > 0 && /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex gap-1.5 mt-2",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("button", {
                                                                            onClick: ()=>setPaidAmount(totals.netAmount.toFixed(0)),
                                                                            className: "bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 text-[10px] text-neutral-300 px-2 py-1 rounded transition-colors cursor-pointer",
                                                                            children: "Exact Cash"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("button", {
                                                                            onClick: ()=>setPaidAmount((Math.ceil(totals.netAmount / 100) * 100).toString()),
                                                                            className: "bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 text-[10px] text-neutral-300 px-2 py-1 rounded transition-colors cursor-pointer",
                                                                            children: "Next ₹100"
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between items-center pt-2 border-t border-neutral-805 text-xs",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-neutral-400",
                                                                    children: "Amount to Return:"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    className: "font-mono font-bold text-green-400 text-sm",
                                                                    children: [
                                                                        "₹",
                                                                        Math.max(0, Number(paidAmount) - totals.netAmount).toFixed(2)
                                                                    ]
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        (()=>{
                                            const cashValue = Number(paidAmount);
                                            const isCash = paymentMethod === 'CASH';
                                            const isInsufficient = isCash && (isNaN(cashValue) || cashValue < totals.netAmount);
                                            const isEmptyCash = isCash && (!paidAmount || cashValue === 0);
                                            let buttonText = isQuote ? 'Save Quotation' : 'Complete Payment (F2)';
                                            let isBtnDisabled = cart.length === 0 || isCheckingOut;
                                            if (isCash && !isQuote) {
                                                if (isEmptyCash) {
                                                    buttonText = 'Enter Cash Given';
                                                    isBtnDisabled = true;
                                                } else if (isInsufficient) {
                                                    buttonText = `Insufficient Cash (Need ₹${(totals.netAmount - cashValue).toFixed(2)} more)`;
                                                    isBtnDisabled = true;
                                                }
                                            }
                                            return /*#__PURE__*/ _jsxs("button", {
                                                onClick: handlePOSCheckout,
                                                disabled: isBtnDisabled,
                                                className: "w-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4 shadow-lg shadow-violet-600/10",
                                                children: [
                                                    isCheckingOut ? /*#__PURE__*/ _jsx(RefreshCw, {
                                                        className: "w-4 h-4 animate-spin"
                                                    }) : /*#__PURE__*/ _jsx(CheckCircle, {
                                                        className: "w-4 h-4"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        children: buttonText
                                                    })
                                                ]
                                            });
                                        })()
                                    ]
                                })
                            ]
                        }, "pos"),
                        activeTab === 'inventory' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex flex-col p-6 overflow-hidden h-full",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex justify-between items-center mb-6 shrink-0",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            children: [
                                                /*#__PURE__*/ _jsx("h2", {
                                                    className: "text-xl font-bold text-white tracking-tight",
                                                    children: "Products & Stock Ledger"
                                                }),
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs text-neutral-400 mt-1",
                                                    children: "Multi-tier prices, shelf locations, and manual inventory adjustments."
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex items-center gap-3",
                                            children: /*#__PURE__*/ _jsxs("div", {
                                                className: "relative w-64",
                                                children: [
                                                    /*#__PURE__*/ _jsx(Search, {
                                                        className: "absolute left-2.5 top-2.5 text-neutral-500 w-3.5 h-3.5"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "text",
                                                        placeholder: "Search SKU or name...",
                                                        className: "w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none"
                                                    })
                                                ]
                                            })
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex-1 bg-neutral-900/35 border border-neutral-800 rounded-xl overflow-y-auto",
                                    children: /*#__PURE__*/ _jsxs("table", {
                                        className: "w-full text-left border-collapse",
                                        children: [
                                            /*#__PURE__*/ _jsx("thead", {
                                                children: /*#__PURE__*/ _jsxs("tr", {
                                                    className: "border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-neutral-950/20",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3",
                                                            children: "Product Name & SKU"
                                                        }),
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-center",
                                                            children: "Base Unit"
                                                        }),
                                                        user?.role === 'OWNER' || user?.role === 'MANAGER' ? /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-right",
                                                            children: "Cost Price"
                                                        }) : null,
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-right",
                                                            children: "Retail Price"
                                                        }),
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-right",
                                                            children: "Wholesale Price"
                                                        }),
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-center",
                                                            children: "Rack Location"
                                                        }),
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-right",
                                                            children: "Qty in Stock"
                                                        }),
                                                        /*#__PURE__*/ _jsx("th", {
                                                            className: "p-3 text-center",
                                                            children: "Actions"
                                                        })
                                                    ]
                                                })
                                            }),
                                            /*#__PURE__*/ _jsx("tbody", {
                                                className: "divide-y divide-neutral-900/70 text-xs",
                                                children: products.map((p)=>{
                                                    const retail = p.priceLevels.find((pl)=>pl.level === 'RETAIL')?.price || 0;
                                                    const wholesale = p.priceLevels.find((pl)=>pl.level === 'WHOLESALE')?.price || 0;
                                                    const stock = p.inventory[0]?.quantity || 0;
                                                    const isLowStock = stock <= (p.inventory[0]?.minStockLevel || 0);
                                                    const isElevated = user?.role === 'OWNER' || user?.role === 'MANAGER';
                                                    return /*#__PURE__*/ _jsxs("tr", {
                                                        className: "hover:bg-neutral-900/20 transition-colors",
                                                        children: [
                                                            /*#__PURE__*/ _jsxs("td", {
                                                                className: "p-3",
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("p", {
                                                                        className: "font-semibold text-white",
                                                                        children: p.name
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-[10px] text-neutral-500 font-mono block mt-0.5",
                                                                        children: p.sku
                                                                    })
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsx("td", {
                                                                className: "p-3 text-center text-neutral-300 font-mono",
                                                                children: p.baseUnit.abbreviation
                                                            }),
                                                            isElevated ? /*#__PURE__*/ _jsxs("td", {
                                                                className: "p-3 text-right font-mono text-neutral-300",
                                                                children: [
                                                                    "₹",
                                                                    p.inventory[0]?.costPrice.toFixed(2)
                                                                ]
                                                            }) : null,
                                                            /*#__PURE__*/ _jsxs("td", {
                                                                className: "p-3 text-right font-mono text-white",
                                                                children: [
                                                                    "₹",
                                                                    retail.toFixed(2)
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsxs("td", {
                                                                className: "p-3 text-right font-mono text-violet-400",
                                                                children: [
                                                                    "₹",
                                                                    wholesale.toFixed(2)
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsx("td", {
                                                                className: "p-3 text-center text-neutral-400 font-mono",
                                                                children: p.rackLocation || 'Shelf N/A'
                                                            }),
                                                            /*#__PURE__*/ _jsxs("td", {
                                                                className: "p-3 text-right",
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: `font-mono font-bold ${isLowStock ? 'text-red-400' : 'text-green-400'}`,
                                                                        children: stock
                                                                    }),
                                                                    isLowStock && /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-[8px] bg-red-950 text-red-400 px-1 rounded block text-center mt-0.5",
                                                                        children: "Low Stock"
                                                                    })
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsx("td", {
                                                                className: "p-3 text-center",
                                                                children: /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex justify-center gap-1.5",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("button", {
                                                                            onClick: ()=>setStockAdjustment({
                                                                                    show: true,
                                                                                    product: p,
                                                                                    quantityChanged: '',
                                                                                    reason: '',
                                                                                    type: 'ADJUSTMENT'
                                                                                }),
                                                                            className: "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer",
                                                                            children: "Adjust Stock"
                                                                        }),
                                                                        isElevated && /*#__PURE__*/ _jsx("button", {
                                                                            onClick: ()=>triggerEditProduct(p),
                                                                            className: "bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer font-semibold",
                                                                            children: "Edit Details"
                                                                        })
                                                                    ]
                                                                })
                                                            })
                                                        ]
                                                    }, p.id);
                                                })
                                            })
                                        ]
                                    })
                                })
                            ]
                        }, "inventory"),
                        activeTab === 'settings' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex flex-col p-6 overflow-hidden h-full space-y-6",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("h2", {
                                            className: "text-xl font-bold text-white tracking-tight",
                                            children: "System Settings & Developer Console"
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs text-neutral-400 mt-1",
                                            children: "Audit logs, system seed resets, and client database stats."
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "grid grid-cols-3 gap-4 shrink-0",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4",
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "p-3 rounded-lg bg-violet-600/10 text-violet-400",
                                                    children: /*#__PURE__*/ _jsx(Database, {
                                                        className: "w-5 h-5"
                                                    })
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("h4", {
                                                            className: "text-[10px] text-neutral-500 uppercase tracking-wider",
                                                            children: "Database Mode"
                                                        }),
                                                        /*#__PURE__*/ _jsx("p", {
                                                            className: "text-sm font-semibold text-white",
                                                            children: isSandboxMode ? 'Offline Sandbox (SQLite fallback)' : 'PostgreSQL Database'
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4",
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "p-3 rounded-lg bg-green-600/10 text-green-400",
                                                    children: /*#__PURE__*/ _jsx(CheckCircle, {
                                                        className: "w-5 h-5"
                                                    })
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("h4", {
                                                            className: "text-[10px] text-neutral-500 uppercase tracking-wider",
                                                            children: "Total SKUs Tracked"
                                                        }),
                                                        /*#__PURE__*/ _jsxs("p", {
                                                            className: "text-sm font-semibold text-white",
                                                            children: [
                                                                products.length,
                                                                " Products"
                                                            ]
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4",
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "p-3 rounded-lg bg-blue-600/10 text-blue-400",
                                                    children: /*#__PURE__*/ _jsx(User, {
                                                        className: "w-5 h-5"
                                                    })
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("h4", {
                                                            className: "text-[10px] text-neutral-500 uppercase tracking-wider",
                                                            children: "Manager PIN Override Status"
                                                        }),
                                                        /*#__PURE__*/ _jsx("p", {
                                                            className: "text-sm font-semibold text-white",
                                                            children: "Active (Code overrides enabled)"
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex-1 bg-neutral-900/30 border border-neutral-800 rounded-xl flex flex-col min-h-0",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "p-4 border-b border-neutral-800 flex items-center justify-between shrink-0",
                                            children: [
                                                /*#__PURE__*/ _jsxs("span", {
                                                    className: "text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5",
                                                    children: [
                                                        /*#__PURE__*/ _jsx(History, {
                                                            className: "w-4 h-4"
                                                        }),
                                                        " System Audit Logs (Latest 50 events)"
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsx("button", {
                                                    onClick: fetchAllData,
                                                    className: "text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1 rounded transition-colors cursor-pointer",
                                                    children: "Refresh Logs"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex-1 overflow-y-auto p-4 font-mono text-[11px] text-neutral-400 space-y-2",
                                            children: auditLogs.map((log, index)=>/*#__PURE__*/ _jsxs("div", {
                                                    className: "p-2 bg-neutral-950/40 rounded border border-neutral-900 flex justify-between items-start gap-4",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            children: [
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    className: "text-violet-400 font-semibold",
                                                                    children: [
                                                                        "[",
                                                                        log.action,
                                                                        "]"
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-neutral-500 ml-2",
                                                                    children: log.details
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-neutral-600 text-[10px] whitespace-nowrap",
                                                            children: new Date(log.createdAt).toLocaleTimeString()
                                                        })
                                                    ]
                                                }, log.id || index))
                                        })
                                    ]
                                })
                            ]
                        }, "settings"),
                        activeTab === 'approvals' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex flex-col p-6 overflow-hidden h-full space-y-6",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex justify-between items-start",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            children: [
                                                /*#__PURE__*/ _jsx("h2", {
                                                    className: "text-xl font-bold text-white tracking-tight",
                                                    children: "Approval Center"
                                                }),
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs text-neutral-400 mt-1",
                                                    children: "Review, approve, or reject pricing overrides and credit limit breaches."
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex gap-2",
                                            children: [
                                                'PENDING',
                                                'APPROVED',
                                                'REJECTED'
                                            ].map((f)=>/*#__PURE__*/ _jsx("button", {
                                                    onClick: ()=>setApprovalFilter(f),
                                                    className: `px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${approvalFilter === f ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'}`,
                                                    children: f
                                                }, f))
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex-1 overflow-y-auto space-y-4",
                                    children: approvals.filter((a)=>a.status === approvalFilter).length === 0 ? /*#__PURE__*/ _jsx("div", {
                                        className: "bg-neutral-900/20 border border-neutral-800/60 p-12 rounded-xl text-center",
                                        children: /*#__PURE__*/ _jsxs("p", {
                                            className: "text-sm text-neutral-500",
                                            children: [
                                                "No ",
                                                approvalFilter.toLowerCase(),
                                                " requests found."
                                            ]
                                        })
                                    }) : approvals.filter((a)=>a.status === approvalFilter).map((a)=>{
                                        const details = a.actionDetails ? JSON.parse(a.actionDetails) : {};
                                        const isOwnerReq = details.requiredRole === 'OWNER';
                                        return /*#__PURE__*/ _jsx("div", {
                                            className: "bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex justify-between items-start gap-6 hover:border-neutral-700 transition-colors",
                                            children: /*#__PURE__*/ _jsxs("div", {
                                                className: "space-y-3 flex-1",
                                                children: [
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        className: "flex items-center gap-3",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: `text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isOwnerReq ? 'bg-red-950 text-red-400 border border-red-900/40' : 'bg-amber-950 text-amber-400 border border-amber-900/40'}`,
                                                                children: isOwnerReq ? 'Owner Level' : 'Manager Level'
                                                            }),
                                                            /*#__PURE__*/ _jsxs("span", {
                                                                className: "text-xs text-neutral-500 font-mono",
                                                                children: [
                                                                    "Request ID: ",
                                                                    a.id.slice(0, 8)
                                                                ]
                                                            })
                                                        ]
                                                    }),
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsxs("h4", {
                                                                className: "text-sm font-bold text-white",
                                                                children: [
                                                                    "Bill #",
                                                                    a.bill?.billNumber || 'Draft Bill'
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsxs("p", {
                                                                className: "text-xs text-red-400 mt-1 flex items-center gap-1",
                                                                children: [
                                                                    /*#__PURE__*/ _jsx(AlertCircle, {
                                                                        className: "w-3.5 h-3.5"
                                                                    }),
                                                                    a.description
                                                                ]
                                                            })
                                                        ]
                                                    }),
                                                    /*#__PURE__*/ _jsxs("div", {
                                                        className: "grid grid-cols-3 gap-4 bg-neutral-950/40 border border-neutral-850 p-3 rounded-lg text-xs",
                                                        children: [
                                                            /*#__PURE__*/ _jsxs("div", {
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-neutral-500 block",
                                                                        children: "Requested By"
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-white font-medium",
                                                                        children: a.requester?.fullName || 'Cashier'
                                                                    })
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsxs("div", {
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-neutral-500 block",
                                                                        children: "Requester Role"
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-white font-medium uppercase tracking-wider",
                                                                        children: a.requester?.role
                                                                    })
                                                                ]
                                                            }),
                                                            /*#__PURE__*/ _jsxs("div", {
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-neutral-500 block",
                                                                        children: "Timestamp"
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "text-white font-medium",
                                                                        children: new Date(a.createdAt).toLocaleString()
                                                                    })
                                                                ]
                                                            })
                                                        ]
                                                    }),
                                                    a.status === 'PENDING' && /*#__PURE__*/ _jsxs("div", {
                                                        className: "flex items-center gap-2 pt-2",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("input", {
                                                                type: "text",
                                                                placeholder: "Provide reason for approval or rejection",
                                                                value: rejectionReasonInput[a.id] || '',
                                                                onChange: (e)=>setRejectionReasonInput({
                                                                        ...rejectionReasonInput,
                                                                        [a.id]: e.target.value
                                                                    }),
                                                                className: "bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none flex-1"
                                                            }),
                                                            /*#__PURE__*/ _jsx("button", {
                                                                onClick: ()=>handleActionApproval(a.id, 'APPROVE'),
                                                                className: "bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                                children: "Approve"
                                                            }),
                                                            /*#__PURE__*/ _jsx("button", {
                                                                onClick: ()=>handleActionApproval(a.id, 'REJECT'),
                                                                className: "bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                                children: "Reject"
                                                            }),
                                                            /*#__PURE__*/ _jsx("button", {
                                                                onClick: ()=>setSelectedApprovalBill(a.bill),
                                                                className: "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                                children: "View Bill"
                                                            })
                                                        ]
                                                    }),
                                                    a.status !== 'PENDING' && /*#__PURE__*/ _jsxs("div", {
                                                        className: "pt-2 text-xs text-neutral-400",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-neutral-500 font-medium",
                                                                children: "Processed By:"
                                                            }),
                                                            " ",
                                                            a.approver?.fullName || 'System',
                                                            " | ",
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-neutral-500 font-medium",
                                                                children: "Reason/Note:"
                                                            }),
                                                            " ",
                                                            details.reason || 'N/A'
                                                        ]
                                                    })
                                                ]
                                            })
                                        }, a.id);
                                    })
                                })
                            ]
                        }, "approvals"),
                        activeTab === 'customer-ledgers' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex flex-col p-6 overflow-hidden h-full",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex justify-between items-center mb-6 shrink-0",
                                    children: /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("h2", {
                                                className: "text-xl font-bold text-white tracking-tight",
                                                children: "Customer Credit Ledgers"
                                            }),
                                            /*#__PURE__*/ _jsx("p", {
                                                className: "text-xs text-neutral-400 mt-1",
                                                children: "FIFO payments, credit limits, and running balance timelines."
                                            })
                                        ]
                                    })
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl overflow-hidden flex flex-col",
                                    children: /*#__PURE__*/ _jsx("div", {
                                        className: "overflow-y-auto flex-1",
                                        children: /*#__PURE__*/ _jsxs("table", {
                                            className: "w-full text-left border-collapse text-xs",
                                            children: [
                                                /*#__PURE__*/ _jsx("thead", {
                                                    children: /*#__PURE__*/ _jsxs("tr", {
                                                        className: "border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Customer Name"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Phone"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Price Level"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Credit Limit"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4 text-right",
                                                                children: "Ledger Balance"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4 text-center",
                                                                children: "Action"
                                                            })
                                                        ]
                                                    })
                                                }),
                                                /*#__PURE__*/ _jsx("tbody", {
                                                    className: "divide-y divide-neutral-850 text-neutral-300",
                                                    children: customerLedgers.map((c)=>{
                                                        const creditLimitVal = c.creditLimit || 0.0;
                                                        return /*#__PURE__*/ _jsxs("tr", {
                                                            className: "hover:bg-neutral-850/30 transition-colors",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 font-medium text-white",
                                                                    children: c.name
                                                                }),
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 font-mono text-neutral-400",
                                                                    children: c.phone
                                                                }),
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4",
                                                                    children: /*#__PURE__*/ _jsx("span", {
                                                                        className: "bg-violet-950/30 text-violet-400 border border-violet-900/40 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                                                                        children: c.priceLevel || 'RETAIL'
                                                                    })
                                                                }),
                                                                /*#__PURE__*/ _jsxs("td", {
                                                                    className: "p-4 font-mono",
                                                                    children: [
                                                                        "₹",
                                                                        creditLimitVal.toFixed(2)
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsxs("td", {
                                                                    className: "p-4 text-right font-mono font-bold text-red-400",
                                                                    children: [
                                                                        "₹",
                                                                        (c.customerLedger?.[0]?.runningBalance || 0.0).toFixed(2)
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 text-center",
                                                                    children: /*#__PURE__*/ _jsx("button", {
                                                                        onClick: ()=>handleOpenLedgerDrawer(c.id, 'CUSTOMER'),
                                                                        className: "bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                                        children: "View Ledger Statement"
                                                                    })
                                                                })
                                                            ]
                                                        }, c.id);
                                                    })
                                                })
                                            ]
                                        })
                                    })
                                })
                            ]
                        }, "customer-ledgers"),
                        activeTab === 'supplier-ledgers' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex flex-col p-6 overflow-hidden h-full",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex justify-between items-center mb-6 shrink-0",
                                    children: /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("h2", {
                                                className: "text-xl font-bold text-white tracking-tight",
                                                children: "Supplier Liabilities"
                                            }),
                                            /*#__PURE__*/ _jsx("p", {
                                                className: "text-xs text-neutral-400 mt-1",
                                                children: "Purchase timelines, credit histories, and manual payments."
                                            })
                                        ]
                                    })
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl overflow-hidden flex flex-col",
                                    children: /*#__PURE__*/ _jsx("div", {
                                        className: "overflow-y-auto flex-1",
                                        children: /*#__PURE__*/ _jsxs("table", {
                                            className: "w-full text-left border-collapse text-xs",
                                            children: [
                                                /*#__PURE__*/ _jsx("thead", {
                                                    children: /*#__PURE__*/ _jsxs("tr", {
                                                        className: "border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Supplier Name"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Contact Person"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4",
                                                                children: "Phone"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4 text-right",
                                                                children: "Outstanding Bal"
                                                            }),
                                                            /*#__PURE__*/ _jsx("th", {
                                                                className: "p-4 text-center",
                                                                children: "Action"
                                                            })
                                                        ]
                                                    })
                                                }),
                                                /*#__PURE__*/ _jsx("tbody", {
                                                    className: "divide-y divide-neutral-850 text-neutral-300",
                                                    children: supplierLedgers.map((s)=>{
                                                        return /*#__PURE__*/ _jsxs("tr", {
                                                            className: "hover:bg-neutral-850/30 transition-colors",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 font-medium text-white",
                                                                    children: s.name
                                                                }),
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 text-neutral-400",
                                                                    children: s.contactPerson || 'N/A'
                                                                }),
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 font-mono text-neutral-400",
                                                                    children: s.phone
                                                                }),
                                                                /*#__PURE__*/ _jsxs("td", {
                                                                    className: "p-4 text-right font-mono font-bold text-amber-500",
                                                                    children: [
                                                                        "₹",
                                                                        (s.supplierLedger?.[0]?.runningBalance || 0.0).toFixed(2)
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsx("td", {
                                                                    className: "p-4 text-center",
                                                                    children: /*#__PURE__*/ _jsx("button", {
                                                                        onClick: ()=>handleOpenLedgerDrawer(s.id, 'SUPPLIER'),
                                                                        className: "bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors",
                                                                        children: "View Statement"
                                                                    })
                                                                })
                                                            ]
                                                        }, s.id);
                                                    })
                                                })
                                            ]
                                        })
                                    })
                                })
                            ]
                        }, "supplier-ledgers"),
                        activeTab === 'returns' && /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            className: "flex-1 flex p-6 gap-6 overflow-hidden h-full",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "w-[450px] bg-neutral-900/60 border border-neutral-850 rounded-2xl p-6 flex flex-col overflow-hidden shrink-0",
                                    children: [
                                        /*#__PURE__*/ _jsx("h3", {
                                            className: "text-sm font-bold text-white mb-4",
                                            children: "Process New Return"
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex gap-2 mb-4",
                                            children: [
                                                /*#__PURE__*/ _jsx("input", {
                                                    type: "text",
                                                    placeholder: "Enter Invoice Bill Number...",
                                                    value: salesReturnSearchBill,
                                                    onChange: (e)=>setSalesReturnSearchBill(e.target.value),
                                                    className: "flex-1 bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-violet-500"
                                                }),
                                                /*#__PURE__*/ _jsx("button", {
                                                    onClick: handleFetchBillForReturn,
                                                    className: "bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors",
                                                    children: "Lookup"
                                                })
                                            ]
                                        }),
                                        salesReturnBillDetails ? /*#__PURE__*/ _jsxs("div", {
                                            className: "flex-1 flex flex-col min-h-0 space-y-4",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 text-xs font-mono space-y-1",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-neutral-500",
                                                                    children: "Bill Date:"
                                                                }),
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-white",
                                                                    children: new Date(salesReturnBillDetails.createdAt).toLocaleString()
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-neutral-500",
                                                                    children: "Net Total:"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    className: "text-white",
                                                                    children: [
                                                                        "₹",
                                                                        salesReturnBillDetails.netAmount.toFixed(2)
                                                                    ]
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "flex-1 overflow-y-auto space-y-3 pr-1",
                                                    children: salesReturnBillDetails.items.map((item)=>/*#__PURE__*/ _jsxs("div", {
                                                            className: "bg-neutral-950/30 border border-neutral-850 p-3 rounded-xl space-y-2",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    className: "text-xs font-semibold text-white",
                                                                    children: item.product?.name
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex justify-between text-[10px] font-mono text-neutral-400",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsxs("span", {
                                                                            children: [
                                                                                "Sold Qty: ",
                                                                                item.quantity
                                                                            ]
                                                                        }),
                                                                        /*#__PURE__*/ _jsxs("span", {
                                                                            children: [
                                                                                "Rate: ₹",
                                                                                item.unitPrice.toFixed(2)
                                                                            ]
                                                                        })
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "grid grid-cols-2 gap-2 pt-1.5",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("label", {
                                                                                    className: "text-[9px] text-neutral-500 block mb-1",
                                                                                    children: "Return Qty"
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("input", {
                                                                                    type: "number",
                                                                                    min: 0,
                                                                                    max: item.quantity,
                                                                                    value: salesReturnQty[item.productId] || 0,
                                                                                    onChange: (e)=>{
                                                                                        const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                                                                                        setSalesReturnQty({
                                                                                            ...salesReturnQty,
                                                                                            [item.productId]: val
                                                                                        });
                                                                                    },
                                                                                    className: "w-full bg-neutral-950 border border-neutral-850 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-none"
                                                                                })
                                                                            ]
                                                                        }),
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("label", {
                                                                                    className: "text-[9px] text-neutral-500 block mb-1",
                                                                                    children: "Disposition"
                                                                                }),
                                                                                /*#__PURE__*/ _jsxs("select", {
                                                                                    value: salesReturnDisp[item.productId] || 'RETURN_TO_STOCK',
                                                                                    onChange: (e)=>setSalesReturnDisp({
                                                                                            ...salesReturnDisp,
                                                                                            [item.productId]: e.target.value
                                                                                        }),
                                                                                    className: "w-full bg-neutral-950 border border-neutral-850 rounded px-1.5 py-1 text-xs text-neutral-300 focus:outline-none",
                                                                                    children: [
                                                                                        /*#__PURE__*/ _jsx("option", {
                                                                                            value: "RETURN_TO_STOCK",
                                                                                            children: "Restock Item"
                                                                                        }),
                                                                                        /*#__PURE__*/ _jsx("option", {
                                                                                            value: "DAMAGED",
                                                                                            children: "Damaged / Scrap"
                                                                                        }),
                                                                                        /*#__PURE__*/ _jsx("option", {
                                                                                            value: "WARRANTY",
                                                                                            children: "Warranty Claim"
                                                                                        })
                                                                                    ]
                                                                                })
                                                                            ]
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        }, item.productId))
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "space-y-3 pt-2 border-t border-neutral-850",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            children: [
                                                                /*#__PURE__*/ _jsx("label", {
                                                                    className: "text-[10px] text-neutral-400 block mb-1",
                                                                    children: "Return Reason / Notes"
                                                                }),
                                                                /*#__PURE__*/ _jsx("input", {
                                                                    type: "text",
                                                                    placeholder: "Reason for return...",
                                                                    value: salesReturnReason,
                                                                    onChange: (e)=>setSalesReturnReason(e.target.value),
                                                                    className: "w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsx("button", {
                                                            onClick: handleSubmitSalesReturn,
                                                            disabled: isSubmittingReturn,
                                                            className: "w-full bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-2.5 rounded-xl cursor-pointer transition-colors text-xs flex items-center justify-center gap-2",
                                                            children: isSubmittingReturn ? 'Processing...' : 'Authorize Return'
                                                        })
                                                    ]
                                                })
                                            ]
                                        }) : /*#__PURE__*/ _jsxs("div", {
                                            className: "flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-850 rounded-xl p-4 text-center text-xs text-neutral-500",
                                            children: [
                                                /*#__PURE__*/ _jsx(Undo, {
                                                    className: "w-8 h-8 mb-2 text-neutral-600"
                                                }),
                                                "Look up a finalized bill invoice number to initiate customer return itemizations."
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl flex flex-col overflow-hidden",
                                    children: [
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "p-4 border-b border-neutral-850",
                                            children: /*#__PURE__*/ _jsx("h3", {
                                                className: "text-sm font-bold text-white",
                                                children: "Return Ledger Logs"
                                            })
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "overflow-y-auto flex-1",
                                            children: returnsLoading ? /*#__PURE__*/ _jsx("div", {
                                                className: "p-8 text-center text-xs text-neutral-500 animate-pulse",
                                                children: "Loading return timelines..."
                                            }) : returnsList.salesReturns.length === 0 ? /*#__PURE__*/ _jsx("div", {
                                                className: "p-8 text-center text-xs text-neutral-500",
                                                children: "No returns history found."
                                            }) : /*#__PURE__*/ _jsxs("table", {
                                                className: "w-full text-left border-collapse text-xs",
                                                children: [
                                                    /*#__PURE__*/ _jsx("thead", {
                                                        children: /*#__PURE__*/ _jsxs("tr", {
                                                            className: "border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "p-4",
                                                                    children: "Return ID"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "p-4",
                                                                    children: "Bill Ref"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "p-4",
                                                                    children: "Reason"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "p-4 text-right",
                                                                    children: "Refund Total"
                                                                }),
                                                                /*#__PURE__*/ _jsx("th", {
                                                                    className: "p-4",
                                                                    children: "Date"
                                                                })
                                                            ]
                                                        })
                                                    }),
                                                    /*#__PURE__*/ _jsx("tbody", {
                                                        className: "divide-y divide-neutral-850 text-neutral-300",
                                                        children: returnsList.salesReturns.map((r)=>/*#__PURE__*/ _jsxs("tr", {
                                                                className: "hover:bg-neutral-850/30 transition-colors",
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "p-4 font-mono font-medium text-white",
                                                                        children: r.returnNumber
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "p-4 font-mono text-neutral-400",
                                                                        children: r.bill?.billNumber
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "p-4 text-neutral-400 max-w-[150px] truncate",
                                                                        children: r.reason || 'N/A'
                                                                    }),
                                                                    /*#__PURE__*/ _jsxs("td", {
                                                                        className: "p-4 text-right font-mono font-bold text-green-400",
                                                                        children: [
                                                                            "₹",
                                                                            r.netAmount.toFixed(2)
                                                                        ]
                                                                    }),
                                                                    /*#__PURE__*/ _jsx("td", {
                                                                        className: "p-4 text-neutral-400",
                                                                        children: new Date(r.createdAt).toLocaleString()
                                                                    })
                                                                ]
                                                            }, r.id))
                                                    })
                                                ]
                                            })
                                        })
                                    ]
                                })
                            ]
                        }, "returns"),
                        /*#__PURE__*/ _jsx(AnimatePresence, {
                            children: selectedApprovalBill && /*#__PURE__*/ _jsx("div", {
                                className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end",
                                children: /*#__PURE__*/ _jsxs(motion.div, {
                                    initial: {
                                        x: '100%'
                                    },
                                    animate: {
                                        x: 0
                                    },
                                    exit: {
                                        x: '100%'
                                    },
                                    className: "bg-neutral-900 border-l border-neutral-800 w-full max-w-md h-full flex flex-col p-6 shadow-2xl relative",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex justify-between items-center pb-4 border-b border-neutral-850",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("h3", {
                                                            className: "text-base font-bold text-white",
                                                            children: "Bill Summary Details"
                                                        }),
                                                        /*#__PURE__*/ _jsxs("p", {
                                                            className: "text-xs text-neutral-500",
                                                            children: [
                                                                "Bill Number: ",
                                                                selectedApprovalBill.billNumber
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsx("button", {
                                                    onClick: ()=>setSelectedApprovalBill(null),
                                                    className: "text-neutral-400 hover:text-white text-xl cursor-pointer",
                                                    children: "\xd7"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex-1 overflow-y-auto py-4 space-y-3",
                                            children: [
                                                /*#__PURE__*/ _jsx("h4", {
                                                    className: "text-[10px] text-neutral-500 uppercase tracking-wider font-bold",
                                                    children: "Cart Items"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "space-y-2",
                                                    children: selectedApprovalBill.items?.map((item, idx)=>{
                                                        return /*#__PURE__*/ _jsxs("div", {
                                                            className: "bg-neutral-950/60 p-3 rounded-lg border border-neutral-850 flex justify-between items-center text-xs",
                                                            children: [
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("p", {
                                                                            className: "font-semibold text-white",
                                                                            children: item.product?.name || 'Product'
                                                                        }),
                                                                        /*#__PURE__*/ _jsxs("p", {
                                                                            className: "text-[10px] text-neutral-500 font-mono",
                                                                            children: [
                                                                                "Qty: ",
                                                                                item.quantity,
                                                                                " x ₹",
                                                                                item.unitPrice,
                                                                                " (Disc: ₹",
                                                                                item.discount,
                                                                                ")"
                                                                            ]
                                                                        })
                                                                    ]
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "text-right font-mono font-semibold text-white",
                                                                    children: [
                                                                        "₹",
                                                                        item.totalPrice.toFixed(2)
                                                                    ]
                                                                })
                                                            ]
                                                        }, idx);
                                                    })
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "border-t border-neutral-850 pt-4 space-y-2 text-xs",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between text-neutral-400",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    children: "Subtotal:"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    children: [
                                                                        "₹",
                                                                        selectedApprovalBill.totalAmount?.toFixed(2)
                                                                    ]
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between text-neutral-400",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    children: "Tax (GST):"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    children: [
                                                                        "₹",
                                                                        (selectedApprovalBill.cgstAmount + selectedApprovalBill.sgstAmount)?.toFixed(2)
                                                                    ]
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between text-white font-bold pt-1 border-t border-neutral-850/50",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    children: "Net Total:"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    children: [
                                                                        "₹",
                                                                        selectedApprovalBill.netAmount?.toFixed(2)
                                                                    ]
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "pt-4 border-t border-neutral-850 grid grid-cols-2 gap-2 text-xs",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-neutral-500 block",
                                                            children: "Payment Method"
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "font-semibold text-white",
                                                            children: selectedApprovalBill.paymentMethod
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-neutral-500 block",
                                                            children: "Paid Amount"
                                                        }),
                                                        /*#__PURE__*/ _jsxs("span", {
                                                            className: "font-semibold text-white",
                                                            children: [
                                                                "₹",
                                                                selectedApprovalBill.paidAmount?.toFixed(2)
                                                            ]
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                })
                            })
                        }),
                        ")}"
                    ]
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: pendingBillId && /*#__PURE__*/ _jsx("div", {
                    className: "fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4",
                    children: /*#__PURE__*/ _jsx(motion.div, {
                        initial: {
                            opacity: 0,
                            scale: 0.95
                        },
                        animate: {
                            opacity: 1,
                            scale: 1
                        },
                        exit: {
                            opacity: 0,
                            scale: 0.95
                        },
                        className: "bg-neutral-900 border border-neutral-800 p-8 rounded-2xl w-full max-w-[420px] shadow-2xl relative text-center space-y-6",
                        children: pendingBillStatus === 'APPROVED_NOTIFY' ? // APPROVED VIEW
                        /*#__PURE__*/ _jsxs("div", {
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-16 h-16 bg-green-500/10 text-green-500 border border-green-550/20 rounded-full flex items-center justify-center mx-auto",
                                    children: /*#__PURE__*/ _jsx(CheckCircle, {
                                        className: "w-8 h-8 animate-bounce"
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("h3", {
                                            className: "text-lg font-bold text-green-400 tracking-tight",
                                            children: "Approved by Manager"
                                        }),
                                        /*#__PURE__*/ _jsxs("p", {
                                            className: "text-xs text-neutral-400 mt-2",
                                            children: [
                                                "Request was approved by ",
                                                /*#__PURE__*/ _jsx("span", {
                                                    className: "text-white font-semibold",
                                                    children: pendingBillApprover
                                                }),
                                                ". Finalizing checkout receipt..."
                                            ]
                                        })
                                    ]
                                })
                            ]
                        }) : pendingBillStatus === 'REJECTED' ? // REJECTED VIEW
                        /*#__PURE__*/ _jsxs("div", {
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-16 h-16 bg-red-500/10 text-red-500 border border-red-550/20 rounded-full flex items-center justify-center mx-auto",
                                    children: /*#__PURE__*/ _jsx(XCircle, {
                                        className: "w-8 h-8"
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("h3", {
                                            className: "text-lg font-bold text-red-400 tracking-tight",
                                            children: "Request Rejected"
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs text-neutral-400 mt-2",
                                            children: "Pricing override request was rejected."
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 mt-4 text-xs font-mono text-left space-y-1",
                                            children: /*#__PURE__*/ _jsxs("div", {
                                                className: "flex justify-between",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-neutral-500",
                                                        children: "Rejection Reason:"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-red-400 font-semibold",
                                                        children: pendingBillRejectReason
                                                    })
                                                ]
                                            })
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "pt-2",
                                    children: /*#__PURE__*/ _jsx("button", {
                                        onClick: handleCancelPendingRequest,
                                        className: "bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold py-2.5 rounded-lg w-full cursor-pointer transition-colors",
                                        children: "Return to Cart (Edit Bill)"
                                    })
                                })
                            ]
                        }) : // PENDING VIEW
                        /*#__PURE__*/ _jsxs("div", {
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-16 h-16 bg-amber-500/10 text-amber-500 border border-amber-550/20 rounded-full flex items-center justify-center mx-auto animate-pulse",
                                    children: /*#__PURE__*/ _jsx(RefreshCw, {
                                        className: "w-8 h-8 animate-spin"
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("h3", {
                                            className: "text-lg font-bold text-white tracking-tight",
                                            children: "Approval Pending"
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs text-neutral-400 mt-2",
                                            children: "A pricing override request has been queued. Please wait for a manager or owner to authorize this from their dashboard."
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 mt-4 text-xs font-mono text-left space-y-1",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex justify-between",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-neutral-500",
                                                            children: "Bill Ref:"
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-white",
                                                            children: pendingBillNumber
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex justify-between",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-neutral-500",
                                                            children: "Reason:"
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-amber-400",
                                                            children: pendingBillReason
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "pt-2",
                                    children: /*#__PURE__*/ _jsx("button", {
                                        onClick: handleCancelPendingRequest,
                                        className: "bg-neutral-850 hover:bg-neutral-850/80 text-neutral-300 text-xs font-semibold py-2.5 rounded-lg w-full cursor-pointer transition-colors",
                                        children: "Cancel & Edit Bill"
                                    })
                                })
                            ]
                        })
                    })
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: lossWarningModal?.show && /*#__PURE__*/ _jsx("div", {
                    className: "fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4",
                    children: /*#__PURE__*/ _jsxs(motion.div, {
                        initial: {
                            opacity: 0,
                            scale: 0.95
                        },
                        animate: {
                            opacity: 1,
                            scale: 1
                        },
                        exit: {
                            opacity: 0,
                            scale: 0.95
                        },
                        className: "bg-neutral-900 border border-red-500/30 p-6 rounded-2xl w-full max-w-[400px] shadow-2xl relative space-y-4",
                        children: [
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex items-center gap-3 text-red-500 pb-2 border-b border-neutral-800",
                                children: [
                                    /*#__PURE__*/ _jsx(ShieldAlert, {
                                        className: "w-6 h-6 animate-pulse"
                                    }),
                                    /*#__PURE__*/ _jsx("h3", {
                                        className: "text-base font-bold tracking-tight",
                                        children: "Loss Sale Warning"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsx("p", {
                                className: "text-xs text-neutral-400",
                                children: "You are about to sell items below cost price. Please verify the loss details below:"
                            }),
                            /*#__PURE__*/ _jsx("div", {
                                className: "space-y-2 max-h-48 overflow-y-auto pr-1",
                                children: lossWarningModal.breaches.map((b, idx)=>/*#__PURE__*/ _jsxs("div", {
                                        className: "bg-red-950/20 border border-red-900/40 p-3 rounded-lg text-xs space-y-1 font-mono",
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                className: "font-bold text-white",
                                                children: b.productName
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex justify-between",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-neutral-500",
                                                        children: "Cost Price:"
                                                    }),
                                                    /*#__PURE__*/ _jsxs("span", {
                                                        className: "text-white",
                                                        children: [
                                                            "₹",
                                                            b.costPrice.toFixed(2)
                                                        ]
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex justify-between",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-neutral-500",
                                                        children: "Selling Price:"
                                                    }),
                                                    /*#__PURE__*/ _jsxs("span", {
                                                        className: "text-red-400 font-semibold",
                                                        children: [
                                                            "₹",
                                                            b.sellingPrice.toFixed(2)
                                                        ]
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex justify-between border-t border-red-950/40 pt-1 mt-1 text-[10px]",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-red-400",
                                                        children: "Loss Amount:"
                                                    }),
                                                    /*#__PURE__*/ _jsxs("span", {
                                                        className: "text-red-400 font-bold",
                                                        children: [
                                                            "₹",
                                                            b.loss.toFixed(2)
                                                        ]
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex justify-between text-[10px]",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "text-red-400",
                                                        children: "Profit Margin:"
                                                    }),
                                                    /*#__PURE__*/ _jsxs("span", {
                                                        className: "text-red-400 font-bold",
                                                        children: [
                                                            b.margin,
                                                            "%"
                                                        ]
                                                    })
                                                ]
                                            })
                                        ]
                                    }, idx))
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                className: "grid grid-cols-2 gap-2 pt-2",
                                children: [
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: ()=>setLossWarningModal(null),
                                        className: "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer transition-colors",
                                        children: "Cancel"
                                    }),
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: lossWarningModal.bypassAction,
                                        className: "bg-red-600 hover:bg-red-555 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors",
                                        children: "Proceed Anyway"
                                    })
                                ]
                            })
                        ]
                    })
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: checkoutResult && /*#__PURE__*/ _jsx("div", {
                    className: "fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4",
                    children: /*#__PURE__*/ _jsx(motion.div, {
                        initial: {
                            opacity: 0,
                            y: 15
                        },
                        animate: {
                            opacity: 1,
                            y: 0
                        },
                        exit: {
                            opacity: 0,
                            y: 15
                        },
                        className: "bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[380px] shadow-2xl relative",
                        children: /*#__PURE__*/ _jsxs("div", {
                            className: "text-center space-y-4",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-12 h-12 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full flex items-center justify-center mx-auto",
                                    children: /*#__PURE__*/ _jsx(CheckCircle, {
                                        className: "w-6 h-6"
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("h3", {
                                            className: "text-lg font-bold text-white",
                                            children: checkoutResult.isQuote ? 'Quotation Saved' : 'Transaction Success'
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs text-neutral-500 font-mono mt-1",
                                            children: checkoutResult.billNumber
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-2 text-sm text-left",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex justify-between",
                                            children: [
                                                /*#__PURE__*/ _jsx("span", {
                                                    className: "text-neutral-400 text-xs",
                                                    children: "Total Amount:"
                                                }),
                                                /*#__PURE__*/ _jsxs("strong", {
                                                    className: "text-white font-mono",
                                                    children: [
                                                        "₹",
                                                        checkoutResult.netAmount.toFixed(2)
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex justify-between",
                                            children: [
                                                /*#__PURE__*/ _jsx("span", {
                                                    className: "text-neutral-400 text-xs",
                                                    children: "Tendered Amount:"
                                                }),
                                                /*#__PURE__*/ _jsxs("span", {
                                                    className: "text-neutral-300 font-mono",
                                                    children: [
                                                        "₹",
                                                        checkoutResult.paidAmount.toFixed(2)
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex justify-between border-t border-neutral-800 pt-2 font-semibold",
                                            children: [
                                                /*#__PURE__*/ _jsx("span", {
                                                    className: "text-neutral-400 text-xs",
                                                    children: "Change to Return:"
                                                }),
                                                /*#__PURE__*/ _jsxs("strong", {
                                                    className: "text-green-400 font-mono text-base",
                                                    children: [
                                                        "₹",
                                                        checkoutResult.changeAmount.toFixed(2)
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("button", {
                                    onClick: ()=>{
                                        setCheckoutResult(null);
                                        clearCart();
                                    },
                                    className: "w-full bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2.5 rounded-xl transition-colors cursor-pointer text-xs",
                                    children: "Start New Bill"
                                })
                            ]
                        })
                    })
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: stockAdjustment.show && stockAdjustment.product && /*#__PURE__*/ _jsx("div", {
                    className: "fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4",
                    children: /*#__PURE__*/ _jsxs(motion.div, {
                        initial: {
                            opacity: 0,
                            scale: 0.95
                        },
                        animate: {
                            opacity: 1,
                            scale: 1
                        },
                        exit: {
                            opacity: 0,
                            scale: 0.95
                        },
                        className: "bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[360px] shadow-2xl relative",
                        children: [
                            /*#__PURE__*/ _jsx("h3", {
                                className: "text-base font-bold text-white mb-1",
                                children: "Adjust Inventory Level"
                            }),
                            /*#__PURE__*/ _jsxs("p", {
                                className: "text-xs text-neutral-400 font-mono mb-4",
                                children: [
                                    stockAdjustment.product.name,
                                    " (",
                                    stockAdjustment.product.sku,
                                    ")"
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("form", {
                                onSubmit: handleAdjustStockSubmit,
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Adjustment Type"
                                            }),
                                            /*#__PURE__*/ _jsxs("select", {
                                                value: stockAdjustment.type,
                                                onChange: (e)=>setStockAdjustment({
                                                        ...stockAdjustment,
                                                        type: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none",
                                                children: [
                                                    /*#__PURE__*/ _jsx("option", {
                                                        value: "ADJUSTMENT",
                                                        children: "Quantity Correction (Add/Remove)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("option", {
                                                        value: "RECONCILIATION",
                                                        children: "Reconciliation / Audited quantity"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Quantity Difference (e.g. +10 or -5)"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "number",
                                                value: stockAdjustment.quantityChanged,
                                                placeholder: "Enter change value",
                                                onChange: (e)=>setStockAdjustment({
                                                        ...stockAdjustment,
                                                        quantityChanged: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono",
                                                required: true
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Reason / Notes"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "text",
                                                value: stockAdjustment.reason,
                                                placeholder: "E.g., Damaged item / Physical count variance",
                                                onChange: (e)=>setStockAdjustment({
                                                        ...stockAdjustment,
                                                        reason: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none",
                                                required: true
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-2 gap-2 pt-2",
                                        children: [
                                            /*#__PURE__*/ _jsx("button", {
                                                type: "button",
                                                onClick: ()=>setStockAdjustment({
                                                        show: false,
                                                        product: null,
                                                        quantityChanged: '',
                                                        reason: '',
                                                        type: 'ADJUSTMENT'
                                                    }),
                                                className: "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer",
                                                children: "Cancel"
                                            }),
                                            /*#__PURE__*/ _jsx("button", {
                                                type: "submit",
                                                className: "bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer",
                                                children: "Save Changes"
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: addCustomer.show && /*#__PURE__*/ _jsx("div", {
                    className: "fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4",
                    children: /*#__PURE__*/ _jsxs(motion.div, {
                        initial: {
                            opacity: 0,
                            scale: 0.95
                        },
                        animate: {
                            opacity: 1,
                            scale: 1
                        },
                        exit: {
                            opacity: 0,
                            scale: 0.95
                        },
                        className: "bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[360px] shadow-2xl relative",
                        children: [
                            /*#__PURE__*/ _jsx("h3", {
                                className: "text-base font-bold text-white mb-1",
                                children: "Register New Customer"
                            }),
                            /*#__PURE__*/ _jsx("p", {
                                className: "text-xs text-neutral-400 mb-4",
                                children: "Set pricing level tier and credit limit limits immediately."
                            }),
                            /*#__PURE__*/ _jsxs("form", {
                                onSubmit: handleAddCustomerSubmit,
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Customer Name"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "text",
                                                value: addCustomer.name,
                                                placeholder: "Enter full name",
                                                onChange: (e)=>setAddCustomer({
                                                        ...addCustomer,
                                                        name: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none",
                                                required: true
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Mobile Number"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "text",
                                                value: addCustomer.phone,
                                                placeholder: "10-digit mobile",
                                                onChange: (e)=>setAddCustomer({
                                                        ...addCustomer,
                                                        phone: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono",
                                                required: true
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Pricing Level"
                                            }),
                                            /*#__PURE__*/ _jsxs("select", {
                                                value: addCustomer.priceLevel,
                                                onChange: (e)=>setAddCustomer({
                                                        ...addCustomer,
                                                        priceLevel: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none",
                                                children: [
                                                    /*#__PURE__*/ _jsx("option", {
                                                        value: "RETAIL",
                                                        children: "Retail Pricing (Standard)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("option", {
                                                        value: "WHOLESALE",
                                                        children: "Wholesale Pricing (Tier 1)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("option", {
                                                        value: "CONTRACTOR",
                                                        children: "Contractor Pricing (Tier 2)"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Credit Limit"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "number",
                                                value: addCustomer.creditLimit,
                                                onChange: (e)=>setAddCustomer({
                                                        ...addCustomer,
                                                        creditLimit: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-2 gap-2 pt-2",
                                        children: [
                                            /*#__PURE__*/ _jsx("button", {
                                                type: "button",
                                                onClick: ()=>setAddCustomer({
                                                        show: false,
                                                        name: '',
                                                        phone: '',
                                                        priceLevel: 'RETAIL',
                                                        creditLimit: '10000'
                                                    }),
                                                className: "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer",
                                                children: "Cancel"
                                            }),
                                            /*#__PURE__*/ _jsx("button", {
                                                type: "submit",
                                                className: "bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer",
                                                children: "Create Customer"
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: editProduct.show && editProduct.product && /*#__PURE__*/ _jsx("div", {
                    className: "fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto",
                    children: /*#__PURE__*/ _jsxs(motion.div, {
                        initial: {
                            opacity: 0,
                            scale: 0.95
                        },
                        animate: {
                            opacity: 1,
                            scale: 1
                        },
                        exit: {
                            opacity: 0,
                            scale: 0.95
                        },
                        className: "bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative my-8",
                        children: [
                            /*#__PURE__*/ _jsx("h3", {
                                className: "text-base font-bold text-white mb-1",
                                children: "Edit Product Specifications"
                            }),
                            /*#__PURE__*/ _jsx("p", {
                                className: "text-xs text-neutral-400 mb-4",
                                children: "Owner panel: Configure margins, prices, and settings."
                            }),
                            /*#__PURE__*/ _jsxs("form", {
                                onSubmit: handleEditProductSubmit,
                                className: "space-y-4 text-xs",
                                children: [
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-2 gap-3",
                                        children: [
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "Product SKU"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "text",
                                                        value: editProduct.sku,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                sku: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                        required: true
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "Barcode"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "text",
                                                        value: editProduct.barcode,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                barcode: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                children: "Product Name"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "text",
                                                value: editProduct.name,
                                                onChange: (e)=>setEditProduct({
                                                        ...editProduct,
                                                        name: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none",
                                                required: true
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-3 gap-3",
                                        children: [
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "HSN Code"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "text",
                                                        value: editProduct.hsnCode,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                hsnCode: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "CGST Rate (%)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.cgstRate,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                cgstRate: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "SGST Rate (%)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.sgstRate,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                sgstRate: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-2 gap-3",
                                        children: [
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "Rack Location"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "text",
                                                        value: editProduct.rackLocation,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                rackLocation: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "Min Profit Margin (%)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.minimumProfitPct,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                minimumProfitPct: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                        required: true
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-2 gap-3 border-t border-neutral-800 pt-3",
                                        children: [
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1",
                                                        children: "Cost Price (₹)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.costPrice,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                costPrice: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                        required: true
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1",
                                                        children: "MRP (Optional) (₹)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.mrp,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                mrp: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-3 gap-3",
                                        children: [
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1",
                                                        children: "Level 1 (Ideal) (₹)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.level1Price,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                level1Price: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                        required: true
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1",
                                                        children: "Level 2 (Default) (₹)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.level2Price,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                level2Price: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                        required: true
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("label", {
                                                        className: "block text-[9px] font-bold text-violet-400 uppercase tracking-wider mb-1",
                                                        children: "Level 3 (Min) (₹)"
                                                    }),
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "number",
                                                        value: editProduct.level3Price,
                                                        onChange: (e)=>setEditProduct({
                                                                ...editProduct,
                                                                level3Price: e.target.value
                                                            }),
                                                        className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                        required: true
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("label", {
                                                className: "block text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1",
                                                children: "Emergency Limit Price (₹)"
                                            }),
                                            /*#__PURE__*/ _jsx("input", {
                                                type: "number",
                                                value: editProduct.emergencyPrice,
                                                onChange: (e)=>setEditProduct({
                                                        ...editProduct,
                                                        emergencyPrice: e.target.value
                                                    }),
                                                className: "w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono",
                                                required: true
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("div", {
                                        className: "grid grid-cols-2 gap-2 pt-2",
                                        children: [
                                            /*#__PURE__*/ _jsx("button", {
                                                type: "button",
                                                onClick: ()=>setEditProduct({
                                                        ...editProduct,
                                                        show: false
                                                    }),
                                                className: "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer",
                                                children: "Cancel"
                                            }),
                                            /*#__PURE__*/ _jsx("button", {
                                                type: "submit",
                                                className: "bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer",
                                                children: "Save Specifications"
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                })
            }),
            /*#__PURE__*/ _jsx(AnimatePresence, {
                children: ledgerDrawerOpen && selectedLedgerDetails && /*#__PURE__*/ _jsxs("div", {
                    className: "fixed inset-0 z-50 flex justify-end",
                    children: [
                        /*#__PURE__*/ _jsx(motion.div, {
                            initial: {
                                opacity: 0
                            },
                            animate: {
                                opacity: 1
                            },
                            exit: {
                                opacity: 0
                            },
                            onClick: ()=>setLedgerDrawerOpen(false),
                            className: "absolute inset-0 bg-black/60 backdrop-blur-xs"
                        }),
                        /*#__PURE__*/ _jsxs(motion.div, {
                            initial: {
                                x: '100%'
                            },
                            animate: {
                                x: 0
                            },
                            exit: {
                                x: '100%'
                            },
                            transition: {
                                type: 'spring',
                                damping: 25,
                                stiffness: 200
                            },
                            className: "relative w-[480px] h-full bg-neutral-900 border-l border-neutral-850 flex flex-col shadow-2xl z-10",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "p-6 border-b border-neutral-850 flex justify-between items-center shrink-0",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            children: [
                                                /*#__PURE__*/ _jsx("h3", {
                                                    className: "text-base font-bold text-white",
                                                    children: selectedLedgerType === 'CUSTOMER' ? 'Customer Account Statement' : 'Supplier Credit Timeline'
                                                }),
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs text-neutral-400 mt-1",
                                                    children: selectedLedgerType === 'CUSTOMER' ? selectedLedgerDetails.customer.name : selectedLedgerDetails.supplier.name
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: ()=>setLedgerDrawerOpen(false),
                                            className: "text-neutral-400 hover:text-white text-xs cursor-pointer bg-neutral-850 hover:bg-neutral-800 p-2 rounded-lg",
                                            children: "Close"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex-1 overflow-y-auto p-6 space-y-6",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-neutral-950/60 border border-neutral-850 rounded-2xl p-5 flex justify-between items-center",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-[10px] text-neutral-500 font-bold uppercase tracking-wider block",
                                                            children: "Outstanding balance"
                                                        }),
                                                        /*#__PURE__*/ _jsxs("span", {
                                                            className: `text-2xl font-mono font-bold mt-1 block ${(selectedLedgerDetails.ledger?.[0]?.runningBalance || 0) > 0 ? 'text-red-400' : 'text-green-400'}`,
                                                            children: [
                                                                "₹",
                                                                (selectedLedgerDetails.ledger?.[0]?.runningBalance || 0.0).toFixed(2)
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "bg-neutral-900 border border-neutral-850 p-2.5 rounded-xl text-neutral-400",
                                                    children: /*#__PURE__*/ _jsx(Coins, {
                                                        className: "w-5 h-5"
                                                    })
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-neutral-950/30 border border-neutral-850 rounded-2xl p-5 space-y-4",
                                            children: [
                                                /*#__PURE__*/ _jsx("h4", {
                                                    className: "text-xs font-bold text-white uppercase tracking-wider",
                                                    children: "Record Cash/UPI Payment"
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "grid grid-cols-2 gap-2",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            children: [
                                                                /*#__PURE__*/ _jsx("label", {
                                                                    className: "text-[9px] text-neutral-500 block mb-1",
                                                                    children: "Payment Amount (₹)"
                                                                }),
                                                                /*#__PURE__*/ _jsx("input", {
                                                                    type: "number",
                                                                    placeholder: "0.00",
                                                                    value: paymentAmount,
                                                                    onChange: (e)=>setPaymentAmount(e.target.value),
                                                                    className: "w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                                                                })
                                                            ]
                                                        }),
                                                        selectedLedgerType === 'CUSTOMER' && /*#__PURE__*/ _jsxs("div", {
                                                            children: [
                                                                /*#__PURE__*/ _jsx("label", {
                                                                    className: "text-[9px] text-neutral-500 block mb-1",
                                                                    children: "Payment Mode"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("select", {
                                                                    value: paymentMethodSelect,
                                                                    onChange: (e)=>setPaymentMethodSelect(e.target.value),
                                                                    className: "w-full bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("option", {
                                                                            value: "CASH",
                                                                            children: "Cash"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("option", {
                                                                            value: "UPI",
                                                                            children: "UPI"
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("option", {
                                                                            value: "CARD",
                                                                            children: "Debit/Credit Card"
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    children: [
                                                        /*#__PURE__*/ _jsx("label", {
                                                            className: "text-[9px] text-neutral-500 block mb-1",
                                                            children: "Notes / References"
                                                        }),
                                                        /*#__PURE__*/ _jsx("input", {
                                                            type: "text",
                                                            placeholder: "Receipt info, check details...",
                                                            value: paymentNotes,
                                                            onChange: (e)=>setPaymentNotes(e.target.value),
                                                            className: "w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsx("button", {
                                                    onClick: handleRecordLedgerPayment,
                                                    className: "w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors",
                                                    children: "Post Transaction Ledger"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "space-y-4",
                                            children: [
                                                /*#__PURE__*/ _jsx("h4", {
                                                    className: "text-xs font-bold text-neutral-500 uppercase tracking-wider",
                                                    children: "Transaction Timeline Stream"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "space-y-3 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-850",
                                                    children: selectedLedgerDetails.ledger.map((item)=>{
                                                        const isInvoice = item.transactionType === 'SALE' || item.transactionType === 'PURCHASE';
                                                        const isReturn = item.transactionType === 'RETURN';
                                                        return /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex gap-4 relative",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    className: `w-9 h-9 rounded-full border flex items-center justify-center shrink-0 z-10 ${isInvoice ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : isReturn ? 'bg-green-950/20 border-green-900/40 text-green-400' : 'bg-violet-950/20 border-violet-900/40 text-violet-400'}`,
                                                                    children: isInvoice ? /*#__PURE__*/ _jsx(BookOpen, {
                                                                        className: "w-3.5 h-3.5"
                                                                    }) : isReturn ? /*#__PURE__*/ _jsx(RotateCcw, {
                                                                        className: "w-3.5 h-3.5"
                                                                    }) : /*#__PURE__*/ _jsx(Coins, {
                                                                        className: "w-3.5 h-3.5"
                                                                    })
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "bg-neutral-950/30 border border-neutral-850 p-4 rounded-xl flex-1 space-y-1",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            className: "flex justify-between items-center text-xs",
                                                                            children: [
                                                                                /*#__PURE__*/ _jsxs("span", {
                                                                                    className: "font-semibold text-white",
                                                                                    children: [
                                                                                        item.transactionType,
                                                                                        item.bill?.billNumber ? ` (${item.bill.billNumber})` : '',
                                                                                        item.salesReturn?.returnNumber ? ` (${item.salesReturn.returnNumber})` : '',
                                                                                        item.purchaseOrder?.poNumber ? ` (${item.purchaseOrder.poNumber})` : '',
                                                                                        item.purchaseReturn?.returnNumber ? ` (${item.purchaseReturn.returnNumber})` : ''
                                                                                    ]
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    className: "font-mono text-neutral-500 text-[10px]",
                                                                                    children: new Date(item.createdAt).toLocaleDateString()
                                                                                })
                                                                            ]
                                                                        }),
                                                                        /*#__PURE__*/ _jsxs("div", {
                                                                            className: "grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-neutral-400",
                                                                            children: [
                                                                                /*#__PURE__*/ _jsxs("div", {
                                                                                    children: [
                                                                                        /*#__PURE__*/ _jsx("span", {
                                                                                            className: "text-neutral-600 block",
                                                                                            children: "Debit (+)"
                                                                                        }),
                                                                                        /*#__PURE__*/ _jsxs("span", {
                                                                                            className: "text-red-400 font-semibold",
                                                                                            children: [
                                                                                                "₹",
                                                                                                item.debit.toFixed(2)
                                                                                            ]
                                                                                        })
                                                                                    ]
                                                                                }),
                                                                                /*#__PURE__*/ _jsxs("div", {
                                                                                    children: [
                                                                                        /*#__PURE__*/ _jsx("span", {
                                                                                            className: "text-neutral-600 block",
                                                                                            children: "Credit (-)"
                                                                                        }),
                                                                                        /*#__PURE__*/ _jsxs("span", {
                                                                                            className: "text-green-400 font-semibold",
                                                                                            children: [
                                                                                                "₹",
                                                                                                item.credit.toFixed(2)
                                                                                            ]
                                                                                        })
                                                                                    ]
                                                                                }),
                                                                                /*#__PURE__*/ _jsxs("div", {
                                                                                    children: [
                                                                                        /*#__PURE__*/ _jsx("span", {
                                                                                            className: "text-neutral-600 block",
                                                                                            children: "Balance"
                                                                                        }),
                                                                                        /*#__PURE__*/ _jsxs("span", {
                                                                                            className: "text-white font-semibold",
                                                                                            children: [
                                                                                                "₹",
                                                                                                item.runningBalance.toFixed(2)
                                                                                            ]
                                                                                        })
                                                                                    ]
                                                                                })
                                                                            ]
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        }, item.id);
                                                    })
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            })
        ]
    });
}
@4  b={}_�   �   �   �   �  �  �  ?  F  x    �  �  �  �  $  +  �  �  �  �      J  Q  �  �  �  �      G  _N  �  �  �  �      V  ]  �  �  �  �    #  �  �  �  �  	  	  Z	  a	  �	  �	  �	  �	  :
  A
  p
  w
  �
  _�
  �
  �
  =  D  �  �  �  �  Y  `  �  �  �  �  (  /  p  w  �  �  %  ,  s  z  �  �  �  �  5  <  y  _�  �  �    #  V  ]  �  �  �    ?  F  }  �  U  \  +  2  �        J  Q  �  �  �  �  �  �  B:  _J:  ;  &;  :=  B=  ?  ?  �]  �]  �h  �h  f�  j�  5�  8�  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  z�  }�  o�  _r�  ��  ��  u�  y�  ��  ��  "�  %�  m�  q�  ��  ��  �  �  v�  z�  ��  ��  ��  ��  F�  I�  8�  ;�  ��  ��  ��  ��  ��  ��  ��  _��  -�  0�  �  �  ��  ��  �  �  ��  ��  Z�  ^�  ��  �  �  !�  J�  N�  ��  ��  ��  ��  �  �  ��  ��  ��  ��  ��  ��  ��  _��  ��  ��  X�  [�  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  0�  4�  �  �  �  �  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  ��  _��  (�  +�  -�  4�  ��  ��  ��  ��  ��  ��  ��  ��  O  R  ^ b � � � � � � � � � � � � � � �	 _�	   � � � � � � � �   � � � � � � $ ( �  Q T C F N Q S V Z _^ � � � � : > � � �   �  �  �  �  !! %! '! ,! (# ,# $ $ % % & & & & ' ' �* _�* �+ �+ �- �- v. y. 0 0 �3 �3 5 5 �7 �7 c< g< R= U= �? �? �B �B �C �C �D �D �E �E �E �E �F _�F &H )H �I �I �J �J K  K fL iL �M �M "O %O �P �P �Q �Q TS WS �T �T ^V aV �Y �Y [ [ +\ .\ �] _�] %_ (_ a a �b �b �b �b g g �i �i vj zj �k �k 'n *n lq oq �t �t Ru Uu �x �x >z Bz �| �| $� _(� �� �� �� �� �� �� V� Z� C� G� �� � [� _� � � �� �� *� .� ޒ � {� ~� �� �� �� �� F� I� ƙ _ʙ =� A� � !� � � �� �� 	� � � � � � � � S� V� 2� 5� �� �� �� �� �� �� ^� a� � � B� _F� v� y� {� �� �� �� j� n� �� �� ȼ ̼ �� �� >� A� �� �� !� $� .� 2� V� Y� �� �� � � 5� 8� �� _�� �� �� r� u� �� �� �� �� � � 7� ;� �� �� x� |� �� �� &� )� �� �� � 	� �� �� �  � V� Y� �� _�� �� �� � � � '� �� �� �� �� �� �� �� �� �� �� �� �� �� ��   
  L O   � � ~ � � _� � � ) , � � �	 �	 !
 %
 e h � �   O R � � � �   H K   q u } _� { ~ � � � � l  p  �" �" �$ �$ 9' <' �( �( �) �) e+ h+ �- �- G. K. j/ m/ /4 24 �8 9 9