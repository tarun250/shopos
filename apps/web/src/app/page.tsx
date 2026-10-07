'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Keyboard, 
  ShoppingCart, 
  Package, 
  Settings, 
  Search, 
  User, 
  Plus, 
  AlertCircle, 
  CreditCard, 
  CheckCircle, 
  RefreshCw, 
  DollarSign, 
  ArrowRight,
  TrendingDown,
  Unlock,
  PlusCircle,
  Sparkles,
  Database,
  History,
  Lock,
  Layers,
  ClipboardCheck,
  ShieldAlert,
  Check,
  XCircle,
  RotateCcw,
  BookOpen,
  Trash2,
  Undo,
  ArrowLeftRight,
  Coins
} from 'lucide-react';
import AgentPanel, { AgentUiAction } from './components/AgentPanel';
import KnowledgeBase from './components/KnowledgeBase';

// ==========================================
// Types and Interfaces
// ==========================================

interface ProductPriceLevel {
  id: string;
  level: string; // 'RETAIL', 'WHOLESALE'
  price: number;
}

interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  rackLocation: string | null;
  minimumProfitPct: number;
  hsnCode: string | null;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  baseUnit: { name: string; abbreviation: string };
  priceLevels: ProductPriceLevel[];
  stockLevels: Array<{ quantity: number; costPrice: number; minStockLevel: number }>;
  mrp?: number | null;
  level1Price: number;
  level2Price: number;
  level3Price: number;
  emergencyPrice: number;
  categoryId?: string | null;
  baseUnitId?: string | null;
  isDeleted?: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface Supplier {
  id: string;
  name: string;
  companyName?: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number; // discount per unit
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  totalPrice: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  priceLevel: string;
  creditLimit: number;
  balance: number;
  gstin?: string | null;
  address?: string | null;
}

interface ActiveUser {
  userId: string;
  username: string;
  fullName: string;
  role: string;
}

export default function ShopOSApp() {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'order-history' | 'knowledge-base' | 'settings' | 'approvals' | 'returns' | 'customer-ledgers' | 'supplier-ledgers'>('pos');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteSearch, setCommandPaletteSearch] = useState('');
  const [commandPaletteIndex, setCommandPaletteIndex] = useState(0);

  // Authentication
  const [user, setUser] = useState<ActiveUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ username: 'cashier', password: 'cashier123' });

  // Pagination states
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCursor, setCatalogCursor] = useState<string | null>(null);
  const [catalogCursorHistory, setCatalogCursorHistory] = useState<string[]>([]);
  const [hasMoreCatalog, setHasMoreCatalog] = useState(true);

  // Core Data Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [isQuote, setIsQuote] = useState(false);

  // Search and selection states
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  // Approvals & Realtime Queue Polling States
  const [pendingBillId, setPendingBillId] = useState<string | null>(null);
  const [pendingBillNumber, setPendingBillNumber] = useState<string | null>(null);
  const [pendingBillStatus, setPendingBillStatus] = useState<string | null>(null);
  const [pendingBillReason, setPendingBillReason] = useState<string | null>(null);
  const [pendingBillApprover, setPendingBillApprover] = useState<string | null>(null);
  const [pendingBillRejectReason, setPendingBillRejectReason] = useState<string | null>(null);
  const [lossWarningModal, setLossWarningModal] = useState<{ show: boolean; breaches: any[]; bypassAction: () => void } | null>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [approvalFilter, setApprovalFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [selectedApprovalBill, setSelectedApprovalBill] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<{ [approvalId: string]: string }>({});

  // Returns & Ledger States
  const [returnsList, setReturnsList] = useState<{ salesReturns: any[]; purchaseReturns: any[] }>({ salesReturns: [], purchaseReturns: [] });
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [customerLedgers, setCustomerLedgers] = useState<any[]>([]);
  const [supplierLedgers, setSupplierLedgers] = useState<any[]>([]);
  const [selectedLedgerDetails, setSelectedLedgerDetails] = useState<any | null>(null);
  const [selectedLedgerType, setSelectedLedgerType] = useState<'CUSTOMER' | 'SUPPLIER' | null>(null);
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);

  // Sales Return Wizard States
  const [salesReturnSearchBill, setSalesReturnSearchBill] = useState('');
  const [salesReturnBillDetails, setSalesReturnBillDetails] = useState<any | null>(null);
  const [salesReturnQty, setSalesReturnQty] = useState<Record<string, number>>({});
  const [salesReturnDisp, setSalesReturnDisp] = useState<Record<string, string>>({});
  const [salesReturnNotes, setSalesReturnNotes] = useState<Record<string, string>>({});
  const [salesReturnReason, setSalesReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Manual payment entries
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethodSelect, setPaymentMethodSelect] = useState('CASH');

  // Modals & Floating popups
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);
  const [overrideModal, setOverrideModal] = useState<{
    show: boolean;
    reason: string;
    targetAction: () => void;
    pinInput: string;
    error: string;
    requiredRole?: 'MANAGER' | 'OWNER';
  }>({ show: false, reason: '', targetAction: () => {}, pinInput: '', error: '' });

  // Stock Adjustment modal state
  const [stockAdjustment, setStockAdjustment] = useState<{
    show: boolean;
    product: Product | null;
    quantityChanged: string;
    reason: string;
    type: 'ADJUSTMENT' | 'RECONCILIATION';
  }>({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' });

  // Customer Add dialog state
  const [addCustomer, setAddCustomer] = useState({
    show: false,
    name: '',
    phone: '',
    priceLevel: 'RETAIL',
    creditLimit: '10000',
  });

  // Product Edit dialog state
  const [editProduct, setEditProduct] = useState<{
    show: boolean;
    product: Product | null;
    name: string;
    sku: string;
    barcode: string;
    rackLocation: string;
    hsnCode: string;
    cgstRate: string;
    sgstRate: string;
    costPrice: string;
    minimumProfitPct: string;
    mrp: string;
    level1Price: string;
    level2Price: string;
    level3Price: string;
    emergencyPrice: string;
    retailPrice: string;
    wholesalePrice: string;
  }>({
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
    wholesalePrice: '0',
  });

  // Shopify-Style Product Creation Wizard state
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [aiDuplicates, setAiDuplicates] = useState<any[]>([]);
  const [aiInputQuery, setAiInputQuery] = useState('');
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  
  const [wizardData, setWizardData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    baseUnitId: '',
    rackLocation: '',
    minimumProfitPct: '10',
    hsnCode: '',
    cgstRate: '9',
    sgstRate: '9',
    igstRate: '18',
    mrp: '',
    costPrice: '0',
    level1Price: '0',
    level2Price: '0',
    level3Price: '0',
    emergencyPrice: '0',
    openingStock: '0',
    minStockLevel: '0',
    supplierId: '',
    variants: [] as Array<{ name: string; sku: string; barcode: string; price: string }>,
    relationships: [] as Array<{ relatedProductId: string; type: string }>,
  });

  // Quick Product popup state
  const [quickProduct, setQuickProduct] = useState({
    show: false,
    name: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    baseUnitId: '',
  });

  const [varForm, setVarForm] = useState({ name: '', sku: '', barcode: '', price: '' });
  const [relForm, setRelForm] = useState({ relatedProductId: '', type: 'COMPATIBLE' });

  // Order History states
  const ORDERS_PAGE_SIZE = 25;
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersSummary, setOrdersSummary] = useState<{ count: number; netTotal: number; paidTotal: number; balanceTotal: number } | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilters, setOrderFilters] = useState({ search: '', period: '30d', status: '', paymentMethod: '' });
  const [ordersPage, setOrdersPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  // Floating AI Copilot & Assist Panel states
  const [showCopilot, setShowCopilot] = useState(false);

  // Day Opening / Closing Session states
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingCard, setOpeningCard] = useState('0');
  const [openingUpi, setOpeningUpi] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');

  const [showClosingModal, setShowClosingModal] = useState(false);
  const [actualCash, setActualCash] = useState('0');
  const [closingNotes, setClosingNotes] = useState('');

  // Expenses management states
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('TEA');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseDeductDrawer, setExpenseDeductDrawer] = useState(true);

  // Reminders states
  const [reminders, setReminders] = useState<any[]>([]);
  const [showRemindersPanel, setShowRemindersPanel] = useState(false);

  // AI Settings states
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiSettingsList, setAiSettingsList] = useState<any[]>([]);

  // Offline Sandbox Indicator
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline'>('connected');

  // Input Focus Refs
  const productSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // API base URL
  const API_BASE = 'http://localhost:3001';

  // Shared so parallel 401s wait on one refresh instead of each rotating the refresh token
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const refreshAccessToken = (): Promise<string | null> => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = (async () => {
        const storedRefresh = localStorage.getItem('shopos_refresh');
        if (!storedRefresh) return null;
        try {
          const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
          });
          if (!res.ok) return null;
          const session = await res.json();
          setAuthToken(session.accessToken);
          setRefreshToken(session.refreshToken);
          localStorage.setItem('shopos_token', session.accessToken);
          localStorage.setItem('shopos_refresh', session.refreshToken);
          return session.accessToken as string;
        } catch {
          return null;
        }
      })().finally(() => {
        refreshPromiseRef.current = null;
      });
    }
    return refreshPromiseRef.current;
  };

  const secureFetch = async (url: string, options: RequestInit = {}) => {
    const withToken = (token: string | null) => {
      const headers: any = {
        ...(options.headers || {}),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return fetch(url, { ...options, headers });
    };

    const res = await withToken(localStorage.getItem('shopos_token') || authToken);
    if (res.status !== 401) return res;

    // Access tokens last 15 minutes; renew once and retry
    const newToken = await refreshAccessToken();
    if (newToken) return withToken(newToken);

    handleLogout();
    setAuthError('Your session has expired. Please log in again.');
    return res;
  };

  // ==========================================
  // Returns & Ledgers API Client Methods
  // ==========================================

  const fetchReturnsData = async () => {
    if (isSandboxMode) return;
    setReturnsLoading(true);
    try {
      const res = await secureFetch(`${API_BASE}/billing/returns`);
      if (res.ok) {
        const data = await res.json();
        setReturnsList(data);
      }
    } catch (err) {
      console.error('Error fetching returns:', err);
    } finally {
      setReturnsLoading(false);
    }
  };

  const fetchCustomersLedgersData = async () => {
    if (isSandboxMode) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomerLedgers(data);
      }
    } catch (err) {
      console.error('Error fetching customer ledgers:', err);
    }
  };

  const fetchSuppliersLedgersData = async () => {
    if (isSandboxMode) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/suppliers`);
      if (res.ok) {
        const data = await res.json();
        setSupplierLedgers(data);
      }
    } catch (err) {
      console.error('Error fetching supplier ledgers:', err);
    }
  };

  const handleFetchBillForReturn = async (billNumberArg?: unknown) => {
    const billNumber = (typeof billNumberArg === 'string' ? billNumberArg : salesReturnSearchBill).trim();
    if (!billNumber) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/bills/${encodeURIComponent(billNumber)}`);
      if (res.status === 404) {
        alert('Bill not found.');
        return;
      }
      if (res.ok) {
        const bill = await res.json();
        if (bill.isQuote || bill.status !== 'FINALIZED') {
          alert('Only finalized bills can be returned. This bill is a quote, pending approval, or rejected.');
        } else {
          setSalesReturnBillDetails(bill);
          const qMap: Record<string, number> = {};
          const dMap: Record<string, string> = {};
          const nMap: Record<string, string> = {};
          bill.items.forEach((item: any) => {
            qMap[item.productId] = 0;
            dMap[item.productId] = 'RETURN_TO_STOCK';
            nMap[item.productId] = '';
          });
          setSalesReturnQty(qMap);
          setSalesReturnDisp(dMap);
          setSalesReturnNotes(nMap);
        }
      }
    } catch (err) {
      alert('Error searching for bill details.');
    }
  };

  const handleSubmitSalesReturn = async () => {
    if (!salesReturnBillDetails) return;

    const returnItems = Object.entries(salesReturnQty)
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => {
        const originalItem = salesReturnBillDetails.items.find((i: any) => i.productId === prodId);
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
      const res = await secureFetch(`${API_BASE}/billing/returns/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleOpenLedgerDrawer = async (id: string, type: 'CUSTOMER' | 'SUPPLIER') => {
    setSelectedLedgerType(type);
    setLedgerDrawerOpen(true);
    setSelectedLedgerDetails(null);

    try {
      const endpoint = type === 'CUSTOMER' 
        ? `${API_BASE}/billing/customers/${id}/ledger`
        : `${API_BASE}/billing/suppliers/${id}/ledger`;
      const res = await secureFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setSelectedLedgerDetails(data);
      }
    } catch (err) {
      console.error('Error fetching ledger details:', err);
    }
  };

  const handleRecordLedgerPayment = async () => {
    if (!selectedLedgerDetails) return;
    const amountVal = Number(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    try {
      const isCust = selectedLedgerType === 'CUSTOMER';
      const endpoint = isCust
        ? `${API_BASE}/billing/customers/${selectedLedgerDetails.customer.id}/payments`
        : `${API_BASE}/billing/suppliers/${selectedLedgerDetails.supplier.id}/payments`;

      const res = await secureFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        handleOpenLedgerDrawer(
          isCust ? selectedLedgerDetails.customer.id : selectedLedgerDetails.supplier.id,
          selectedLedgerType!
        );
      } else {
        const err = await res.json();
        alert(err.message || 'Payment recording failed.');
      }
    } catch (err) {
      alert('Network error recording ledger payment.');
    }
  };

  // Opens a tab the same way the sidebar does; returns false when the tab is unknown or not allowed
  const openTabByName = (path: string): boolean => {
    if (path === 'pos' || path === 'inventory' || path === 'order-history') {
      setActiveTab(path);
    } else if (path === 'knowledge-base' && (user?.role === 'OWNER' || user?.role === 'MANAGER')) {
      setActiveTab(path);
    } else if (path === 'customer-ledgers') {
      setActiveTab(path);
      fetchCustomersLedgersData();
    } else if (path === 'supplier-ledgers') {
      setActiveTab(path);
      fetchSuppliersLedgersData();
    } else if (path === 'returns') {
      setActiveTab(path);
      fetchReturnsData();
    } else if (path === 'approvals' && (user?.role === 'OWNER' || user?.role === 'MANAGER')) {
      setActiveTab(path);
    } else {
      return false;
    }
    return true;
  };

  // ==========================================
  // Order History
  // ==========================================

  const fetchOrders = async () => {
    if (isSandboxMode) return;
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(ordersPage), take: String(ORDERS_PAGE_SIZE) });
      if (orderFilters.search.trim()) params.set('search', orderFilters.search.trim());
      if (orderFilters.status) params.set('status', orderFilters.status);
      if (orderFilters.paymentMethod) params.set('paymentMethod', orderFilters.paymentMethod);
      const daysBack = ({ today: 0, '7d': 6, '30d': 29 } as Record<string, number>)[orderFilters.period];
      if (daysBack !== undefined) {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - daysBack);
        params.set('from', from.toISOString());
      }
      const res = await secureFetch(`${API_BASE}/billing/bills?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.items);
        setOrdersTotal(data.total);
        setOrdersSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching order history:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const updateOrderFilters = (patch: Partial<typeof orderFilters>) => {
    setOrderFilters(prev => ({ ...prev, ...patch }));
    setOrdersPage(1);
  };

  const openOrderDetail = async (idOrNumber: string) => {
    setActiveTab('order-history');
    setSelectedOrder(null);
    setOrderDetailLoading(true);
    try {
      const res = await secureFetch(`${API_BASE}/billing/bills/${encodeURIComponent(idOrNumber)}`);
      if (res.ok) {
        setSelectedOrder(await res.json());
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const startReturnFromOrder = (billNumber: string) => {
    setSelectedOrder(null);
    setActiveTab('returns');
    fetchReturnsData();
    setSalesReturnSearchBill(billNumber);
    handleFetchBillForReturn(billNumber);
  };

  // Adds a product with a quantity; functional update so it is safe from async agent callbacks
  const addProductToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const recalc = (item: CartItem): CartItem => {
        const taxable = Math.max(0, (item.unitPrice - item.discount) * item.quantity);
        const cgstAmount = (taxable * item.cgstRate) / 100;
        const sgstAmount = (taxable * item.sgstRate) / 100;
        return { ...item, cgstAmount, sgstAmount, totalPrice: taxable + cgstAmount + sgstAmount };
      };
      const existing = prev.findIndex(item => item.product.id === product.id);
      if (existing > -1) {
        return prev.map((item, i) => (i === existing ? recalc({ ...item, quantity: item.quantity + quantity }) : item));
      }
      return [...prev, recalc({
        product,
        quantity,
        unitPrice: product.level2Price,
        discount: 0,
        cgstRate: product.cgstRate,
        sgstRate: product.sgstRate,
        cgstAmount: 0,
        sgstAmount: 0,
        totalPrice: 0,
      })];
    });
  };

  // Screen actions requested by the AI assistant (navigation, POS cart, opening bills)
  const handleAgentUiAction = async (action: AgentUiAction) => {
    if (action.type === 'navigate') {
      if (action.page === 'settings') triggerOpenAiSettings();
      else openTabByName(action.page);
    } else if (action.type === 'open_bill') {
      openOrderDetail(action.billNumber);
    } else if (action.type === 'add_to_cart') {
      const res = await secureFetch(`${API_BASE}/products/${action.productId}`);
      if (res.ok) {
        setActiveTab('pos');
        addProductToCart(await res.json(), Number(action.quantity) || 1);
      }
    } else if (action.type === 'set_pos_customer') {
      let customer = customers.find(c => c.id === action.customerId);
      if (!customer) {
        const res = await secureFetch(`${API_BASE}/billing/customers`);
        if (res.ok) {
          const all: Customer[] = await res.json();
          setCustomers(all);
          customer = all.find(c => c.id === action.customerId);
        }
      }
      if (customer) {
        setActiveTab('pos');
        setSelectedCustomer(customer);
      }
    } else if (action.type === 'refresh') {
      fetchCatalogProducts(undefined, true);
    }
  };

  const handleOpenSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = Number(openingCash || 0);
    const card = Number(openingCard || 0);
    const upi = Number(openingUpi || 0);
    if (cash < 0 || card < 0 || upi < 0) {
      alert('Opening balances cannot be negative.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/session/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingUser: user?.username || 'cashier',
          openingCash: cash,
          openingCard: card,
          openingUpi: upi,
          openingNotes
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setShowOpeningModal(false);
        alert('Day session opened successfully!');
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Open session failed: ${err.message}`);
    }
  };

  const handleCloseSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const actual = Number(actualCash || 0);
    if (actual < 0) {
      alert('Counted physical cash cannot be negative.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCash: actual,
          closingNotes,
          userId: user?.userId || 'SYSTEM'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setShowClosingModal(false);
        alert('Day session closed successfully!');
        fetchAllData();
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Close session failed: ${err.message}`);
    }
  };

  const handleCreateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount || 0);
    if (isNaN(amt) || amt <= 0) {
      alert('Expense amount must be a positive number.');
      return;
    }
    if (!expenseNotes.trim()) {
      alert('Expense description is required.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseCategory,
          amount: amt,
          notes: expenseNotes,
          deductFromDrawer: expenseDeductDrawer
        })
      });
      if (res.ok) {
        alert('Expense logged successfully!');
        setExpenseAmount('');
        setExpenseNotes('');
        setShowExpenseModal(false);
        fetchExpenses();
        fetchActiveSession();
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Log expense failed: ${err.message}`);
    }
  };

  const triggerOpenAiSettings = () => {
    fetchAiSettings();
    setShowAiSettings(true);
  };

  const fetchAiSettings = async () => {
    try {
      const res = await secureFetch(`${API_BASE}/ai/settings`);
      if (res.ok) {
        const data = await res.json();
        const defaultSettings = [
          { key: 'openrouter_api_key', value: '' },
          { key: 'groq_api_key', value: '' },
          { key: 'gemini_api_key', value: '' },
          { key: 'ai_provider_priority', value: 'OpenRouter,Groq,Gemini' },
          { key: 'ai_model_ocr', value: 'gemini-2.5-flash' },
          { key: 'ai_model_reasoning', value: 'google/gemini-2.5-pro' },
          { key: 'ai_model_autocomplete', value: 'llama-3.3-70b-specdec' },
          { key: 'ai_temperature', value: '0.3' },
          { key: 'cash_diff_threshold', value: '500' }
        ];
        const merged = defaultSettings.map(def => {
          const match = data.find((d: any) => d.key === def.key);
          return match ? { key: def.key, value: match.value } : def;
        });
        setAiSettingsList(merged);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAiSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await secureFetch(`${API_BASE}/ai/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: aiSettingsList })
      });
      if (res.ok) {
        alert('AI Configuration updated successfully!');
        setShowAiSettings(false);
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Update settings failed: ${err.message}`);
    }
  };

  // ==========================================
  // Fetch Data Functions
  // ==========================================

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch products (limit to take=20 for performance)
      const prodRes = await secureFetch(`${API_BASE}/products?take=20`);
      if (prodRes.status === 401) return; // session expired, secureFetch already logged out
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
        setBackendStatus('connected');
      } else {
        throw new Error('API server down');
      }

      // 2. Fetch customers
      const custRes = await secureFetch(`${API_BASE}/billing/customers`);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
      }

      // 3. Fetch lookup lists used by product forms
      const [catRes, unitRes, supRes] = await Promise.all([
        secureFetch(`${API_BASE}/products/categories`),
        secureFetch(`${API_BASE}/products/units`),
        secureFetch(`${API_BASE}/billing/suppliers`),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (unitRes.ok) setUnits(await unitRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());

      await fetchActiveSession();
      await fetchExpenses();
      await fetchReminders();
    } catch (e) {
      console.warn('Backend offline, running in sandbox mode with static mock data.');
      setBackendStatus('offline');
      setIsSandboxMode(true);
      // Load mock items
      setProducts(getMockProducts());
      setCustomers(getMockCustomers());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const res = await secureFetch(`${API_BASE}/session/status`);
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
      }
    } catch (e) {
      console.error('Active session fetch failed:', e);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await secureFetch(`${API_BASE}/expenses`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (e) {
      console.error('Expenses fetch failed:', e);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await secureFetch(`${API_BASE}/reminders`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (e) {
      console.error('Reminders fetch failed:', e);
    }
  };

  const fetchCatalogProducts = async (searchVal?: string, resetCursor = false) => {
    if (isSandboxMode) return;
    const targetCursor = resetCursor ? null : catalogCursor;
    let url = `${API_BASE}/products?take=20`;
    if (targetCursor) {
      url += `&cursor=${targetCursor}`;
    }
    const currentSearch = searchVal !== undefined ? searchVal : catalogSearch;
    if (currentSearch.trim()) {
      url += `&search=${encodeURIComponent(currentSearch)}`;
    }

    try {
      const res = await secureFetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        setHasMoreCatalog(data.length === 20);
        if (resetCursor) {
          setCatalogCursorHistory([]);
          setCatalogCursor(null);
        }
      }
    } catch (err) {
      console.error('Error fetching catalog products:', err);
    }
  };

  const handleCatalogNextPage = () => {
    if (products.length === 0) return;
    const lastProduct = products[products.length - 1];
    setCatalogCursorHistory([...catalogCursorHistory, catalogCursor || '']);
    setCatalogCursor(lastProduct.id);
  };

  const handleCatalogPrevPage = () => {
    if (catalogCursorHistory.length === 0) return;
    const prevHistory = [...catalogCursorHistory];
    const prevCursor = prevHistory.pop();
    setCatalogCursorHistory(prevHistory);
    setCatalogCursor(prevCursor || null);
  };

  const handleCatalogSearchChange = (val: string) => {
    setCatalogSearch(val);
    fetchCatalogProducts(val, true);
  };
  const fetchAuditLogs = async () => {
    if (isSandboxMode) {
      setAuditLogs([
        { id: '1', action: 'OFFLINE_SANDBOX_ACTIVE', details: JSON.stringify({ mode: 'Developer Sandbox' }), createdAt: new Date().toISOString() }
      ]);
      return;
    }
    try {
      const res = await secureFetch(`${API_BASE}/products`); // Fetching audit logs fallback or simple logs
      // In this demo, we mock fetch logs or read them
      setAuditLogs([
        { id: 'seed-1', action: 'DATABASE_SEED', details: JSON.stringify({ status: 'Successful' }), createdAt: new Date().toISOString() }
      ]);
    } catch (e) {}
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('shopos_user');
    const savedToken = localStorage.getItem('shopos_token');
    const savedRefresh = localStorage.getItem('shopos_refresh');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setAuthToken(savedToken);
      setRefreshToken(savedRefresh);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllData();
      fetchAuditLogs();
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'inventory') {
      fetchCatalogProducts();
    }
  }, [catalogCursor, activeTab, user]);

  useEffect(() => {
    if (!selectedOrder) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedOrder(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedOrder]);

  useEffect(() => {
    if (!user || activeTab !== 'order-history') return;
    // Debounce typing in the search box
    const timer = setTimeout(fetchOrders, orderFilters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [user, activeTab, orderFilters, ordersPage]);



  // Handle product searches
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts([]);
      return;
    }
    const q = productSearch.toLowerCase();
    const matches = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.includes(q))
    );
    setFilteredProducts(matches.slice(0, 5));
    setActiveSearchIndex(0);
  }, [productSearch, products]);

  // Handle customer searches
  useEffect(() => {
    if (!customerSearch) {
      setFilteredCustomers([]);
      return;
    }
    const q = customerSearch.toLowerCase();
    const matches = customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    );
    setFilteredCustomers(matches.slice(0, 5));
  }, [customerSearch, customers]);



  const getCommands = () => {
    const list = [
      { id: 'goto-pos', name: 'Go to POS Billing', category: 'Navigation', shortcut: 'Alt+1', action: () => setActiveTab('pos') },
      { id: 'goto-inventory', name: 'Go to Inventory Catalog', category: 'Navigation', shortcut: 'Alt+2', action: () => setActiveTab('inventory') },
      { id: 'goto-returns', name: 'Go to Returns Center', category: 'Navigation', shortcut: 'Alt+3', action: () => setActiveTab('returns') },
      { id: 'goto-cust-ledger', name: 'Go to Customer Ledgers', category: 'Navigation', shortcut: 'Alt+4', action: () => setActiveTab('customer-ledgers') },
      { id: 'goto-sup-ledger', name: 'Go to Supplier Ledgers', category: 'Navigation', shortcut: 'Alt+5', action: () => setActiveTab('supplier-ledgers') },
      { id: 'goto-approvals', name: 'Go to Approvals Queue', category: 'Navigation', shortcut: 'Alt+6', action: () => setActiveTab('approvals') },
      { id: 'open-copilot', name: 'Open AI Copilot Assistant', category: 'Copilot', shortcut: 'Ctrl+Shift+Space', action: () => setShowCopilot(true) },
      { id: 'open-ai-settings', name: 'AI Settings & Keys Config', category: 'Settings', shortcut: 'Ctrl+Alt+S', action: () => triggerOpenAiSettings() },
      { id: 'open-session-opening', name: 'Open Day Opening Checklist', category: 'Session', shortcut: 'Ctrl+Shift+O', action: () => setShowOpeningModal(true) },
      { id: 'open-session-closing', name: 'Close Day & Cash Drawer Count', category: 'Session', shortcut: 'Ctrl+Shift+C', action: () => setShowClosingModal(true) },
      { id: 'open-expense-modal', name: 'Log Expense (Fuel, Transport, Salary)', category: 'Expenses', shortcut: 'Ctrl+Alt+E', action: () => setShowExpenseModal(true) },
      { id: 'toggle-theme', name: 'Toggle Dark / Light Mode', category: 'Preferences', shortcut: 'Ctrl+T', action: () => setIsDarkMode(prev => !prev) },
      { id: 'toggle-density', name: 'Toggle High Density (Compact Mode)', category: 'Preferences', shortcut: 'Ctrl+D', action: () => setIsCompactMode(prev => !prev) },
      { id: 'logout', name: 'Sign Out Session', category: 'Account', shortcut: 'Ctrl+Q', action: () => handleLogout() },
    ];
    return list.filter(cmd => cmd.name.toLowerCase().includes(commandPaletteSearch.toLowerCase()));
  };

  // Keyboard Navigation Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift + Ctrl + Space - Toggle AI Copilot Panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        setShowCopilot(prev => !prev);
        return;
      }

      // 0. Ctrl + K - Toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        setCommandPaletteSearch('');
        setCommandPaletteIndex(0);
        return;
      }

      // Command Palette Keyboard Navigation Interceptor
      if (isCommandPaletteOpen) {
        const filteredCmds = getCommands();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCommandPaletteIndex(prev => (prev + 1) % Math.max(1, filteredCmds.length));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCommandPaletteIndex(prev => (prev - 1 + filteredCmds.length) % Math.max(1, filteredCmds.length));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCmds[commandPaletteIndex]) {
            filteredCmds[commandPaletteIndex].action();
          }
          setIsCommandPaletteOpen(false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsCommandPaletteOpen(false);
        }
        return;
      }

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
        setIsQuote(prev => !prev);
      }

      // Quick Tab Switching: Alt + 1..6
      if (e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const tabMap: Record<string, 'pos' | 'inventory' | 'returns' | 'customer-ledgers' | 'supplier-ledgers' | 'approvals'> = {
          '1': 'pos',
          '2': 'inventory',
          '3': 'returns',
          '4': 'customer-ledgers',
          '5': 'supplier-ledgers',
          '6': 'approvals',
        };
        const targetTab = tabMap[e.key];
        if (targetTab) {
          setActiveTab(targetTab);
        }
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, products, selectedCustomer, activeTab]);

  // ==========================================
  // Login Functions
  // ==========================================

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password,
        }),
      });

      if (res.ok) {
        const session = await res.json();
        setUser(session.user);
        setAuthToken(session.accessToken);
        setRefreshToken(session.refreshToken);
        localStorage.setItem('shopos_user', JSON.stringify(session.user));
        localStorage.setItem('shopos_token', session.accessToken);
        localStorage.setItem('shopos_refresh', session.refreshToken);
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
        role: loginForm.username === 'manager' ? 'MANAGER' : 'CASHIER',
      });
      setIsSandboxMode(true);
      setBackendStatus('offline');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickBypass = () => {
    setUser({
      userId: 'bypass-id',
      username: 'cashier',
      fullName: 'Anil Cashier (Local Sandbox)',
      role: 'CASHIER',
    });
    setIsSandboxMode(true);
    setBackendStatus('offline');
  };

  const handleLogout = () => {
    setUser(null);
    setAuthToken(null);
    setRefreshToken(null);
    localStorage.removeItem('shopos_user');
    localStorage.removeItem('shopos_token');
    localStorage.removeItem('shopos_refresh');
    setCart([]);
    setSelectedCustomer(null);
    setOverallDiscount(0);
    setPaidAmount('0');
    setActiveTab('pos');
  };

  // ==========================================
  // POS Billing Logic
  // ==========================================

  // Default fallback is Level 2 Price under the new pricing model
  const getProductPrice = (product: Product, level: string): number => {
    return product.level2Price;
  };

  const addToCart = (product: Product) => {
    const price = product.level2Price;
    
    // Check if already in cart
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      // recalculate total price based on active selling price
      const activePrice = updated[existingIndex].unitPrice - updated[existingIndex].discount;
      const taxable = Math.max(0, activePrice * updated[existingIndex].quantity);
      updated[existingIndex].cgstAmount = (taxable * updated[existingIndex].cgstRate) / 100;
      updated[existingIndex].sgstAmount = (taxable * updated[existingIndex].sgstRate) / 100;
      updated[existingIndex].totalPrice = taxable + updated[existingIndex].cgstAmount + updated[existingIndex].sgstAmount;
      setCart(updated);
    } else {
      const itemTaxable = price;
      const cgst = (itemTaxable * product.cgstRate) / 100;
      const sgst = (itemTaxable * product.sgstRate) / 100;
      
      const newCartItem: CartItem = {
        product,
        quantity: 1,
        unitPrice: price,
        discount: 0,
        cgstRate: product.cgstRate,
        sgstRate: product.sgstRate,
        cgstAmount: cgst,
        sgstAmount: sgst,
        totalPrice: price + cgst + sgst,
      };
      setCart([...cart, newCartItem]);
    }
    setProductSearch('');
    setFilteredProducts([]);
  };

  const updateCartQty = (index: number, qty: number) => {
    if (qty <= 0) return;
    const updated = [...cart];
    updated[index].quantity = qty;

    const taxable = Math.max(0, (updated[index].unitPrice - updated[index].discount) * qty);
    updated[index].cgstAmount = (taxable * updated[index].cgstRate) / 100;
    updated[index].sgstAmount = (taxable * updated[index].sgstRate) / 100;
    updated[index].totalPrice = taxable + updated[index].cgstAmount + updated[index].sgstAmount;
    setCart(updated);
  };

  const updateCartSellingPrice = (index: number, sellingPrice: number) => {
    if (sellingPrice < 0) return;
    const updated = [...cart];
    const defaultPrice = updated[index].product.level2Price;

    if (sellingPrice >= defaultPrice) {
      updated[index].unitPrice = sellingPrice;
      updated[index].discount = 0;
    } else {
      updated[index].unitPrice = defaultPrice;
      updated[index].discount = Math.max(0, defaultPrice - sellingPrice);
    }

    const taxable = Math.max(0, sellingPrice * updated[index].quantity);
    updated[index].cgstAmount = (taxable * updated[index].cgstRate) / 100;
    updated[index].sgstAmount = (taxable * updated[index].sgstRate) / 100;
    updated[index].totalPrice = taxable + updated[index].cgstAmount + updated[index].sgstAmount;
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setOverallDiscount(0);
    setPaidAmount('0');
  };

  const calculateCartTotals = () => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    
    cart.forEach(item => {
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
  useEffect(() => {
    if (!pendingBillId) return;

    const interval = setInterval(async () => {
      try {
        const res = await secureFetch(`${API_BASE}/billing/bills/${pendingBillId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'FINALIZED') {
            clearInterval(interval);
            setPendingBillStatus('APPROVED_NOTIFY');
            setPendingBillApprover(data.approverName || 'Manager');

            setTimeout(() => {
              const actualPaid = paymentMethod === 'CASH' ? Number(paidAmount) : totals.netAmount;
              setCheckoutResult({
                billNumber: pendingBillNumber || 'BILL-SUCCESS',
                netAmount: totals.netAmount,
                paidAmount: actualPaid,
                changeAmount: Math.max(0, actualPaid - totals.netAmount),
                isQuote,
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

    return () => clearInterval(interval);
  }, [pendingBillId, pendingBillNumber, totals, paidAmount, isQuote, paymentMethod]);

  // Fetch approvals queue list for managers/owners
  const fetchApprovals = async () => {
    try {
      const res = await secureFetch(`${API_BASE}/billing/approvals`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchApprovals();
      const interval = setInterval(fetchApprovals, 5000); // 5s refresh
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchAiSettings();
    }
  }, [activeTab]);

  const handleActionApproval = async (approvalId: string, action: 'APPROVE' | 'REJECT') => {
    const reason = rejectionReasonInput[approvalId] || '';
    if (action === 'REJECT' && !reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/billing/approvals/${approvalId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: user?.userId,
          reason,
        }),
      });

      if (res.ok) {
        fetchApprovals();
        setRejectionReasonInput(prev => ({ ...prev, [approvalId]: '' }));
      } else {
        const err = await res.json();
        alert(err.message || 'Action failed.');
      }
    } catch (err) {
      alert('Network error processing approval action.');
    }
  };

  const handleCancelPendingRequest = async () => {
    if (!pendingBillId) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/bills/${pendingBillId}`, {
        method: 'DELETE',
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

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerSearch('');
    setFilteredCustomers([]);
  };

  // Pricing engine validation: Level 3 (Manager approval) and Emergency (Owner approval) checks
  const handlePOSCheckout = () => {
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
    cart.forEach(item => {
      const sellPrice = item.unitPrice - item.discount;
      if (sellPrice <= 0) hasZeroPrice = true;
    });

    if (hasZeroPrice) {
      alert("Error: Biller cannot make the selling price zero or negative.");
      return;
    }

    // 2. Loss Sale Detection
    const lossBreaches = cart
      .filter(item => {
        const sellPrice = item.unitPrice - item.discount;
        const costPrice = item.product.stockLevels?.[0]?.costPrice || 0;
        return sellPrice <= costPrice;
      })
      .map(item => {
        const sellPrice = item.unitPrice - item.discount;
        const costPrice = item.product.stockLevels?.[0]?.costPrice || 0;
        const profit = sellPrice - costPrice;
        const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
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
          bypassAction: () => {
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
    const level3Breaches = cart.filter(item => {
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

  const executeCheckout = async (approvedByManagerId?: string, bypassLossWarning?: boolean) => {
    setIsCheckingOut(true);
    
    const actualPaid = paymentMethod === 'CASH' ? Number(paidAmount) : totals.netAmount;
    const payload = {
      billData: {
        customerId: selectedCustomer?.id || null,
        items: cart.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
        discountAmount: overallDiscount,
        paymentMethod,
        paidAmount: actualPaid,
        isQuote,
        approvedByManagerId,
        bypassLossWarning,
      },
      userId: user?.userId,
    };

    if (isSandboxMode) {
      setTimeout(() => {
        const invoiceNum = isQuote ? `QTE-${Date.now().toString().slice(-6)}` : `BILL-${Date.now().toString().slice(-6)}`;
        setCheckoutResult({
          billNumber: invoiceNum,
          netAmount: totals.netAmount,
          paidAmount: actualPaid,
          changeAmount: Math.max(0, actualPaid - totals.netAmount),
          isQuote,
        });
        
        if (!isQuote) {
          const updatedProds = products.map(p => {
            const cartItem = cart.find(ci => ci.product.id === p.id);
            if (cartItem) {
              const updatedInv = [...p.stockLevels];
              updatedInv[0].quantity = Math.max(0, updatedInv[0].quantity - cartItem.quantity);
              return { ...p, stockLevels: updatedInv };
            }
            return p;
          });
          setProducts(updatedProds);
        }

        setIsCheckingOut(false);
      }, 800);
      return;
    }

    const requiresApproval = cart.some(item => (item.unitPrice - item.discount) < item.product.level3Price) && !approvedByManagerId && user?.role !== 'OWNER';

    let optimisticInvoice = `BILL-${Date.now().toString().slice(-6)}`;
    const savedCart = [...cart];
    const savedCustomer = selectedCustomer;
    const savedDiscount = overallDiscount;
    const savedPaidAmount = paidAmount;

    if (!requiresApproval) {
      setCheckoutResult({
        billNumber: optimisticInvoice,
        netAmount: totals.netAmount,
        paidAmount: actualPaid,
        changeAmount: Math.max(0, actualPaid - totals.netAmount),
        isQuote,
      });
      setCart([]);
      setSelectedCustomer(null);
      setOverallDiscount(0);
      setPaidAmount('0');
      setIsCheckingOut(false);
    }

    try {
      const res = await secureFetch(`${API_BASE}/billing/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const order = await res.json();
        if (order.status === 'PENDING_APPROVAL') {
          setPendingBillId(order.id);
          setPendingBillNumber(order.billNumber);
          setPendingBillStatus('PENDING_APPROVAL');
          setPendingBillReason('Price override below limit');
          setCheckoutResult(null);
        } else {
          setCheckoutResult({
            billNumber: order.billNumber,
            netAmount: order.netAmount,
            paidAmount: order.paidAmount,
            changeAmount: Math.max(0, order.paidAmount - order.netAmount),
            isQuote: order.isQuote,
          });
          fetchCatalogProducts();
        }
      } else {
        const err = await res.json();
        if (!requiresApproval) {
          alert(`Checkout failed: ${err.message || 'Error occurred.'}. Reverting cart.`);
          setCart(savedCart);
          setSelectedCustomer(savedCustomer);
          setOverallDiscount(savedDiscount);
          setPaidAmount(savedPaidAmount);
          setCheckoutResult(null);
        } else {
          alert(err.message || 'Checkout failed.');
        }
      }
    } catch (err) {
      if (!requiresApproval) {
        alert('Network error during checkout. Reverting cart.');
        setCart(savedCart);
        setSelectedCustomer(savedCustomer);
        setOverallDiscount(savedDiscount);
        setPaidAmount(savedPaidAmount);
        setCheckoutResult(null);
      } else {
        alert('Network error during checkout.');
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ==========================================
  // Inventory Stock Adjustments
  // ==========================================

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjustment.product || !stockAdjustment.quantityChanged) return;

    const qty = Number(stockAdjustment.quantityChanged);
    if (isNaN(qty)) return;

    if (isSandboxMode) {
      // Offline edit
      const updatedProds = products.map(p => {
        if (p.id === stockAdjustment.product?.id) {
          const updatedInv = [...p.stockLevels];
          updatedInv[0].quantity = Math.max(0, updatedInv[0].quantity + qty);
          return { ...p, stockLevels: updatedInv };
        }
        return p;
      });
      setProducts(updatedProds);
      setStockAdjustment({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' });
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/products/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: stockAdjustment.product.id,
          quantityChanged: qty,
          type: stockAdjustment.type,
          costPrice: stockAdjustment.product.stockLevels?.[0]?.costPrice,
          userId: user?.userId,
          reason: stockAdjustment.reason,
        }),
      });

      if (res.ok) {
        setStockAdjustment({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' });
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

  const triggerEditProduct = (p: Product) => {
    const retail = p.priceLevels.find(pl => pl.level === 'RETAIL')?.price || 0;
    const wholesale = p.priceLevels.find(pl => pl.level === 'WHOLESALE')?.price || 0;
    const cost = p.stockLevels?.[0]?.costPrice || 0;

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
      mrp: p.mrp != null ? p.mrp.toString() : '',
      level1Price: String(p.level1Price ?? 0),
      level2Price: String(p.level2Price ?? 0),
      level3Price: String(p.level3Price ?? 0),
      emergencyPrice: String(p.emergencyPrice ?? 0),
      retailPrice: retail.toString(),
      wholesalePrice: wholesale.toString(),
    });
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
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
      wholesalePrice: Number(editProduct.wholesalePrice),
    };

    if (!payload.name.trim()) {
      alert('Product name is required.');
      return;
    }
    if (payload.costPrice < 0 || payload.retailPrice < 0 || payload.wholesalePrice < 0) {
      alert('Pricing values cannot be negative.');
      return;
    }
    if (payload.cgstRate < 0 || payload.sgstRate < 0 || payload.minimumProfitPct < 0) {
      alert('Tax and profit margins cannot be negative.');
      return;
    }

    if (isSandboxMode) {
      const updatedProds = products.map(p => {
        if (p.id === editProduct.product?.id) {
          const prices = [
            { id: '1', level: 'RETAIL', price: payload.retailPrice },
            { id: '2', level: 'WHOLESALE', price: payload.wholesalePrice }
          ];
           const inv = [{ ...p.stockLevels?.[0], costPrice: payload.costPrice }];
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
            stockLevels: inv,
          } as any;
        }
        return p;
      });
      setProducts(updatedProds);
      setEditProduct(prev => ({ ...prev, show: false }));
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/products/${editProduct.product.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditProduct(prev => ({ ...prev, show: false }));
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
  // Product Creation Wizard Helper Logic
  // ==========================================

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await secureFetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: wizardData.sku || `SKU-${Date.now().toString().slice(-6)}`,
          barcode: wizardData.barcode || null,
          name: wizardData.name,
          description: wizardData.description || null,
          rackLocation: wizardData.rackLocation || null,
          minimumProfitPct: Number(wizardData.minimumProfitPct || 10.0),
          hsnCode: wizardData.hsnCode || null,
          cgstRate: Number(wizardData.cgstRate || 0.0),
          sgstRate: Number(wizardData.sgstRate || 0.0),
          igstRate: Number(wizardData.igstRate || 0.0),
          mrp: wizardData.mrp ? Number(wizardData.mrp) : null,
          level1Price: Number(wizardData.level1Price || 0.0),
          level2Price: Number(wizardData.level2Price || 0.0),
          level3Price: Number(wizardData.level3Price || 0.0),
          emergencyPrice: Number(wizardData.emergencyPrice || 0.0),
          categoryId: wizardData.categoryId || null,
          baseUnitId: wizardData.baseUnitId,
          openingStock: Number(wizardData.openingStock || 0.0),
          minStockLevel: Number(wizardData.minStockLevel || 0.0),
          costPrice: Number(wizardData.costPrice || 0.0),
          variants: wizardData.variants,
          userId: user?.userId,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      
      alert('Product created successfully using the wizard!');
      setShowCreateWizard(false);
      setWizardStep(0);
      setWizardData({
        sku: '',
        barcode: '',
        name: '',
        description: '',
        categoryId: '',
        baseUnitId: '',
        rackLocation: '',
        minimumProfitPct: '10',
        hsnCode: '',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        mrp: '',
        costPrice: '0',
        level1Price: '0',
        level2Price: '0',
        level3Price: '0',
        emergencyPrice: '0',
        openingStock: '0',
        minStockLevel: '0',
        supplierId: '',
        variants: [],
        relationships: [],
      });
      fetchAllData();
    } catch (err: any) {
      alert(`Wizard creation failed: ${err.message}`);
    }
  };

  const applyTemplate = (type: string) => {
    if (type === 'electrical') {
      setWizardData(prev => ({
        ...prev,
        categoryId: categories.find(c => c.name === 'Electricals')?.id || '',
        baseUnitId: units.find(u => u.abbreviation === 'pc')?.id || '',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        minimumProfitPct: '12',
        hsnCode: '85395200',
      }));
    } else if (type === 'automobile') {
      setWizardData(prev => ({
        ...prev,
        categoryId: categories.find(c => c.name === 'Auto Spares')?.id || '',
        baseUnitId: units.find(u => u.abbreviation === 'pc')?.id || '',
        cgstRate: '14',
        sgstRate: '14',
        igstRate: '28',
        minimumProfitPct: '15',
        hsnCode: '85111000',
      }));
    } else if (type === 'hardware') {
      setWizardData(prev => ({
        ...prev,
        categoryId: categories.find(c => c.name === 'Hardware & Tools')?.id || '',
        baseUnitId: units.find(u => u.abbreviation === 'pc')?.id || '',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        minimumProfitPct: '8',
        hsnCode: '73181500',
      }));
    }
  };

  const handleAiExtract = async () => {
    if (!aiInputQuery) return;
    setIsAiExtracting(true);
    try {
      const res = await secureFetch(`${API_BASE}/products/ai-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiInputQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setWizardData(prev => ({
          ...prev,
          name: `${data.brand || ''} ${data.variant || ''} ${data.volume || ''}`.trim(),
          hsnCode: data.hsn || '',
          cgstRate: String(data.gst ? data.gst / 2 : 9.0),
          sgstRate: String(data.gst ? data.gst / 2 : 9.0),
          igstRate: String(data.gst || 18.0),
          categoryId: categories.find(c => c.name.toLowerCase().includes(data.category?.toLowerCase() || ''))?.id || prev.categoryId,
          baseUnitId: units.find(u => u.name.toLowerCase().includes(data.units?.toLowerCase() || ''))?.id || prev.baseUnitId,
        }));
        alert(`AI Extracted successfully! Confidence: ${data.confidence || 1.0}`);
      }
    } catch (err: any) {
      alert(`AI Extraction failed: ${err.message}`);
    } finally {
      setIsAiExtracting(false);
    }
  };

  const copyProductDetails = (productId: string) => {
    const src = products.find(p => p.id === productId);
    if (!src) return;
    const retail = src.priceLevels.find(pl => pl.level === 'RETAIL')?.price || 0;
    const wholesale = src.priceLevels.find(pl => pl.level === 'WHOLESALE')?.price || 0;
    const cost = src.stockLevels?.[0]?.costPrice || 0;

    setWizardData(prev => ({
      ...prev,
      name: `${src.name} (Copy)`,
      description: src.description || '',
      categoryId: src.categoryId || '',
      baseUnitId: src.baseUnitId || '',
      rackLocation: src.rackLocation || '',
      minimumProfitPct: String(src.minimumProfitPct),
      hsnCode: src.hsnCode || '',
      cgstRate: String(src.cgstRate),
      sgstRate: String(src.sgstRate),
      igstRate: String(src.igstRate),
      mrp: src.mrp ? String(src.mrp) : '',
      costPrice: String(cost),
      level1Price: String(src.level1Price),
      level2Price: String(src.level2Price),
      level3Price: String(src.level3Price),
      emergencyPrice: String(src.emergencyPrice),
    }));
  };

  const deleteProduct = async (pId: string) => {
    if (!confirm('Are you sure you want to soft-delete this product? It will be moved to the Recycle Bin.')) return;
    try {
      const res = await secureFetch(`${API_BASE}/products/${pId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Product moved to Recycle Bin.');
      fetchAllData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const restoreProduct = async (pId: string) => {
    try {
      const res = await secureFetch(`${API_BASE}/products/${pId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Product restored successfully!');
      fetchAllData();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  const handleQuickProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProduct.name.trim()) {
      alert('Product name is required.');
      return;
    }
    const cost = Number(quickProduct.costPrice || 0);
    const sell = Number(quickProduct.sellingPrice || 0);
    if (cost < 0 || sell < 0) {
      alert('Price values cannot be negative.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: `QPROD-${Date.now().toString().slice(-6)}`,
          name: quickProduct.name,
          categoryId: quickProduct.categoryId,
          baseUnitId: quickProduct.baseUnitId,
          costPrice: Number(quickProduct.costPrice || 0),
          level2Price: Number(quickProduct.sellingPrice || 0),
          level1Price: Number(quickProduct.sellingPrice || 0),
          level3Price: Number(quickProduct.sellingPrice || 0),
          openingStock: 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newProd = await res.json();
      
      // Auto-load and addToCart
      const prodRes = await secureFetch(`${API_BASE}/products?take=100`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
        const match = prodData.find((p: any) => p.id === newProd.id);
        if (match) addToCart(match);
      }

      setQuickProduct({
        show: false,
        name: '',
        categoryId: '',
        costPrice: '',
        sellingPrice: '',
        baseUnitId: '',
      });
    } catch (err: any) {
      alert(`Quick product creation failed: ${err.message}`);
    }
  };

  // ==========================================
  // Add Customer Logic
  // ==========================================

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCustomer.name.trim() || !addCustomer.phone.trim()) {
      alert('Customer Name and Phone number are required.');
      return;
    }
    const limit = Number(addCustomer.creditLimit);
    if (isNaN(limit) || limit < 0) {
      alert('Credit limit must be a positive number.');
      return;
    }

    if (isSandboxMode) {
      const newCust: Customer = {
        id: `local-cust-${Date.now()}`,
        name: addCustomer.name,
        phone: addCustomer.phone,
        email: null,
        gstin: null,
        address: null,
        creditLimit: Number(addCustomer.creditLimit) || 10000,
        balance: 0,
        priceLevel: addCustomer.priceLevel,
      };
      setCustomers([...customers, newCust]);
      setAddCustomer({ show: false, name: '', phone: '', priceLevel: 'RETAIL', creditLimit: '10000' });
      handleSelectCustomer(newCust);
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/billing/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addCustomer.name,
          phone: addCustomer.phone,
          priceLevel: addCustomer.priceLevel,
          creditLimit: Number(addCustomer.creditLimit),
        }),
      });

      if (res.ok) {
        const freshCust = await res.json();
        setCustomers([...customers, freshCust]);
        setAddCustomer({ show: false, name: '', phone: '', priceLevel: 'RETAIL', creditLimit: '10000' });
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

  function getMockProducts(): Product[] {
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
        baseUnit: { name: 'Piece', abbreviation: 'pc' },
        priceLevels: [],
        mrp: 150.0,
        level1Price: 120.0,
        level2Price: 110.0,
        level3Price: 90.0,
        emergencyPrice: 80.0,
        stockLevels: [{ quantity: 250, costPrice: 75.0, minStockLevel: 20 }],
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
        baseUnit: { name: 'Piece', abbreviation: 'pc' },
        priceLevels: [],
        mrp: 200.0,
        level1Price: 180.0,
        level2Price: 160.0,
        level3Price: 135.0,
        emergencyPrice: 120.0,
        stockLevels: [{ quantity: 120, costPrice: 110.0, minStockLevel: 15 }],
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
        baseUnit: { name: 'Meter', abbreviation: 'm' },
        priceLevels: [],
        mrp: 20.0,
        level1Price: 15.0,
        level2Price: 13.5,
        level3Price: 11.0,
        emergencyPrice: 10.0,
        stockLevels: [{ quantity: 800, costPrice: 9.5, minStockLevel: 100 }],
      },
    ];
  }

  function getMockCustomers(): Customer[] {
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
        gstin: null,
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
        gstin: null,
      },
    ];
  }

  // ==========================================
  // Render Login Layout
  // ==========================================

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 relative overflow-hidden select-none">
        {/* Glow elements in corners to look premium */}
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px] bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl relative"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-3">
              <Layers className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">SHOPOS</h1>
            <p className="text-xs text-neutral-400 mt-1">Enterprise POS & Inventory Platform</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Username</label>
              <input 
                type="text"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Password</label>
              <input 
                type="password"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-neutral-200 text-neutral-950 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Log In'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">Developer Sandbox</span></div>
          </div>

          <button 
            type="button"
            onClick={handleQuickBypass}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm py-2 rounded-lg transition-colors cursor-pointer border border-neutral-700/50"
          >
            Launch Offline Mock POS
          </button>

          <div className="mt-6 text-center text-xs text-neutral-500">
            <p>Seeded accounts: <strong className="text-neutral-300">cashier</strong> (3333) | <strong className="text-neutral-300">manager</strong> (2222)</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // Render Application Shell
  // ==========================================

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isDarkMode ? 'bg-neutral-950 text-neutral-100 dark' : 'bg-neutral-50 text-neutral-900 light'} ${isCompactMode ? 'compact-mode' : ''}`}>
      
      {/* 1. Sidebar */}
      <aside className={`w-64 border-r flex flex-col justify-between shrink-0 ${isDarkMode ? 'bg-neutral-900/30 border-neutral-850' : 'bg-white border-neutral-200 shadow-sm'}`}>
        <div>
          {/* Header & Connection status */}
          <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-neutral-850' : 'border-neutral-200'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/10">
                <Layers className="text-white w-4.5 h-4.5" />
              </div>
              <div>
                <h1 className={`font-bold tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>SHOPOS</h1>
                <span className="text-[10px] text-neutral-400 mt-1 block font-medium">ERP + Billing Platform</span>
              </div>
            </div>
            {/* Sync Pulse */}
            <div className={`flex items-center gap-1.5 border px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-neutral-950/60 border-neutral-850' : 'bg-neutral-100 border-neutral-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'} sync-anim`} />
              <span className={`text-[8px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>{backendStatus}</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1">
            <button 
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'pos' 
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>POS Billing</span>
            </button>
            <button 
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'inventory' 
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products & Stock</span>
            </button>
            <button
              onClick={() => setActiveTab('order-history')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'order-history'
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm')
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <History className="w-4 h-4" />
              <span>Order History</span>
            </button>
            {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
              <button
                onClick={() => setActiveTab('knowledge-base')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'knowledge-base'
                    ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm')
                    : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Knowledge Base</span>
              </button>
            )}
            <button 
              onClick={() => {
                setActiveTab('customer-ledgers');
                fetchCustomersLedgersData();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'customer-ledgers' 
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Customer Ledgers</span>
            </button>
            <button 
              onClick={() => {
                setActiveTab('supplier-ledgers');
                fetchSuppliersLedgersData();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'supplier-ledgers' 
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Supplier Ledgers</span>
            </button>
            <button 
              onClick={() => {
                setActiveTab('returns');
                fetchReturnsData();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'returns' 
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Return Center</span>
            </button>
            {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
              <button 
                onClick={() => setActiveTab('approvals')}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'approvals' 
                    ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                    : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
                }`}
              >
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Approval Center</span>
                </div>
                {approvals.filter(a => a.status === 'PENDING').length > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-4 leading-none">
                    {approvals.filter(a => a.status === 'PENDING').length}
                  </span>
                )}
              </button>
            )}
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                activeTab === 'settings' 
                  ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm') 
                  : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900')
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Dev Console & Logs</span>
            </button>
          </nav>
        </div>

        {/* Footer profile & controls */}
        <div className={`p-4 border-t space-y-3 ${isDarkMode ? 'border-neutral-850' : 'border-neutral-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-neutral-400 tracking-wider uppercase">Controls</span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setIsDarkMode(prev => !prev)} 
                title="Toggle Theme"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                  isDarkMode 
                    ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800' 
                    : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button 
                onClick={() => setIsCompactMode(prev => !prev)} 
                title="Toggle Compact Mode"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                  isCompactMode 
                    ? 'bg-violet-950/40 border-violet-800/40 text-violet-400 hover:bg-violet-950/50' 
                    : isDarkMode 
                      ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800' 
                      : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                🔬
              </button>
              <button 
                onClick={() => setIsCommandPaletteOpen(true)} 
                title="Command Palette"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                  isDarkMode 
                    ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800' 
                    : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                ⌨️
              </button>
            </div>
          </div>

          <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
            isDarkMode ? 'bg-neutral-950/40 border-neutral-850' : 'bg-neutral-100 border-neutral-200'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border ${
                isDarkMode ? 'bg-neutral-850 border-neutral-750 text-violet-400' : 'bg-neutral-200 border-neutral-300 text-violet-650'
              }`}>
                {user.fullName.slice(0,2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className={`text-xs font-medium truncate leading-tight ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>{user.fullName}</p>
                <span className="text-[9px] text-neutral-400 uppercase tracking-wider">{user.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="text-neutral-400 hover:text-red-400 transition-colors cursor-pointer" title="Log Out">
              <Lock className="w-4 h-4" />
            </button>
          </div>

          <div className={`text-[10px] p-2 rounded-lg text-center flex items-center justify-center gap-1.5 border ${
            isDarkMode ? 'text-neutral-500 bg-neutral-950/20 border-neutral-900/40' : 'text-neutral-600 bg-neutral-200/50 border-neutral-300/30'
          }`}>
            <Keyboard className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
            <span>Press <kbd className={`font-mono px-1 py-0.5 rounded border text-[9px] ${
              isDarkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-600'
            }`}>Ctrl + K</kbd> for actions</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-950 relative">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: POS Billing Workspace */}
          {activeTab === 'pos' && (
            <motion.div 
              key="pos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex overflow-hidden h-full"
            >
              {/* Left Column: Cart Grid & Invoice Panel */}
              <div className="flex-1 flex flex-col min-w-0 h-full border-r border-neutral-800/80">
                
                {/* Day Session Indicator Banner */}
                {!activeSession ? (
                  <div className="bg-amber-600/10 border-b border-amber-500/25 p-3 flex justify-between items-center text-xs shrink-0 text-amber-400">
                    <span>⚠️ Day Session is currently closed. Register opening cash to start billing.</span>
                    <button 
                      type="button"
                      onClick={() => setShowOpeningModal(true)}
                      className="bg-amber-600 hover:bg-amber-550 text-white font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer"
                    >
                      Open Day Session
                    </button>
                  </div>
                ) : (
                  <div className="bg-neutral-900/40 border-b border-neutral-800 p-2.5 flex justify-between items-center text-[10px] text-neutral-400 shrink-0 font-mono">
                    <div>
                      <span>Shift: <span className="text-white font-semibold">{activeSession.openingUser}</span> • Active since {new Date(activeSession.openingTime).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowExpenseModal(true)}
                        className="bg-neutral-850 hover:bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-800 transition-colors cursor-pointer"
                      >
                        Log Expense
                      </button>
                      <button 
                        type="button"
                        onClick={() => setShowClosingModal(true)}
                        className="bg-red-950/40 hover:bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-900/30 transition-colors cursor-pointer font-semibold"
                      >
                        Close Day Shift
                      </button>
                    </div>
                  </div>
                )}

                {/* Product Search Bar */}
                <div className="p-4 border-b border-neutral-800 flex items-center gap-3 relative shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-2.5 text-neutral-500 w-4.5 h-4.5" />
                    <input 
                      ref={productSearchRef}
                      type="text"
                      placeholder="Scan barcode, enter SKU, product name, or alias (Ctrl + Space)..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    />

                    {/* Search Results Dropdown */}
                    {filteredProducts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                        {filteredProducts.map((p, idx) => (
                          <div 
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className="flex items-center justify-between px-4 py-2 hover:bg-neutral-800/60 cursor-pointer transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium text-white">{p.name}</p>
                              <p className="text-xs text-neutral-400 font-mono">{p.sku} • Rack: {p.rackLocation || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-white">₹{getProductPrice(p, selectedCustomer?.priceLevel || 'RETAIL')}</p>
                              <span className="text-[10px] text-neutral-500">Qty: {p.stockLevels?.[0]?.quantity ?? 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {productSearch && filteredProducts.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-40 overflow-hidden py-4 text-center space-y-2">
                        <p className="text-xs text-neutral-400">No products match "{productSearch}"</p>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickProduct({
                              show: true,
                              name: productSearch,
                              categoryId: categories[0]?.id || '',
                              costPrice: '',
                              sellingPrice: '',
                              baseUnitId: units[0]?.id || '',
                            });
                            setProductSearch('');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-750 text-white transition-colors cursor-pointer"
                        >
                          + Quick Create Product
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsQuote(prev => !prev)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        isQuote 
                          ? 'bg-amber-600/20 text-amber-400 border-amber-500/50' 
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      {isQuote ? 'Quote Mode Active' : 'Quote Mode (F4)'}
                    </button>
                    <button 
                      onClick={clearCart}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors cursor-pointer"
                    >
                      Clear Cart
                    </button>
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                      <div className="w-16 h-16 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-center text-neutral-500 mb-4">
                        <ShoppingCart className="w-7 h-7" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">Cart is empty</h3>
                      <p className="text-xs text-neutral-500 max-w-[240px] mt-1">Scan a barcode or type a product name to begin checkout flow.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          <th className="py-2.5">Product & SKU</th>
                          <th className="py-2.5 text-right w-24">Default Price</th>
                          <th className="py-2.5 text-center w-28">Quantity</th>
                          <th className="py-2.5 text-right w-24 text-blue-400">Selling Price</th>
                          <th className="py-2.5 text-right w-24">GST</th>
                          <th className="py-2.5 text-right w-28">Total</th>
                          <th className="py-2.5 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {cart.map((item, idx) => {
                          const sellPrice = item.unitPrice - item.discount;
                          const isElevated = user?.role === 'OWNER' || user?.role === 'MANAGER';
                          const profit = sellPrice - (item.product.stockLevels?.[0]?.costPrice || 0);
                          const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
                          const isMarginWarning = margin < item.product.minimumProfitPct;

                          return (
                            <tr key={idx} className="group hover:bg-neutral-900/30 transition-colors">
                              <td className="py-3 pr-2">
                                <p className="text-xs font-semibold text-white leading-snug">{item.product.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-neutral-500 font-mono">{item.product.sku}</span>
                                  {isElevated && isMarginWarning && (
                                    <span className="text-[8px] bg-red-950 text-red-400 border border-red-900/40 px-1 rounded flex items-center gap-0.5">
                                      <TrendingDown className="w-2.5 h-2.5" /> Margin: {margin.toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 text-right font-mono text-xs text-neutral-400">
                                ₹{item.product.level2Price.toFixed(2)}
                              </td>
                              <td className="py-3 text-center">
                                <div className="inline-flex items-center bg-neutral-900 border border-neutral-800 rounded-md">
                                  <button 
                                    onClick={() => updateCartQty(idx, item.quantity - 1)}
                                    className="px-2 py-0.5 text-xs text-neutral-500 hover:text-white"
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number"
                                    value={item.quantity}
                                    onChange={e => updateCartQty(idx, Number(e.target.value))}
                                    className="w-10 bg-transparent text-center text-xs font-mono text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button 
                                    onClick={() => updateCartQty(idx, item.quantity + 1)}
                                    className="px-2 py-0.5 text-xs text-neutral-500 hover:text-white"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 pr-2">
                                <input 
                                  type="number"
                                  value={Number(sellPrice.toFixed(2)) || ''}
                                  placeholder="0.00"
                                  onChange={e => updateCartSellingPrice(idx, Number(e.target.value))}
                                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-1.5 py-0.5 text-right text-xs font-mono text-white focus:outline-none"
                                />
                              </td>
                              <td className="py-3 text-right font-mono text-[10px] text-neutral-400 leading-none">
                                <div>C: {item.cgstRate}%</div>
                                <div className="mt-1">S: {item.sgstRate}%</div>
                              </td>
                              <td className="py-3 text-right font-semibold font-mono text-xs text-white">
                                ₹{item.totalPrice.toFixed(2)}
                              </td>
                              <td className="py-3 text-center">
                                <button 
                                  onClick={() => removeFromCart(idx)}
                                  className="text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Cart Calculations Summary Footer */}
                {cart.length > 0 && (
                  <div className="p-5 border-t border-neutral-800 bg-neutral-900/20 shrink-0 space-y-4">
                    <div className="grid grid-cols-4 gap-4 text-right">
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Taxable Amt</span>
                        <span className="text-sm font-semibold font-mono text-neutral-200">₹{totals.subtotal.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Total CGST</span>
                        <span className="text-sm font-semibold font-mono text-neutral-200">₹{totals.cgst.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Total SGST</span>
                        <span className="text-sm font-semibold font-mono text-neutral-200">₹{totals.sgst.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Final Bill Total</span>
                        <span className="text-base font-bold font-mono text-violet-400">₹{totals.netAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Customer Details & Checkout Splits */}
              <div className="w-80 flex flex-col h-full bg-neutral-900/10 p-5 shrink-0">
                <div className="flex-1 space-y-6">
                  
                  {/* Section A: Customer Account Link */}
                  <div>
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Customer Account</h3>
                    
                    {!selectedCustomer ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 text-neutral-500 w-3.5 h-3.5" />
                          <input 
                            ref={customerSearchRef}
                            type="text"
                            placeholder="Search customer by mobile..."
                            value={customerSearch}
                            onChange={e => setCustomerSearch(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                          />

                          {/* Customer Search results */}
                          {filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden">
                              {filteredCustomers.map(c => (
                                <div 
                                  key={c.id}
                                  onClick={() => handleSelectCustomer(c)}
                                  className="px-3 py-2 hover:bg-neutral-800 cursor-pointer flex justify-between items-center text-xs"
                                >
                                  <div>
                                    <p className="font-semibold text-white">{c.name}</p>
                                    <p className="text-neutral-400">{c.phone}</p>
                                  </div>
                                  <span className="bg-neutral-800 text-[10px] px-1.5 py-0.5 rounded text-neutral-300">{c.priceLevel}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => setAddCustomer(prev => ({ ...prev, show: true }))}
                          className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Register New Customer</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-neutral-900 border border-neutral-800/80 p-3.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-white">{selectedCustomer.name}</p>
                            <p className="text-[10px] text-neutral-500">{selectedCustomer.phone}</p>
                          </div>
                          <button 
                            onClick={() => setSelectedCustomer(null)}
                            className="text-[10px] text-neutral-400 hover:text-red-400 cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                        <div className="h-px bg-neutral-800/80 my-2" />
                        <div className="flex justify-between text-[10px]">
                          <span className="text-neutral-400">Pricing Tier:</span>
                          <span className="font-semibold text-violet-400 uppercase tracking-wider">{selectedCustomer.priceLevel}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-neutral-400">Ledger Balance:</span>
                          <span className={`font-semibold ${selectedCustomer.balance > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                            ₹{selectedCustomer.balance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section C: Payment Method Selector */}
                  <div>
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Payment Method</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map(method => {
                        const isDisabled = method === 'CREDIT' && !selectedCustomer;
                        return (
                          <button 
                            key={method}
                            disabled={isDisabled}
                            onClick={() => setPaymentMethod(method)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border text-center ${
                              isDisabled 
                                ? 'opacity-30 border-neutral-800 text-neutral-500 cursor-not-allowed'
                                : paymentMethod === method 
                                  ? 'bg-violet-600 border-violet-500 text-white' 
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                            }`}
                          >
                            {method}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section D: Cash Change Calculation */}
                  {paymentMethod === 'CASH' && (
                    <div className="space-y-3 bg-neutral-950/40 border border-neutral-850 p-4 rounded-xl">
                      <div>
                        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Customer Cash Handed Over</h3>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-neutral-500 text-xs font-mono">₹</span>
                          <input 
                            type="number"
                            value={paidAmount}
                            onChange={e => setPaidAmount(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-6 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                            placeholder="0.00"
                          />
                        </div>
                        {/* Tender quick match suggestions */}
                        {cart.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            <button 
                              onClick={() => setPaidAmount(totals.netAmount.toFixed(0))}
                              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 text-[10px] text-neutral-300 px-2 py-1 rounded transition-colors cursor-pointer"
                            >
                              Exact Cash
                            </button>
                            <button 
                              onClick={() => setPaidAmount((Math.ceil(totals.netAmount / 100) * 100).toString())}
                              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 text-[10px] text-neutral-300 px-2 py-1 rounded transition-colors cursor-pointer"
                            >
                              Next ₹100
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Display Change to Return */}
                      <div className="flex justify-between items-center pt-2 border-t border-neutral-805 text-xs">
                        <span className="text-neutral-400">Amount to Return:</span>
                        <span className="font-mono font-bold text-green-400 text-sm">
                          ₹{Math.max(0, Number(paidAmount) - totals.netAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Checkout Trigger */}
                {(() => {
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

                  return (
                    <button 
                      onClick={handlePOSCheckout}
                      disabled={isBtnDisabled}
                      className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4 shadow-lg shadow-violet-600/10"
                    >
                      {isCheckingOut ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>{buttonText}</span>
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {/* TAB 2: Products & Inventory Catalog */}
          {activeTab === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 overflow-hidden h-full"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Products & Stock Ledger</h2>
                  <p className="text-xs text-neutral-400 mt-1">Multi-tier prices, shelf locations, and manual inventory adjustments.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRecycleBin(true)}
                    className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-800 transition-colors cursor-pointer"
                  >
                    Recycle Bin
                  </button>
                  {user?.role === 'OWNER' || user?.role === 'MANAGER' ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateWizard(true)}
                      className="bg-violet-600 hover:bg-violet-550 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      + Create Product
                    </button>
                  ) : null}
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 text-neutral-500 w-3.5 h-3.5" />
                    <input 
                      type="text"
                      placeholder="Search SKU or name..."
                      value={catalogSearch}
                      onChange={e => handleCatalogSearchChange(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Inventory Table Container */}
              <div className="flex-1 bg-neutral-900/35 border border-neutral-800 rounded-xl overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-neutral-950/20">
                      <th className="p-3">Product Name & SKU</th>
                      <th className="p-3 text-center">Base Unit</th>
                      {user?.role === 'OWNER' || user?.role === 'MANAGER' ? (
                        <th className="p-3 text-right">Cost Price</th>
                      ) : null}
                      <th className="p-3 text-right">Retail Price</th>
                      <th className="p-3 text-right">Wholesale Price</th>
                      <th className="p-3 text-center">Rack Location</th>
                      <th className="p-3 text-right">Qty in Stock</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/70 text-xs">
                    {products.map(p => {
                      const retail = p.priceLevels.find(pl => pl.level === 'RETAIL')?.price || 0;
                      const wholesale = p.priceLevels.find(pl => pl.level === 'WHOLESALE')?.price || 0;
                      const stock = p.stockLevels?.[0]?.quantity || 0;
                      const isLowStock = stock <= (p.stockLevels?.[0]?.minStockLevel || 0);
                      const isElevated = user?.role === 'OWNER' || user?.role === 'MANAGER';

                      return (
                        <tr key={p.id} className="hover:bg-neutral-900/20 transition-colors">
                          <td className="p-3">
                            <p className="font-semibold text-white">{p.name}</p>
                            <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">{p.sku}</span>
                          </td>
                          <td className="p-3 text-center text-neutral-300 font-mono">
                            {p.baseUnit.abbreviation}
                          </td>
                          {isElevated ? (
                            <td className="p-3 text-right font-mono text-neutral-300">
                              ₹{(p.stockLevels?.[0]?.costPrice || 0).toFixed(2)}
                            </td>
                          ) : null}
                          <td className="p-3 text-right font-mono text-white">
                            ₹{retail.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono text-violet-400">
                            ₹{wholesale.toFixed(2)}
                          </td>
                          <td className="p-3 text-center text-neutral-400 font-mono">
                            {p.rackLocation || 'Shelf N/A'}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-mono font-bold ${isLowStock ? 'text-red-400' : 'text-green-400'}`}>
                              {stock}
                            </span>
                            {isLowStock && <span className="text-[8px] bg-red-950 text-red-400 px-1 rounded block text-center mt-0.5">Low Stock</span>}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button 
                                onClick={() => setStockAdjustment({
                                  show: true,
                                  product: p,
                                  quantityChanged: '',
                                  reason: '',
                                  type: 'ADJUSTMENT'
                                })}
                                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                              >
                                Adjust Stock
                              </button>
                              {isElevated && (
                                <>
                                  <button 
                                    onClick={() => triggerEditProduct(p)}
                                    className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => deleteProduct(p.id)}
                                    className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer font-semibold"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4 shrink-0 bg-neutral-950/20 border border-neutral-800 px-4 py-2.5 rounded-xl text-xs">
                <span className="text-neutral-400">
                  Page Depth: <span className="text-white font-semibold font-mono">{catalogCursorHistory.length + 1}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCatalogPrevPage}
                    disabled={catalogCursorHistory.length === 0}
                    className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    Previous Page
                  </button>
                  <button 
                    onClick={handleCatalogNextPage}
                    disabled={!hasMoreCatalog}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    Next Page
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Settings & Developer Console */}
          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">System Settings & Developer Console</h2>
                <p className="text-xs text-neutral-400 mt-1">Audit logs, system seed resets, and client database stats.</p>
              </div>

              {/* Dev Stats grid */}
              <div className="grid grid-cols-3 gap-4 shrink-0">
                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-violet-600/10 text-violet-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider">Database Mode</h4>
                    <p className="text-sm font-semibold text-white">{isSandboxMode ? 'Offline Sandbox (SQLite fallback)' : 'PostgreSQL Database'}</p>
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-600/10 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider">Total SKUs Tracked</h4>
                    <p className="text-sm font-semibold text-white">{products.length} Products</p>
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-600/10 text-blue-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider">Manager PIN Override Status</h4>
                    <p className="text-sm font-semibold text-white">Active (Code overrides enabled)</p>
                  </div>
                </div>
              </div>

              {/* Split Settings Layout */}
              <div className="flex-1 flex gap-6 min-h-0">
                {/* Left column: AI Configurations form */}
                <div className="w-1/2 bg-neutral-900/30 border border-neutral-800 rounded-xl flex flex-col min-h-0">
                  <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-violet-400" /> AI Provider Keys & Settings
                    </span>
                    <button 
                      onClick={fetchAiSettings}
                      className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1 rounded transition-colors cursor-pointer"
                    >
                      Reload Settings
                    </button>
                  </div>
                  <form onSubmit={handleSaveAiSettingsSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                    <div className="space-y-3">
                      {aiSettingsList.length === 0 ? (
                        <div className="text-center py-6 text-neutral-500 font-mono text-[10px]">
                          Click Reload Settings to fetch active keys.
                        </div>
                      ) : (
                        aiSettingsList.map((item, idx) => (
                          <div key={idx} className="flex flex-col gap-1.5">
                            <span className="font-mono text-[10px] text-neutral-400">{item.key}:</span>
                            <input 
                              type="text"
                              value={item.value}
                              onChange={e => {
                                const updated = [...aiSettingsList];
                                updated[idx].value = e.target.value;
                                setAiSettingsList(updated);
                              }}
                              className="bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-violet-500 transition-colors"
                            />
                          </div>
                        ))
                      )}
                    </div>
                    <div className="pt-2">
                      <button 
                        type="submit" 
                        className="w-full bg-violet-600 hover:bg-violet-550 text-white font-semibold py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        Save Configuration
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right column: Audit Logs list */}
                <div className="w-1/2 bg-neutral-900/30 border border-neutral-800 rounded-xl flex flex-col min-h-0">
                  <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-4 h-4" /> System Audit Logs (Latest 50 events)
                    </span>
                    <button 
                      onClick={fetchAllData}
                      className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1 rounded transition-colors cursor-pointer"
                    >
                      Refresh Logs
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] text-neutral-400 space-y-2">
                    {auditLogs.map((log, index) => (
                      <div key={log.id || index} className="p-2 bg-neutral-950/40 rounded border border-neutral-900 flex justify-between items-start gap-4">
                        <div>
                          <span className="text-violet-400 font-semibold">[{log.action}]</span>
                          <span className="text-neutral-500 ml-2">{log.details}</span>
                        </div>
                        <span className="text-neutral-600 text-[10px] whitespace-nowrap">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: AI Knowledge Base */}
          {activeTab === 'knowledge-base' && user && (
            <motion.div key="knowledge-base" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden h-full">
              <KnowledgeBase apiBase={API_BASE} secureFetch={secureFetch} role={user.role} />
            </motion.div>
          )}

          {/* TAB: Order History */}
          {activeTab === 'order-history' && (
            <motion.div
              key="order-history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-5"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Order History</h2>
                  <p className="text-xs text-neutral-400 mt-1">Every bill and quote, with payment, tax and return details.</p>
                </div>
                <button
                  onClick={fetchOrders}
                  className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search bill number, customer name or phone"
                    value={orderFilters.search}
                    onChange={e => updateOrderFilters({ search: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-1">
                  {([['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All time']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => updateOrderFilters({ period: value })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        orderFilters.period === value ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  value={orderFilters.status}
                  onChange={e => updateOrderFilters({ status: e.target.value })}
                  className="bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none"
                >
                  <option value="">All bills</option>
                  <option value="FINALIZED">Finalized</option>
                  <option value="PENDING_APPROVAL">Pending approval</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="QUOTE">Quotes</option>
                </select>
                <select
                  value={orderFilters.paymentMethod}
                  onChange={e => updateOrderFilters({ paymentMethod: e.target.value })}
                  className="bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none"
                >
                  <option value="">All payments</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: orderFilters.status === 'QUOTE' ? 'Quotes' : 'Finalized orders', value: String(ordersSummary?.count ?? 0) },
                  { label: 'Sales value', value: `₹${(ordersSummary?.netTotal ?? 0).toFixed(2)}` },
                  { label: 'Collected', value: `₹${(ordersSummary?.paidTotal ?? 0).toFixed(2)}` },
                  { label: 'On credit', value: `₹${(ordersSummary?.balanceTotal ?? 0).toFixed(2)}` },
                ].map(card => (
                  <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{card.label}</span>
                    <p className="text-lg font-bold text-white font-mono mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Orders table */}
              <div className="flex-1 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl">
                {!ordersLoading && orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm text-neutral-500">
                      {isSandboxMode ? 'Order history needs the backend; it is not available in sandbox mode.' : 'No orders match these filters.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-neutral-900 z-10">
                      <tr className="border-b border-neutral-800 text-neutral-500">
                        <th className="p-3 font-semibold">Bill</th>
                        <th className="p-3 font-semibold">Date</th>
                        <th className="p-3 font-semibold">Customer</th>
                        <th className="p-3 font-semibold text-center">Items</th>
                        <th className="p-3 font-semibold">Payment</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-neutral-300">
                      {orders.map((o: any) => {
                        const statusLabel = o.isQuote ? 'QUOTE' : o.status;
                        const statusClass = o.isQuote
                          ? 'bg-blue-950 text-blue-400 border-blue-900/40'
                          : o.status === 'FINALIZED'
                            ? 'bg-green-950 text-green-400 border-green-900/40'
                            : o.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-950 text-amber-400 border-amber-900/40'
                              : 'bg-red-950 text-red-400 border-red-900/40';
                        return (
                          <tr
                            key={o.id}
                            onClick={() => openOrderDetail(o.id)}
                            className="hover:bg-neutral-850/30 transition-colors cursor-pointer"
                          >
                            <td className="p-3 font-mono font-medium text-white">
                              {o.billNumber}
                              {o._count?.salesReturns > 0 && (
                                <span className="ml-2 text-[9px] font-sans font-bold uppercase text-amber-400">Returned</span>
                              )}
                            </td>
                            <td className="p-3 text-neutral-400 whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</td>
                            <td className="p-3">
                              <div className="text-white">{o.customer?.name || 'Walk-in'}</div>
                              {o.customer?.phone && o.customer.phone !== '0000000000' && (
                                <div className="text-[10px] text-neutral-500 font-mono">{o.customer.phone}</div>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono">{o._count?.items ?? 0}</td>
                            <td className="p-3">{o.paymentMethod}</td>
                            <td className="p-3">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusClass}`}>
                                {statusLabel.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono">
                              <div className="font-bold text-white">₹{o.netAmount.toFixed(2)}</div>
                              {o.balanceAmount > 0 && !o.isQuote && (
                                <div className="text-[10px] text-amber-400">Due ₹{o.balanceAmount.toFixed(2)}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination (right padding keeps it clear of the floating copilot button) */}
              <div className="flex justify-between items-center text-xs text-neutral-500 pr-16">
                <span>
                  {ordersTotal === 0
                    ? 'No orders'
                    : `Showing ${(ordersPage - 1) * ORDERS_PAGE_SIZE + 1}–${Math.min(ordersPage * ORDERS_PAGE_SIZE, ordersTotal)} of ${ordersTotal}`}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={ordersPage === 1}
                    onClick={() => setOrdersPage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    disabled={ordersPage * ORDERS_PAGE_SIZE >= ordersTotal}
                    onClick={() => setOrdersPage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Order detail drawer */}
              <AnimatePresence>
                {(selectedOrder || orderDetailLoading) && (
                  <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
                    onClick={() => { setSelectedOrder(null); setOrderDetailLoading(false); }}
                  >
                    <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      onClick={e => e.stopPropagation()}
                      className="bg-neutral-900 border-l border-neutral-800 w-full max-w-lg h-full flex flex-col shadow-2xl"
                    >
                      {orderDetailLoading || !selectedOrder ? (
                        <div className="p-6 space-y-3 animate-pulse">
                          <div className="h-5 bg-neutral-800 rounded w-1/2" />
                          <div className="h-3 bg-neutral-800 rounded w-3/4" />
                          <div className="h-3 bg-neutral-800 rounded w-2/3" />
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start p-6 border-b border-neutral-800">
                            <div>
                              <h3 className="text-base font-bold text-white font-mono">{selectedOrder.billNumber}</h3>
                              <p className="text-xs text-neutral-500 mt-1">
                                {new Date(selectedOrder.createdAt).toLocaleString()} · Billed by {selectedOrder.userName}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-wider mt-2 text-neutral-400">
                                {selectedOrder.isQuote ? 'Quote' : selectedOrder.status.replace('_', ' ')} · {selectedOrder.paymentMethod}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedOrder(null)}
                              className="text-neutral-400 hover:text-white text-xl cursor-pointer"
                            >
                              ×
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                            {/* Customer */}
                            <div className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3">
                              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Customer</span>
                              <p className="text-white font-semibold mt-1">{selectedOrder.customer?.name || 'Walk-in customer'}</p>
                              {selectedOrder.customer && selectedOrder.customer.phone !== '0000000000' && (
                                <p className="text-neutral-500 font-mono">
                                  {selectedOrder.customer.phone}
                                  {selectedOrder.customer.gstin && ` · GSTIN ${selectedOrder.customer.gstin}`}
                                </p>
                              )}
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Items</h4>
                              {selectedOrder.items.map((item: any) => {
                                const returned = selectedOrder.returnedQty?.[item.productId] || 0;
                                return (
                                  <div key={item.id} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-850 flex justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-white">{item.product?.name || 'Product'}</p>
                                      <p className="text-[10px] text-neutral-500 font-mono">
                                        {item.quantity} {item.product?.baseUnit?.abbreviation || ''} × ₹{item.unitPrice.toFixed(2)}
                                        {item.discount > 0 && ` − ₹${item.discount.toFixed(2)} disc`}
                                        {` · GST ${item.cgstRate + item.sgstRate}%`}
                                      </p>
                                      {returned > 0 && (
                                        <p className="text-[10px] text-amber-400 font-semibold mt-1">{returned} returned</p>
                                      )}
                                    </div>
                                    <div className="text-right font-mono font-semibold text-white whitespace-nowrap">₹{item.totalPrice.toFixed(2)}</div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-neutral-800 pt-4 space-y-1.5">
                              {[
                                ['Taxable value', selectedOrder.totalAmount],
                                ['CGST', selectedOrder.cgstAmount],
                                ['SGST', selectedOrder.sgstAmount],
                                ...(selectedOrder.discountAmount > 0 ? [['Bill discount', -selectedOrder.discountAmount]] : []),
                              ].map(([label, value]: any) => (
                                <div key={label} className="flex justify-between text-neutral-400">
                                  <span>{label}</span>
                                  <span className="font-mono">₹{value.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-white font-bold pt-1.5 border-t border-neutral-850">
                                <span>Net total</span>
                                <span className="font-mono">₹{selectedOrder.netAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-neutral-400">
                                <span>Paid</span>
                                <span className="font-mono">₹{selectedOrder.paidAmount.toFixed(2)}</span>
                              </div>
                              {selectedOrder.balanceAmount > 0 && (
                                <div className="flex justify-between text-amber-400 font-semibold">
                                  <span>Balance due</span>
                                  <span className="font-mono">₹{selectedOrder.balanceAmount.toFixed(2)}</span>
                                </div>
                              )}
                            </div>

                            {/* Payments */}
                            {selectedOrder.payments?.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Payments</h4>
                                {selectedOrder.payments.map((pay: any) => (
                                  <div key={pay.id} className="flex justify-between text-neutral-300">
                                    <span>{pay.paymentMethod}{pay.transactionRef && <span className="text-neutral-500 font-mono"> · {pay.transactionRef}</span>}</span>
                                    <span className="font-mono">₹{pay.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Returns */}
                            {selectedOrder.salesReturns?.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Returns</h4>
                                {selectedOrder.salesReturns.map((r: any) => (
                                  <div key={r.id} className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
                                    <div className="flex justify-between">
                                      <span className="font-mono text-white">{r.returnNumber}</span>
                                      <span className="font-mono text-amber-400">−₹{r.netAmount.toFixed(2)}</span>
                                    </div>
                                    <p className="text-neutral-500 mt-1">{new Date(r.createdAt).toLocaleString()}{r.reason && ` · ${r.reason}`}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Approvals */}
                            {selectedOrder.approvals?.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Approval</h4>
                                {selectedOrder.approvals.map((a: any) => (
                                  <div key={a.id} className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3 space-y-1">
                                    <p className="text-neutral-300">{a.description}</p>
                                    <p className="text-neutral-500">
                                      {a.status} · requested by {a.requester?.fullName}
                                      {a.approver && ` · decided by ${a.approver.fullName}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {!selectedOrder.isQuote && selectedOrder.status === 'FINALIZED' && (
                            <div className="p-6 border-t border-neutral-800">
                              <button
                                onClick={() => startReturnFromOrder(selectedOrder.billNumber)}
                                className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Return items from this bill
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB 4: Approval Center */}
          {activeTab === 'approvals' && (
            <motion.div 
              key="approvals"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Approval Center</h2>
                  <p className="text-xs text-neutral-400 mt-1">Review, approve, or reject pricing overrides and credit limit breaches.</p>
                </div>
                <div className="flex gap-2">
                  {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setApprovalFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        approvalFilter === f ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Approval List */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {approvals.filter(a => a.status === approvalFilter).length === 0 ? (
                  <div className="bg-neutral-900/20 border border-neutral-800/60 p-12 rounded-xl text-center">
                    <p className="text-sm text-neutral-500">No {approvalFilter.toLowerCase()} requests found.</p>
                  </div>
                ) : (
                  approvals
                    .filter(a => a.status === approvalFilter)
                    .map(a => {
                      const details = a.actionDetails ? JSON.parse(a.actionDetails) : {};
                      const isOwnerReq = details.requiredRole === 'OWNER';
                      return (
                        <div key={a.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex justify-between items-start gap-6 hover:border-neutral-700 transition-colors">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                isOwnerReq ? 'bg-red-950 text-red-400 border border-red-900/40' : 'bg-amber-950 text-amber-400 border border-amber-900/40'
                              }`}>
                                {isOwnerReq ? 'Owner Level' : 'Manager Level'}
                              </span>
                              <span className="text-xs text-neutral-500 font-mono">
                                Request ID: {a.id.slice(0, 8)}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-white">
                                Bill #{a.bill?.billNumber || 'Draft Bill'}
                              </h4>
                              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {a.description}
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 bg-neutral-950/40 border border-neutral-850 p-3 rounded-lg text-xs">
                              <div>
                                <span className="text-neutral-500 block">Requested By</span>
                                <span className="text-white font-medium">{a.requester?.fullName || 'Cashier'}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Requester Role</span>
                                <span className="text-white font-medium uppercase tracking-wider">{a.requester?.role}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Timestamp</span>
                                <span className="text-white font-medium">{new Date(a.createdAt).toLocaleString()}</span>
                              </div>
                            </div>

                            {a.status === 'PENDING' && (
                              <div className="flex items-center gap-2 pt-2">
                                <input
                                  type="text"
                                  placeholder="Provide reason for approval or rejection"
                                  value={rejectionReasonInput[a.id] || ''}
                                  onChange={e => setRejectionReasonInput({ ...rejectionReasonInput, [a.id]: e.target.value })}
                                  className="bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none flex-1"
                                />
                                <button
                                  onClick={() => handleActionApproval(a.id, 'APPROVE')}
                                  className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleActionApproval(a.id, 'REJECT')}
                                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => setSelectedApprovalBill(a.bill)}
                                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                                >
                                  View Bill
                                </button>
                              </div>
                            )}

                            {a.status !== 'PENDING' && (
                              <div className="pt-2 text-xs text-neutral-400">
                                <span className="text-neutral-500 font-medium">Processed By:</span> {a.approver?.fullName || 'System'} | <span className="text-neutral-500 font-medium">Reason/Note:</span> {details.reason || 'N/A'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 5: Customer Ledgers */}
          {activeTab === 'customer-ledgers' && (
            <motion.div 
              key="customer-ledgers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 overflow-hidden h-full"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Customer Credit Ledgers</h2>
                  <p className="text-xs text-neutral-400 mt-1">FIFO payments, credit limits, and running balance timelines.</p>
                </div>
              </div>

              <div className="flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold">
                        <th className="p-4">Customer Name</th>
                        <th className="p-4">Phone</th>
                        <th className="p-4">Price Level</th>
                        <th className="p-4">Credit Limit</th>
                        <th className="p-4 text-right">Ledger Balance</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-neutral-300">
                      {customerLedgers.map((c: any) => {
                        const creditLimitVal = c.creditLimit || 0.0;
                        return (
                          <tr key={c.id} className="hover:bg-neutral-850/30 transition-colors">
                            <td className="p-4 font-medium text-white">{c.name}</td>
                            <td className="p-4 font-mono text-neutral-400">{c.phone}</td>
                            <td className="p-4">
                              <span className="bg-violet-950/30 text-violet-400 border border-violet-900/40 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                {c.priceLevel || 'RETAIL'}
                              </span>
                            </td>
                            <td className="p-4 font-mono">₹{creditLimitVal.toFixed(2)}</td>
                            <td className="p-4 text-right font-mono font-bold text-red-400">
                              ₹{(c.customerLedger?.[0]?.runningBalance || 0.0).toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleOpenLedgerDrawer(c.id, 'CUSTOMER')}
                                className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                              >
                                View Ledger Statement
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 6: Supplier Ledgers */}
          {activeTab === 'supplier-ledgers' && (
            <motion.div 
              key="supplier-ledgers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 overflow-hidden h-full"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Supplier Liabilities</h2>
                  <p className="text-xs text-neutral-400 mt-1">Purchase timelines, credit histories, and manual payments.</p>
                </div>
              </div>

              <div className="flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold">
                        <th className="p-4">Supplier Name</th>
                        <th className="p-4">Contact Person</th>
                        <th className="p-4">Phone</th>
                        <th className="p-4 text-right">Outstanding Bal</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-neutral-300">
                      {supplierLedgers.map((s: any) => {
                        return (
                          <tr key={s.id} className="hover:bg-neutral-850/30 transition-colors">
                            <td className="p-4 font-medium text-white">{s.name}</td>
                            <td className="p-4 text-neutral-400">{s.contactPerson || 'N/A'}</td>
                            <td className="p-4 font-mono text-neutral-400">{s.phone}</td>
                            <td className="p-4 text-right font-mono font-bold text-amber-500">
                              ₹{(s.supplierLedger?.[0]?.runningBalance || 0.0).toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleOpenLedgerDrawer(s.id, 'SUPPLIER')}
                                className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                              >
                                View Statement
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 7: Return Center */}
          {activeTab === 'returns' && (
            <motion.div 
              key="returns"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex p-6 gap-6 overflow-hidden h-full"
            >
              {/* Return Wizard (Left) */}
              <div className="w-[450px] bg-neutral-900/60 border border-neutral-850 rounded-2xl p-6 flex flex-col overflow-hidden shrink-0">
                <h3 className="text-sm font-bold text-white mb-4">Process New Return</h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Enter Invoice Bill Number..."
                    value={salesReturnSearchBill}
                    onChange={e => setSalesReturnSearchBill(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={handleFetchBillForReturn}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Lookup
                  </button>
                </div>

                {salesReturnBillDetails ? (
                  <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 text-xs font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Bill Date:</span>
                        <span className="text-white">{new Date(salesReturnBillDetails.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Net Total:</span>
                        <span className="text-white">₹{salesReturnBillDetails.netAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {salesReturnBillDetails.items.map((item: any) => (
                        <div key={item.productId} className="bg-neutral-950/30 border border-neutral-850 p-3 rounded-xl space-y-2">
                          <div className="text-xs font-semibold text-white">{item.product?.name}</div>
                          <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                            <span>Sold Qty: {item.quantity}</span>
                            <span>Rate: ₹{item.unitPrice.toFixed(2)}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 pt-1.5">
                            <div>
                              <label className="text-[9px] text-neutral-500 block mb-1">Return Qty</label>
                              <input
                                type="number"
                                min={0}
                                max={item.quantity}
                                value={salesReturnQty[item.productId] || 0}
                                onChange={e => {
                                  const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                                  setSalesReturnQty({ ...salesReturnQty, [item.productId]: val });
                                }}
                                className="w-full bg-neutral-950 border border-neutral-850 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-neutral-500 block mb-1">Disposition</label>
                              <select
                                value={salesReturnDisp[item.productId] || 'RETURN_TO_STOCK'}
                                onChange={e => setSalesReturnDisp({ ...salesReturnDisp, [item.productId]: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-850 rounded px-1.5 py-1 text-xs text-neutral-300 focus:outline-none"
                              >
                                <option value="RETURN_TO_STOCK">Restock Item</option>
                                <option value="DAMAGED">Damaged / Scrap</option>
                                <option value="WARRANTY">Warranty Claim</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-neutral-850">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-1">Return Reason / Notes</label>
                        <input
                          type="text"
                          placeholder="Reason for return..."
                          value={salesReturnReason}
                          onChange={e => setSalesReturnReason(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleSubmitSalesReturn}
                        disabled={isSubmittingReturn}
                        className="w-full bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-2.5 rounded-xl cursor-pointer transition-colors text-xs flex items-center justify-center gap-2"
                      >
                        {isSubmittingReturn ? 'Processing...' : 'Authorize Return'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-850 rounded-xl p-4 text-center text-xs text-neutral-500">
                    <Undo className="w-8 h-8 mb-2 text-neutral-600" />
                    Look up a finalized bill invoice number to initiate customer return itemizations.
                  </div>
                )}
              </div>

              {/* Returns History Logs (Right) */}
              <div className="flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-neutral-850">
                  <h3 className="text-sm font-bold text-white">Return Ledger Logs</h3>
                </div>

                <div className="overflow-y-auto flex-1">
                  {returnsLoading ? (
                    <div className="p-8 text-center text-xs text-neutral-500 animate-pulse">Loading return timelines...</div>
                  ) : returnsList.salesReturns.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-500">No returns history found.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold">
                          <th className="p-4">Return ID</th>
                          <th className="p-4">Bill Ref</th>
                          <th className="p-4">Reason</th>
                          <th className="p-4 text-right">Refund Total</th>
                          <th className="p-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-850 text-neutral-300">
                        {returnsList.salesReturns.map((r: any) => (
                          <tr key={r.id} className="hover:bg-neutral-850/30 transition-colors">
                            <td className="p-4 font-mono font-medium text-white">{r.returnNumber}</td>
                            <td className="p-4 font-mono text-neutral-400">{r.bill?.billNumber}</td>
                            <td className="p-4 text-neutral-400 max-w-[150px] truncate">{r.reason || 'N/A'}</td>
                            <td className="p-4 text-right font-mono font-bold text-green-400">₹{r.netAmount.toFixed(2)}</td>
                            <td className="p-4 text-neutral-400">{new Date(r.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Side drawer to view bill details inside Approval Center */}
          <AnimatePresence>
            {selectedApprovalBill && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="bg-neutral-900 border-l border-neutral-800 w-full max-w-md h-full flex flex-col p-6 shadow-2xl relative"
                >
                  <div className="flex justify-between items-center pb-4 border-b border-neutral-850">
                    <div>
                      <h3 className="text-base font-bold text-white">Bill Summary Details</h3>
                      <p className="text-xs text-neutral-500">Bill Number: {selectedApprovalBill.billNumber}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedApprovalBill(null)}
                      className="text-neutral-400 hover:text-white text-xl cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  {/* Items list */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-3">
                    <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Cart Items</h4>
                    <div className="space-y-2">
                      {selectedApprovalBill.items?.map((item: any, idx: number) => {
                        return (
                          <div key={idx} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-850 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-semibold text-white">{item.product?.name || 'Product'}</p>
                              <p className="text-[10px] text-neutral-500 font-mono">Qty: {item.quantity} x ₹{item.unitPrice} (Disc: ₹{item.discount})</p>
                            </div>
                            <div className="text-right font-mono font-semibold text-white">
                              ₹{item.totalPrice.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-neutral-850 pt-4 space-y-2 text-xs">
                      <div className="flex justify-between text-neutral-400">
                        <span>Subtotal:</span>
                        <span>₹{selectedApprovalBill.totalAmount?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Tax (GST):</span>
                        <span>₹{(selectedApprovalBill.cgstAmount + selectedApprovalBill.sgstAmount)?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-white font-bold pt-1 border-t border-neutral-850/50">
                        <span>Net Total:</span>
                        <span>₹{selectedApprovalBill.netAmount?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-850 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-500 block">Payment Method</span>
                      <span className="font-semibold text-white">{selectedApprovalBill.paymentMethod}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Paid Amount</span>
                      <span className="font-semibold text-white">₹{selectedApprovalBill.paidAmount?.toFixed(2)}</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </AnimatePresence>
      </main>

      {/* ==========================================
          MODALS & FLOATING OVERLAYS
          ========================================== */}

      {/* OVERLAY A: Floating Asynchronous Approval Wait Overlay */}
      <AnimatePresence>
        {pendingBillId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl w-full max-w-[420px] shadow-2xl relative text-center space-y-6"
            >
              {pendingBillStatus === 'APPROVED_NOTIFY' ? (
                // APPROVED VIEW
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 border border-green-550/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-400 tracking-tight">Approved by Manager</h3>
                    <p className="text-xs text-neutral-400 mt-2">
                      Request was approved by <span className="text-white font-semibold">{pendingBillApprover}</span>. Finalizing checkout receipt...
                    </p>
                  </div>
                </div>
              ) : pendingBillStatus === 'REJECTED' ? (
                // REJECTED VIEW
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-550/20 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-400 tracking-tight">Request Rejected</h3>
                    <p className="text-xs text-neutral-400 mt-2">
                      Pricing override request was rejected.
                    </p>
                    <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 mt-4 text-xs font-mono text-left space-y-1">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Rejection Reason:</span>
                        <span className="text-red-400 font-semibold">{pendingBillRejectReason}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleCancelPendingRequest}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold py-2.5 rounded-lg w-full cursor-pointer transition-colors"
                    >
                      Return to Cart (Edit Bill)
                    </button>
                  </div>
                </div>
              ) : (
                // PENDING VIEW
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 border border-amber-550/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Approval Pending</h3>
                    <p className="text-xs text-neutral-400 mt-2">
                      A pricing override request has been queued. Please wait for a manager or owner to authorize this from their dashboard.
                    </p>
                    <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 mt-4 text-xs font-mono text-left space-y-1">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Bill Ref:</span>
                        <span className="text-white">{pendingBillNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Reason:</span>
                        <span className="text-amber-400">{pendingBillReason}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleCancelPendingRequest}
                      className="bg-neutral-850 hover:bg-neutral-850/80 text-neutral-300 text-xs font-semibold py-2.5 rounded-lg w-full cursor-pointer transition-colors"
                    >
                      Cancel & Edit Bill
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY A2: Highly Visible Loss Sale Warning Modal for Owners */}
      <AnimatePresence>
        {lossWarningModal?.show && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-red-500/30 p-6 rounded-2xl w-full max-w-[400px] shadow-2xl relative space-y-4"
            >
              <div className="flex items-center gap-3 text-red-500 pb-2 border-b border-neutral-800">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <h3 className="text-base font-bold tracking-tight">Loss Sale Warning</h3>
              </div>

              <p className="text-xs text-neutral-400">
                You are about to sell items below cost price. Please verify the loss details below:
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {lossWarningModal.breaches.map((b, idx) => (
                  <div key={idx} className="bg-red-950/20 border border-red-900/40 p-3 rounded-lg text-xs space-y-1 font-mono">
                    <div className="font-bold text-white">{b.productName}</div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Cost Price:</span>
                      <span className="text-white">₹{b.costPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Selling Price:</span>
                      <span className="text-red-400 font-semibold">₹{b.sellingPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-red-950/40 pt-1 mt-1 text-[10px]">
                      <span className="text-red-400">Loss Amount:</span>
                      <span className="text-red-400 font-bold">₹{b.loss.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-red-400">Profit Margin:</span>
                      <span className="text-red-400 font-bold">{b.margin}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={() => setLossWarningModal(null)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={lossWarningModal.bypassAction}
                  className="bg-red-600 hover:bg-red-555 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Proceed Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY B: Checkout Success Modal */}
      <AnimatePresence>
        {checkoutResult && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[380px] shadow-2xl relative"
            >
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {checkoutResult.isQuote ? 'Quotation Saved' : 'Transaction Success'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono mt-1">{checkoutResult.billNumber}</p>
                </div>

                <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-2 text-sm text-left">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 text-xs">Total Amount:</span>
                    <strong className="text-white font-mono">₹{checkoutResult.netAmount.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 text-xs">Tendered Amount:</span>
                    <span className="text-neutral-300 font-mono">₹{checkoutResult.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-800 pt-2 font-semibold">
                    <span className="text-neutral-400 text-xs">Change to Return:</span>
                    <strong className="text-green-400 font-mono text-base">₹{checkoutResult.changeAmount.toFixed(2)}</strong>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setCheckoutResult(null);
                    clearCart();
                  }}
                  className="w-full bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2.5 rounded-xl transition-colors cursor-pointer text-xs"
                >
                  Start New Bill
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY C: Stock Adjustments Popup */}
      <AnimatePresence>
        {stockAdjustment.show && stockAdjustment.product && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[360px] shadow-2xl relative"
            >
              <h3 className="text-base font-bold text-white mb-1">Adjust Inventory Level</h3>
              <p className="text-xs text-neutral-400 font-mono mb-4">{stockAdjustment.product.name} ({stockAdjustment.product.sku})</p>

              <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Adjustment Type</label>
                  <select 
                    value={stockAdjustment.type}
                    onChange={e => setStockAdjustment({ ...stockAdjustment, type: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="ADJUSTMENT">Quantity Correction (Add/Remove)</option>
                    <option value="RECONCILIATION">Reconciliation / Audited quantity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Quantity Difference (e.g. +10 or -5)
                  </label>
                  <input 
                    type="number"
                    value={stockAdjustment.quantityChanged}
                    placeholder="Enter change value"
                    onChange={e => setStockAdjustment({ ...stockAdjustment, quantityChanged: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Reason / Notes</label>
                  <input 
                    type="text"
                    value={stockAdjustment.reason}
                    placeholder="E.g., Damaged item / Physical count variance"
                    onChange={e => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setStockAdjustment({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' })}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY D: Add Customer Dialog */}
      <AnimatePresence>
        {addCustomer.show && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[360px] shadow-2xl relative"
            >
              <h3 className="text-base font-bold text-white mb-1">Register New Customer</h3>
              <p className="text-xs text-neutral-400 mb-4">Set pricing level tier and credit limit limits immediately.</p>

              <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Customer Name</label>
                  <input 
                    type="text"
                    value={addCustomer.name}
                    placeholder="Enter full name"
                    onChange={e => setAddCustomer({ ...addCustomer, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Mobile Number</label>
                  <input 
                    type="text"
                    value={addCustomer.phone}
                    placeholder="10-digit mobile"
                    onChange={e => setAddCustomer({ ...addCustomer, phone: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Pricing Level</label>
                  <select 
                    value={addCustomer.priceLevel}
                    onChange={e => setAddCustomer({ ...addCustomer, priceLevel: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="RETAIL">Retail Pricing (Standard)</option>
                    <option value="WHOLESALE">Wholesale Pricing (Tier 1)</option>
                    <option value="CONTRACTOR">Contractor Pricing (Tier 2)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    Credit Limit {user?.role !== 'OWNER' && '(Owner-only field)'}
                  </label>
                  <input 
                    type="number"
                    disabled={user?.role !== 'OWNER'}
                    value={addCustomer.creditLimit}
                    onChange={e => setAddCustomer({ ...addCustomer, creditLimit: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono disabled:opacity-55"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setAddCustomer({ show: false, name: '', phone: '', priceLevel: 'RETAIL', creditLimit: '10000' })}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Create Customer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY E: Edit Product details dialog */}
      <AnimatePresence>
        {editProduct.show && editProduct.product && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative my-8"
            >
              <h3 className="text-base font-bold text-white mb-1">Edit Product Specifications</h3>
              <p className="text-xs text-neutral-400 mb-4">Owner panel: Configure margins, prices, and settings.</p>

              <form onSubmit={handleEditProductSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product SKU</label>
                    <input 
                      type="text"
                      value={editProduct.sku}
                      onChange={e => setEditProduct({ ...editProduct, sku: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Barcode</label>
                    <input 
                      type="text"
                      value={editProduct.barcode}
                      onChange={e => setEditProduct({ ...editProduct, barcode: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product Name</label>
                  <input 
                    type="text"
                    value={editProduct.name}
                    onChange={e => setEditProduct({ ...editProduct, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">HSN Code</label>
                    <input 
                      type="text"
                      value={editProduct.hsnCode}
                      onChange={e => setEditProduct({ ...editProduct, hsnCode: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">CGST Rate (%)</label>
                    <input 
                      type="number"
                      value={editProduct.cgstRate}
                      onChange={e => setEditProduct({ ...editProduct, cgstRate: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">SGST Rate (%)</label>
                    <input 
                      type="number"
                      value={editProduct.sgstRate}
                      onChange={e => setEditProduct({ ...editProduct, sgstRate: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Rack Location</label>
                    <input 
                      type="text"
                      value={editProduct.rackLocation}
                      onChange={e => setEditProduct({ ...editProduct, rackLocation: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Min Profit Margin (%)</label>
                    <input 
                      type="number"
                      value={editProduct.minimumProfitPct}
                      onChange={e => setEditProduct({ ...editProduct, minimumProfitPct: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-neutral-800 pt-3">
                  <div>
                    <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                    <input 
                      type="number"
                      value={editProduct.costPrice}
                      onChange={e => setEditProduct({ ...editProduct, costPrice: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">MRP (Optional) (₹)</label>
                    <input 
                      type="number"
                      value={editProduct.mrp}
                      onChange={e => setEditProduct({ ...editProduct, mrp: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1">Level 1 (Ideal) (₹)</label>
                    <input 
                      type="number"
                      value={editProduct.level1Price}
                      onChange={e => setEditProduct({ ...editProduct, level1Price: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1">Level 2 (Default) (₹)</label>
                    <input 
                      type="number"
                      value={editProduct.level2Price}
                      onChange={e => setEditProduct({ ...editProduct, level2Price: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-violet-400 uppercase tracking-wider mb-1">Level 3 (Min) (₹)</label>
                    <input 
                      type="number"
                      value={editProduct.level3Price}
                      onChange={e => setEditProduct({ ...editProduct, level3Price: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1">Emergency Limit Price (₹)</label>
                  <input 
                    type="number"
                    value={editProduct.emergencyPrice}
                    onChange={e => setEditProduct({ ...editProduct, emergencyPrice: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setEditProduct({ ...editProduct, show: false })}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Save Specifications
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAWER: Advanced Customer/Supplier Ledger Timeline Statements */}
      <AnimatePresence>
        {ledgerDrawerOpen && selectedLedgerDetails && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLedgerDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            {/* Slide-over */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[480px] h-full bg-neutral-900 border-l border-neutral-850 flex flex-col shadow-2xl z-10"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-neutral-850 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedLedgerType === 'CUSTOMER' ? 'Customer Account Statement' : 'Supplier Credit Timeline'}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {selectedLedgerType === 'CUSTOMER' 
                      ? selectedLedgerDetails.customer.name 
                      : selectedLedgerDetails.supplier.name
                    }
                  </p>
                </div>
                <button 
                  onClick={() => setLedgerDrawerOpen(false)}
                  className="text-neutral-400 hover:text-white text-xs cursor-pointer bg-neutral-850 hover:bg-neutral-800 p-2 rounded-lg"
                >
                  Close
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Total Balance Card */}
                <div className="bg-neutral-950/60 border border-neutral-850 rounded-2xl p-5 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Outstanding balance</span>
                    <span className={`text-2xl font-mono font-bold mt-1 block ${
                      (selectedLedgerDetails.ledger?.[0]?.runningBalance || 0) > 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      ₹{(selectedLedgerDetails.ledger?.[0]?.runningBalance || 0.0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-neutral-900 border border-neutral-850 p-2.5 rounded-xl text-neutral-400">
                    <Coins className="w-5 h-5" />
                  </div>
                </div>

                {/* Record Payment Form */}
                <div className="bg-neutral-950/30 border border-neutral-850 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Record Cash/UPI Payment</h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-neutral-500 block mb-1">Payment Amount (₹)</label>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                    {selectedLedgerType === 'CUSTOMER' && (
                      <div>
                        <label className="text-[9px] text-neutral-500 block mb-1">Payment Mode</label>
                        <select 
                          value={paymentMethodSelect}
                          onChange={e => setPaymentMethodSelect(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none"
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">Debit/Credit Card</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] text-neutral-500 block mb-1">Notes / References</label>
                    <input 
                      type="text"
                      placeholder="Receipt info, check details..."
                      value={paymentNotes}
                      onChange={e => setPaymentNotes(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <button 
                    onClick={handleRecordLedgerPayment}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
                  >
                    Post Transaction Ledger
                  </button>
                </div>

                {/* Timeline Stream */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Transaction Timeline Stream</h4>
                  
                  <div className="space-y-3 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-850">
                    {selectedLedgerDetails.ledger.map((item: any) => {
                      const isInvoice = item.transactionType === 'SALE' || item.transactionType === 'PURCHASE';
                      const isReturn = item.transactionType === 'RETURN';
                      
                      return (
                        <div key={item.id} className="flex gap-4 relative">
                          <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                            isInvoice 
                              ? 'bg-neutral-900 border-neutral-800 text-neutral-400' 
                              : isReturn 
                                ? 'bg-green-950/20 border-green-900/40 text-green-400' 
                                : 'bg-violet-950/20 border-violet-900/40 text-violet-400'
                          }`}>
                            {isInvoice ? (
                              <BookOpen className="w-3.5 h-3.5" />
                            ) : isReturn ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Coins className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="bg-neutral-950/30 border border-neutral-850 p-4 rounded-xl flex-1 space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-white">
                                {item.transactionType} 
                                {item.bill?.billNumber ? ` (${item.bill.billNumber})` : ''}
                                {item.salesReturn?.returnNumber ? ` (${item.salesReturn.returnNumber})` : ''}
                                {item.purchaseOrder?.poNumber ? ` (${item.purchaseOrder.poNumber})` : ''}
                                {item.purchaseReturn?.returnNumber ? ` (${item.purchaseReturn.returnNumber})` : ''}
                              </span>
                              <span className="font-mono text-neutral-500 text-[10px]">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-neutral-400">
                              <div>
                                <span className="text-neutral-600 block">Debit (+)</span>
                                <span className="text-red-400 font-semibold">₹{item.debit.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-neutral-600 block">Credit (-)</span>
                                <span className="text-green-400 font-semibold">₹{item.credit.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-neutral-600 block">Balance</span>
                                <span className="text-white font-semibold">₹{item.runningBalance.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Global Command Palette Modal (Ctrl + K) */}
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]">
          <div className="w-full max-w-[550px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[450px]">
            {/* Palette Search Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-800">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input 
                type="text"
                placeholder="Type a command or shortcut... (e.g. POS, inventory)"
                value={commandPaletteSearch}
                onChange={e => {
                  setCommandPaletteSearch(e.target.value);
                  setCommandPaletteIndex(0);
                }}
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-neutral-500 font-mono"
                autoFocus
              />
              <span className="text-[10px] text-neutral-500 font-bold bg-neutral-950 px-2 py-1 border border-neutral-850 rounded-md uppercase shrink-0">ESC</span>
            </div>

            {/* Commands List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {getCommands().length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No matching commands found.
                </div>
              ) : (
                getCommands().map((cmd, idx) => (
                  <div 
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      setIsCommandPaletteOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                      idx === commandPaletteIndex 
                        ? 'bg-violet-600 text-white font-medium shadow-md shadow-violet-600/10' 
                        : 'text-neutral-300 hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                        idx === commandPaletteIndex ? 'bg-violet-500 text-white' : 'bg-neutral-950 text-neutral-400 border border-neutral-850/50'
                      }`}>
                        {cmd.category}
                      </span>
                      <span className="text-xs font-semibold">{cmd.name}</span>
                    </div>
                    <kbd className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      idx === commandPaletteIndex ? 'bg-violet-500 text-white' : 'bg-neutral-950 text-neutral-500 border border-neutral-850/50'
                    }`}>
                      {cmd.shortcut}
                    </kbd>
                  </div>
                ))
              )}
            </div>
            
            {/* Palette Footer Help bar */}
            <div className="px-4 py-2.5 border-t border-neutral-800 text-[10px] text-neutral-500 flex justify-between items-center bg-neutral-950/40">
              <span>Use Up/Down arrows to navigate, Enter to select</span>
              <span>Ctrl + K to close</span>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY F: Quick Product Creation during POS checkout */}
      <AnimatePresence>
        {quickProduct.show && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
            >
              <h3 className="text-base font-bold text-white tracking-tight">Quick Create Product</h3>
              <p className="text-xs text-neutral-400">Initialize a missing product instantly to keep billing moving.</p>

              <form onSubmit={handleQuickProductSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product Name</label>
                  <input 
                    type="text"
                    value={quickProduct.name}
                    onChange={e => setQuickProduct({ ...quickProduct, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
                    <select 
                      value={quickProduct.categoryId}
                      onChange={e => setQuickProduct({ ...quickProduct, categoryId: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Base Unit</label>
                    <select 
                      value={quickProduct.baseUnitId}
                      onChange={e => setQuickProduct({ ...quickProduct, baseUnitId: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                      required
                    >
                      <option value="">Select Unit</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-neutral-800 pt-3">
                  <div>
                    <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                    <input 
                      type="number"
                      value={quickProduct.costPrice}
                      onChange={e => setQuickProduct({ ...quickProduct, costPrice: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1">Selling Price (₹)</label>
                    <input 
                      type="number"
                      value={quickProduct.sellingPrice}
                      onChange={e => setQuickProduct({ ...quickProduct, sellingPrice: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setQuickProduct({ ...quickProduct, show: false })}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-neutral-200 text-neutral-950 font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Save & Add to Cart
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY G: Shopify-Style Product Creation Wizard */}
      <AnimatePresence>
        {showCreateWizard && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-[850px] shadow-2xl flex overflow-hidden min-h-[500px]"
            >
              {/* Wizard Sidebar tabs */}
              <div className="w-48 bg-neutral-950 border-r border-neutral-850 p-4 space-y-2 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product Wizard</h4>
                  <div className="space-y-1 text-xs">
                    {['General Info', 'Pricing Engine', 'Stock & Vendor', 'Variants', 'Relationships', 'Review & Save'].map((name, idx) => (
                      <div 
                        key={idx}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          wizardStep === idx ? 'bg-violet-600 text-white font-bold' : 'text-neutral-400 hover:bg-neutral-900'
                        }`}
                        onClick={() => setWizardStep(idx)}
                      >
                        {idx + 1}. {name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80 text-[10px] text-neutral-500">
                  Shopify POS mode active
                </div>
              </div>

              {/* Wizard Main Content Panel */}
              <div className="flex-1 flex flex-col p-6 min-h-[500px]">
                <form onSubmit={handleWizardSubmit} className="flex-1 flex flex-col justify-between text-xs space-y-6">
                  
                  {/* STEP 0: General Info */}
                  {wizardStep === 0 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-850">
                        <h3 className="text-sm font-bold text-white">General Product Information</h3>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => applyTemplate('electrical')} className="px-2 py-1 rounded bg-neutral-850 text-[10px] text-neutral-300 hover:bg-neutral-700">Apply Electrical Template</button>
                          <button type="button" onClick={() => applyTemplate('automobile')} className="px-2 py-1 rounded bg-neutral-850 text-[10px] text-neutral-300 hover:bg-neutral-700">Apply Auto Template</button>
                        </div>
                      </div>

                      {/* AI Extractor */}
                      <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 space-y-2">
                        <label className="block text-[9px] font-bold text-violet-400 uppercase tracking-wider">AI product details parser assistant</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="e.g. Philips LED Bulb 12W White Piece, HSN 85395200"
                            value={aiInputQuery}
                            onChange={e => setAiInputQuery(e.target.value)}
                            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-white focus:outline-none"
                          />
                          <button 
                            type="button" 
                            onClick={handleAiExtract} 
                            disabled={isAiExtracting}
                            className="bg-violet-600 hover:bg-violet-750 text-white font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            {isAiExtracting ? 'Extracting...' : 'AI Extract'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">SKU (Auto/Manual)</label>
                          <input 
                            type="text"
                            placeholder="e.g. ELE-LED-12W"
                            value={wizardData.sku}
                            onChange={e => setWizardData({ ...wizardData, sku: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Barcode (Optional)</label>
                          <input 
                            type="text"
                            value={wizardData.barcode}
                            onChange={e => setWizardData({ ...wizardData, barcode: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product Name</label>
                        <input 
                          type="text"
                          value={wizardData.name}
                          onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                          required
                        />
                        {aiDuplicates.length > 0 && (
                          <div className="mt-2 bg-red-955/20 border border-red-900/40 p-2 rounded-lg text-[10px] text-red-400">
                            Potential Duplicate Alert: Similar products exist with name "{aiDuplicates[0].name}" (SKU: {aiDuplicates[0].sku})
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
                          <select 
                            value={wizardData.categoryId}
                            onChange={e => setWizardData({ ...wizardData, categoryId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                            required
                          >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Base Unit</label>
                          <select 
                            value={wizardData.baseUnitId}
                            onChange={e => setWizardData({ ...wizardData, baseUnitId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                            required
                          >
                            <option value="">Select Unit</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Rack Location</label>
                          <input 
                            type="text"
                            value={wizardData.rackLocation}
                            onChange={e => setWizardData({ ...wizardData, rackLocation: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">HSN Code</label>
                          <input 
                            type="text"
                            value={wizardData.hsnCode}
                            onChange={e => setWizardData({ ...wizardData, hsnCode: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">IGST Rate (%)</label>
                          <input 
                            type="number"
                            value={wizardData.igstRate}
                            onChange={e => setWizardData({ ...wizardData, igstRate: e.target.value, cgstRate: String(Number(e.target.value)/2), sgstRate: String(Number(e.target.value)/2) })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 1: Pricing Engine */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Pricing & Margins</h3>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                          <input 
                            type="number"
                            value={wizardData.costPrice}
                            onChange={e => setWizardData({ ...wizardData, costPrice: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">MRP (₹)</label>
                          <input 
                            type="number"
                            value={wizardData.mrp}
                            onChange={e => setWizardData({ ...wizardData, mrp: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 border-t border-neutral-800 pt-3">
                        <div>
                          <label className="block text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1">Level 1 Price (Ideal) (₹)</label>
                          <input 
                            type="number"
                            value={wizardData.level1Price}
                            onChange={e => setWizardData({ ...wizardData, level1Price: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1">Level 2 Price (Default) (₹)</label>
                          <input 
                            type="number"
                            value={wizardData.level2Price}
                            onChange={e => setWizardData({ ...wizardData, level2Price: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-violet-400 uppercase tracking-wider mb-1">Level 3 Price (Min Limit) (₹)</label>
                          <input 
                            type="number"
                            value={wizardData.level3Price}
                            onChange={e => setWizardData({ ...wizardData, level3Price: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1">Emergency Limit Price (₹)</label>
                          <input 
                            type="number"
                            value={wizardData.emergencyPrice}
                            onChange={e => setWizardData({ ...wizardData, emergencyPrice: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Minimum Profit Margin Target (%)</label>
                          <input 
                            type="number"
                            value={wizardData.minimumProfitPct}
                            onChange={e => setWizardData({ ...wizardData, minimumProfitPct: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* Live Margin Calculation block */}
                      <div className="bg-neutral-955 p-4 rounded-xl border border-neutral-850 font-mono text-[10px] space-y-1">
                        <p className="font-bold text-white text-xs mb-2">Live Profit Preview Calculations</p>
                        <div className="flex justify-between">
                          <span>Ideal Markup (Cost to Level 1):</span>
                          <span className="text-green-400">
                            {Number(wizardData.costPrice) > 0 
                              ? `${(((Number(wizardData.level1Price) - Number(wizardData.costPrice)) / Number(wizardData.costPrice)) * 100).toFixed(1)}%`
                              : '0%'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Default Biller Margin (Level 2):</span>
                          <span className="text-blue-400">
                            {Number(wizardData.level2Price) > 0 
                              ? `${(((Number(wizardData.level2Price) - Number(wizardData.costPrice)) / Number(wizardData.level2Price)) * 100).toFixed(1)}%`
                              : '0%'
                            }
                          </span>
                        </div>
                        {Number(wizardData.level3Price) <= Number(wizardData.costPrice) && (
                          <div className="text-red-400 mt-2 text-[9px] font-sans">
                            ⚠️ Warning: Minimum price (Level 3) is at or below cost price. Loss sale warnings will trigger at checkout!
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Stock & Suppliers */}
                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Opening Inventory & Supplier Details</h3>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Opening Stock Quantity</label>
                          <input 
                            type="number"
                            value={wizardData.openingStock}
                            onChange={e => setWizardData({ ...wizardData, openingStock: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Minimum Alert Level (Reorder Point)</label>
                          <input 
                            type="number"
                            value={wizardData.minStockLevel}
                            onChange={e => setWizardData({ ...wizardData, minStockLevel: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Primary Supplier Mapping</label>
                        <select 
                          value={wizardData.supplierId}
                          onChange={e => setWizardData({ ...wizardData, supplierId: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                        >
                          <option value="">Select Supplier Mapping</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Variants */}
                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Product Variants</h3>
                      
                      <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-850 grid grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="block text-[9px] text-neutral-400 uppercase mb-1">Variant Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Red, 12W B22"
                            value={varForm.name}
                            onChange={e => setVarForm({ ...varForm, name: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 uppercase mb-1">SKU</label>
                          <input 
                            type="text" 
                            placeholder="e.g. ELE-LED-9W-RED"
                            value={varForm.sku}
                            onChange={e => setVarForm({ ...varForm, sku: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 uppercase mb-1">Price (₹)</label>
                          <input 
                            type="number" 
                            placeholder="120"
                            value={varForm.price}
                            onChange={e => setVarForm({ ...varForm, price: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            if (!varForm.name || !varForm.sku || !varForm.price) return;
                            setWizardData(prev => ({
                              ...prev,
                              variants: [...prev.variants, { name: varForm.name, sku: varForm.sku, barcode: varForm.barcode, price: varForm.price }]
                            }));
                            setVarForm({ name: '', sku: '', barcode: '', price: '' });
                          }}
                          className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-1.5 rounded-lg text-[10px]"
                        >
                          Add Variant
                        </button>
                      </div>

                      {/* Variants list table */}
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-neutral-800 text-[10px] text-neutral-500">
                            <th className="py-2">Variant Name</th>
                            <th className="py-2">SKU</th>
                            <th className="py-2 text-right">Price</th>
                            <th className="py-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900">
                          {wizardData.variants.map((v, idx) => (
                            <tr key={idx} className="text-xs">
                              <td className="py-2 font-semibold text-white">{v.name}</td>
                              <td className="py-2 font-mono text-neutral-400">{v.sku}</td>
                              <td className="py-2 text-right font-mono text-white">₹{Number(v.price).toFixed(2)}</td>
                              <td className="py-2 text-center">
                                <button 
                                  type="button"
                                  onClick={() => setWizardData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }))}
                                  className="text-red-400 hover:underline"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* STEP 4: Relationships */}
                  {wizardStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Cross-Sell & Upsell Products Mapping</h3>
                      
                      <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-850 grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="block text-[9px] text-neutral-400 uppercase mb-1">Select Product</label>
                          <select 
                            value={relForm.relatedProductId}
                            onChange={e => setRelForm({ ...relForm, relatedProductId: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-neutral-300"
                          >
                            <option value="">Choose item...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 uppercase mb-1">Relationship Type</label>
                          <select 
                            value={relForm.type}
                            onChange={e => setRelForm({ ...relForm, type: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-neutral-300"
                          >
                            <option value="COMPATIBLE">Compatible Accessories</option>
                            <option value="ALTERNATIVE">Alternative Products</option>
                            <option value="UPSELL">Premium Upsell Pair</option>
                          </select>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            if (!relForm.relatedProductId) return;
                            setWizardData(prev => ({
                              ...prev,
                              relationships: [...prev.relationships, { relatedProductId: relForm.relatedProductId, type: relForm.type }]
                            }));
                            setRelForm({ relatedProductId: '', type: 'COMPATIBLE' });
                          }}
                          className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-1.5 rounded-lg text-[10px]"
                        >
                          Add Mapping
                        </button>
                      </div>

                      {/* Relationships list */}
                      <div className="space-y-2">
                        {wizardData.relationships.map((r, idx) => {
                          const rpName = products.find(p => p.id === r.relatedProductId)?.name || 'Unknown Product';
                          return (
                            <div key={idx} className="flex justify-between items-center bg-neutral-950/20 p-2.5 rounded-lg border border-neutral-850">
                              <div>
                                <span className="font-semibold text-white">{rpName}</span>
                                <span className="text-[10px] text-violet-400 font-mono block uppercase">{r.type}</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setWizardData(prev => ({ ...prev, relationships: prev.relationships.filter((_, i) => i !== idx) }))}
                                className="text-red-400 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 5: Review & Save */}
                  {wizardStep === 5 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Verify Specifications Summary</h3>
                      
                      <div className="bg-neutral-955 p-4 rounded-xl border border-neutral-850 grid grid-cols-2 gap-4 text-[10px] font-mono text-neutral-400">
                        <div>
                          <span className="text-neutral-500 block uppercase">Product Name:</span>
                          <span className="text-white font-bold">{wizardData.name || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block uppercase">SKU / Code:</span>
                          <span className="text-white font-mono">{wizardData.sku || 'Auto-generated on save'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block uppercase">Opening Stock:</span>
                          <span className="text-green-400 font-bold">{wizardData.openingStock} {units.find(u => u.id === wizardData.baseUnitId)?.abbreviation || 'pcs'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block uppercase">Cost Price:</span>
                          <span className="text-white">₹{Number(wizardData.costPrice).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block uppercase">Retail Price:</span>
                          <span className="text-white font-bold">₹{Number(wizardData.level1Price).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block uppercase">Supplier Mapping:</span>
                          <span className="text-white">{suppliers.find(s => s.id === wizardData.supplierId)?.name || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wizard Footer Controls */}
                  <div className="flex justify-between items-center border-t border-neutral-800 pt-4 shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setShowCreateWizard(false)}
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Cancel Wizard
                    </button>
                    <div className="flex gap-2">
                      {wizardStep > 0 && (
                        <button 
                          type="button" 
                          onClick={() => setWizardStep(prev => prev - 1)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold px-4 py-2 rounded-lg cursor-pointer"
                        >
                          Back
                        </button>
                      )}
                      {wizardStep < 5 ? (
                        <button 
                          type="button" 
                          onClick={() => setWizardStep(prev => prev + 1)}
                          className="bg-violet-600 hover:bg-violet-550 text-white font-semibold px-5 py-2 rounded-lg cursor-pointer"
                        >
                          Next Step
                        </button>
                      ) : (
                        <button 
                          type="submit" 
                          className="bg-white hover:bg-neutral-200 text-neutral-955 font-bold px-6 py-2 rounded-lg cursor-pointer"
                        >
                          Publish Product
                        </button>
                      )}
                    </div>
                  </div>

                </form>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY H: Recycle Bin view */}
      <AnimatePresence>
        {showRecycleBin && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl w-full max-w-[650px] shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                <h3 className="text-base font-bold text-white tracking-tight">Recycle Bin (Soft Deleted Products)</h3>
                <button 
                  onClick={() => setShowRecycleBin(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto pr-1">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] text-neutral-500">
                      <th className="py-2">Name</th>
                      <th className="py-2">SKU</th>
                      <th className="py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {products.filter(p => p.isDeleted).map(p => (
                      <tr key={p.id} className="text-xs">
                        <td className="py-2 text-white font-semibold">{p.name}</td>
                        <td className="py-2 font-mono text-neutral-400">{p.sku}</td>
                        <td className="py-2 text-center">
                          <button 
                            onClick={() => restoreProduct(p.id)}
                            className="bg-neutral-850 hover:bg-neutral-750 text-green-400 font-semibold px-2 py-1 rounded text-[10px]"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                    {products.filter(p => p.isDeleted).length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-neutral-500 text-xs">
                          No soft-deleted products in Recycle Bin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY I: AI Assistant (agent) side panel */}
      {user && (
        <AgentPanel
          open={showCopilot}
          onClose={() => setShowCopilot(false)}
          apiBase={API_BASE}
          secureFetch={secureFetch}
          user={user}
          currentPage={activeTab}
          onUiAction={handleAgentUiAction}
        />
      )}

      {/* OVERLAY J: Day Session Opening Checklist Modal */}
      <AnimatePresence>
        {showOpeningModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
            >
              <h3 className="text-base font-bold text-white tracking-tight">Open New Day Session</h3>
              <p className="text-xs text-neutral-400">Initialize counts to activate billing operations.</p>

              <form onSubmit={handleOpenSessionSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Opening Cash (₹)</label>
                    <input 
                      type="number" 
                      value={openingCash}
                      onChange={e => setOpeningCash(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Card Balance (₹)</label>
                    <input 
                      type="number" 
                      value={openingCard}
                      onChange={e => setOpeningCard(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">UPI Balance (₹)</label>
                    <input 
                      type="number" 
                      value={openingUpi}
                      onChange={e => setOpeningUpi(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Opening Notes</label>
                  <input 
                    type="text" 
                    placeholder="Morning shift opening checklist done..."
                    value={openingNotes}
                    onChange={e => setOpeningNotes(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 space-y-1.5 text-[10px] text-neutral-400">
                  <div className="flex items-center gap-2"><input type="checkbox" required /> <span>Verified physical cash drawer totals</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" required /> <span>POS terminal sync is online</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" required /> <span>Check counter clean and cards reader active</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowOpeningModal(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2 rounded-lg cursor-pointer"
                  >
                    Confirm Opening
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY K: Day Closing Worksheet & Differences Modal */}
      <AnimatePresence>
        {showClosingModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
            >
              <h3 className="text-base font-bold text-white tracking-tight">Close Active Day Session</h3>
              <p className="text-xs text-neutral-400">Submit counts to calculate expected-vs-actual drawer differences.</p>

              <form onSubmit={handleCloseSessionSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Physical Cash Counted (₹)</label>
                  <input 
                    type="number" 
                    value={actualCash}
                    onChange={e => setActualCash(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Closing Notes / Explanations</label>
                  <textarea 
                    rows={2}
                    placeholder="Explain any counted discrepancies..."
                    value={closingNotes}
                    onChange={e => setClosingNotes(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowClosingModal(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-600 hover:bg-red-550 text-white font-bold py-2 rounded-lg cursor-pointer animate-pulse"
                  >
                    Submit Closing count
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY L: Expense Management Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
            >
              <h3 className="text-base font-bold text-white tracking-tight">Log Expense Receipt</h3>
              <p className="text-xs text-neutral-400">Log tea, salaries, rentals, transport, or fuel expenses.</p>

              <form onSubmit={handleCreateExpenseSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
                    <select 
                      value={expenseCategory}
                      onChange={e => setExpenseCategory(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-neutral-300 focus:outline-none"
                    >
                      <option value="TEA">Tea & Snacks</option>
                      <option value="FUEL">Fuel / Conveyance</option>
                      <option value="TRANSPORT">Freight / Transport</option>
                      <option value="SALARY">Staff Salaries</option>
                      <option value="RENT">Rent & Utilities</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="CUSTOM">Custom Expense</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Amount (₹)</label>
                    <input 
                      type="number" 
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Description / Notes</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Tea for mechanic team"
                    value={expenseNotes}
                    onChange={e => setExpenseNotes(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={expenseDeductDrawer}
                    onChange={e => setExpenseDeductDrawer(e.target.checked)}
                  />
                  <span className="text-[10px] text-neutral-400">Deduct directly from cash drawer balance</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowExpenseModal(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2 rounded-lg cursor-pointer"
                  >
                    Record Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY M: AI Settings keys config screen */}
      <AnimatePresence>
        {showAiSettings && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-805 p-6 rounded-2xl w-full max-w-[550px] shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                <h3 className="text-base font-bold text-white tracking-tight">AI Settings & Provider Priority</h3>
                <button 
                  onClick={() => setShowAiSettings(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAiSettingsSubmit} className="space-y-4 text-xs">
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {aiSettingsList.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                      <span className="font-mono text-[10px] text-neutral-400">{item.key}:</span>
                      <input 
                        type="text"
                        value={item.value}
                        onChange={e => {
                          const updated = [...aiSettingsList];
                          updated[idx].value = e.target.value;
                          setAiSettingsList(updated);
                        }}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono text-[10px]"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAiSettings(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-white hover:bg-neutral-200 text-neutral-955 font-bold py-2 rounded-lg cursor-pointer"
                  >
                    Save Configuration
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating AI Assistant Trigger Button */}
      {!showCopilot && <button 
        type="button"
        onClick={() => setShowCopilot(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-blue-500 shadow-lg shadow-violet-500/20 flex items-center justify-center text-white z-40 hover:scale-105 transition-transform cursor-pointer"
        title="Open AI Copilot (Ctrl+Shift+Space)"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
      </button>}

    </div>
  );
}
