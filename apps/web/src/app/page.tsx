'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import AgentPanel, { AgentUiAction } from './components/AgentPanel';
import KnowledgeBase from './components/KnowledgeBase';
import LoginScreen, { LoginForm } from './components/LoginScreen';
import Sidebar, { NAV_ITEMS, canSeeNavItem } from './components/Sidebar';
import TabPane from './components/tabs/TabPane';
import PosTab from './components/tabs/PosTab';
import InventoryTab from './components/tabs/InventoryTab';
import DevConsoleTab from './components/tabs/DevConsoleTab';
import OrderHistoryTab from './components/tabs/OrderHistoryTab';
import ApprovalsTab from './components/tabs/ApprovalsTab';
import CustomerLedgersTab from './components/tabs/CustomerLedgersTab';
import SupplierLedgersTab from './components/tabs/SupplierLedgersTab';
import ReturnsTab from './components/tabs/ReturnsTab';
import PurchasesTab from './components/tabs/PurchasesTab';
import ReportsTab from './components/tabs/ReportsTab';
import UsersTab from './components/tabs/UsersTab';
import AiQualityTab from './components/tabs/AiQualityTab';
import { CheckoutSuccessModal, LossWarningModal, LossWarningState, PendingApprovalOverlay } from './components/modals/CheckoutModals';
import LedgerDrawer from './components/modals/LedgerDrawer';
import CommandPalette from './components/modals/CommandPalette';
import { ClosingSessionModal, ExpenseModal, OpeningSessionModal } from './components/modals/SessionModals';
import AiSettingsModal from './components/modals/AiSettingsModal';
import { API_BASE, ShopContext } from './ShopContext';
import OfflineBanner from './components/OfflineBanner';
import BarcodeScanner from './components/BarcodeScanner';
import { cacheGet, cacheSet, enqueueBill, isNetworkError, listQueuedBills, newClientRef, syncQueuedBills } from './lib/offline';
import type { ActiveUser, CartItem, Category, Customer, PaymentMethod, Product, Supplier, TabId, Unit } from './types';

// ==========================================
// App shell: session bootstrap, state shared across tabs (or driven by keyboard shortcuts and
// the AI agent), tab switching and app-wide overlays. Each screen lives in components/tabs/.
// ==========================================

export default function ShopOSApp() {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<TabId>('pos');
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
  const [isLoading, setIsLoading] = useState(false);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [isQuote, setIsQuote] = useState(false);

  // Search and selection states
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

  // Approvals & Realtime Queue Polling States
  const [pendingBillId, setPendingBillId] = useState<string | null>(null);
  const [pendingBillNumber, setPendingBillNumber] = useState<string | null>(null);
  const [pendingBillStatus, setPendingBillStatus] = useState<string | null>(null);
  const [pendingBillReason, setPendingBillReason] = useState<string | null>(null);
  const [pendingBillApprover, setPendingBillApprover] = useState<string | null>(null);
  const [pendingBillRejectReason, setPendingBillRejectReason] = useState<string | null>(null);
  const [lossWarningModal, setLossWarningModal] = useState<LossWarningState | null>(null);
  const [approvals, setApprovals] = useState<any[]>([]);

  // Customer / supplier ledger statement drawer (shared by both ledger tabs)
  const [selectedLedgerDetails, setSelectedLedgerDetails] = useState<any | null>(null);
  const [selectedLedgerType, setSelectedLedgerType] = useState<'CUSTOMER' | 'SUPPLIER' | null>(null);
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);

  // Bill number handed from Order History to the Return Center
  const [returnBillNumber, setReturnBillNumber] = useState<string | null>(null);

  // Modals & Floating popups
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);

  // Order detail drawer (agent can open a bill from anywhere)
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  // Floating AI Copilot & Assist Panel states
  const [showCopilot, setShowCopilot] = useState(false);

  // Day Opening / Closing Session states
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);

  // Expenses management states
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Reminders states
  const [reminders, setReminders] = useState<any[]>([]);

  // AI Settings states
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiSettingsList, setAiSettingsList] = useState<any[]>([]);

  // Offline Sandbox Indicator
  // "Sandbox" now means the server is unreachable: tabs skip their fetches and POS bills from the cache
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  // Full catalogue for POS search (all products, cached on the device for offline billing)
  const [posCatalogue, setPosCatalogue] = useState<Product[]>([]);
  const [catalogueCachedAt, setCatalogueCachedAt] = useState<string | null>(null);
  const [queueVersion, setQueueVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline'>('connected');

  // Input Focus Refs
  const productSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

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

  // Opens a tab the same way the sidebar does; returns false when the tab is unknown or not allowed
  const openTabByName = (path: string): boolean => {
    const item = NAV_ITEMS.find(i => i.id === path);
    if (!item || !canSeeNavItem(item, user?.role)) return false;
    setActiveTab(item.id);
    return true;
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
    setReturnBillNumber(billNumber);
    setActiveTab('returns');
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
      if (!prodRes.ok) throw new Error(`Products request failed (${prodRes.status})`);
      setProducts(await prodRes.json());
      setBackendStatus('connected');
      setIsSandboxMode(false);

      // 2. Fetch customers
      const custRes = await secureFetch(`${API_BASE}/billing/customers`);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
        cacheSet('customers', custData);
      }

      await loadPosCatalogue();

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
      if (isNetworkError(e)) await goOffline();
      else console.error('Loading shop data failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Every product (paged 100 at a time) for POS search, saved on the device for offline billing
  const loadPosCatalogue = async () => {
    const all: Product[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 50; page++) {
      const res = await secureFetch(`${API_BASE}/products?take=100${cursor ? `&cursor=${cursor}` : ''}`);
      if (!res.ok) return;
      const batch: Product[] = await res.json();
      all.push(...batch);
      if (batch.length < 100) break;
      cursor = batch[batch.length - 1].id;
    }
    setPosCatalogue(all);
    setCatalogueCachedAt(new Date().toISOString());
    cacheSet('catalogue', all);
  };

  const goOffline = async () => {
    setBackendStatus('offline');
    setIsSandboxMode(true);
    const [catalogue, cachedCustomers] = await Promise.all([cacheGet<Product[]>('catalogue'), cacheGet<Customer[]>('customers')]);
    if (catalogue) {
      setPosCatalogue(catalogue.value);
      setProducts(catalogue.value.slice(0, 20));
      setCatalogueCachedAt(catalogue.updatedAt);
    }
    if (cachedCustomers) setCustomers(cachedCustomers.value);
  };

  const refreshQueue = () => setQueueVersion(v => v + 1);

  // Sends bills saved offline; the server ignores repeats of the same clientRef
  const runSync = async () => {
    if ((await listQueuedBills()).length === 0) return;
    setIsSyncing(true);
    try {
      const result = await syncQueuedBills(payload =>
        secureFetch(`${API_BASE}/billing/bills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
      );
      if (result.offline) await goOffline();
      if (result.synced > 0) loadPosCatalogue();
    } finally {
      setIsSyncing(false);
      refreshQueue();
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
    }
  }, [user]);

  // Owners and managers get the assistant's morning brief once a day, the first time they open the app
  useEffect(() => {
    if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER')) return;
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem('shopos_brief_seen') === today) return;
      localStorage.setItem('shopos_brief_seen', today);
    } catch {
      return;
    }
    setShowCopilot(true);
  }, [user]);

  // While offline, check every 10s whether the server is back; then reload data and sync saved bills
  useEffect(() => {
    if (!user || backendStatus !== 'offline') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
          await fetchAllData();
          runSync();
        }
      } catch {
        // still offline
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [user, backendStatus]);

  // Online: retry saved bills periodically and as soon as the browser reports the network is back
  useEffect(() => {
    if (!user) return;
    refreshQueue();
    if (backendStatus !== 'connected') return;
    runSync();
    const timer = setInterval(runSync, 30000);
    const onOnline = () => runSync();
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [user, backendStatus]);

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

  // Handle product searches
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts([]);
      return;
    }
    const q = productSearch.trim().toLowerCase();
    const source = posCatalogue.length ? posCatalogue : products;
    const exact = source.filter(p => p.sku.toLowerCase() === q || p.barcode === productSearch.trim());
    const matches = source.filter(p =>
      !exact.includes(p) && (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
      )
    );
    setFilteredProducts([...exact, ...matches].slice(0, 8));
  }, [productSearch, products, posCatalogue]);

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
        // Through a ref: this listener is only re-created when the cart changes, so it must not
        // capture a stale paidAmount / payment method / discount
        checkoutRef.current();
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
  }, [cart, products, selectedCustomer, activeTab, isCommandPaletteOpen, commandPaletteIndex, commandPaletteSearch, user]);

  // ==========================================
  // Login Functions
  // ==========================================

  const handleLoginSubmit = async (loginForm: LoginForm) => {
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
      // Signing in needs the server; a device that was already signed in keeps working offline
      setAuthError("Can't reach the ShopOS server. Check that it is running and try again.");
    } finally {
      setIsLoading(false);
    }
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

  // Enter in the POS search: exact barcode/SKU wins (hardware scanners type the code then Enter), else the top match
  const handleSearchEnter = () => {
    const code = productSearch.trim();
    if (!code) return;
    const source = posCatalogue.length ? posCatalogue : products;
    const exact = source.find(p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    const pick = exact || filteredProducts[0];
    if (pick) addToCart(pick);
  };

  const handleScannedCode = async (code: string) => {
    let product = (posCatalogue.length ? posCatalogue : products).find(p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    if (!product && backendStatus === 'connected') {
      const res = await secureFetch(`${API_BASE}/products?search=${encodeURIComponent(code)}&take=5`);
      if (res.ok) product = (await res.json() as Product[]).find(p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    }
    if (product) {
      setActiveTab('pos');
      addProductToCart(product, 1);
    } else {
      alert(`No product has barcode ${code}. Add it from Products & Stock, or set the barcode on the product.`);
    }
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
  const checkoutRef = useRef(handlePOSCheckout);
  checkoutRef.current = handlePOSCheckout;

  const executeCheckout = async (approvedByManagerId?: string, bypassLossWarning?: boolean) => {
    const offline = backendStatus === 'offline';
    const needsApproval = cart.some(item => (item.unitPrice - item.discount) < item.product.level3Price) && !approvedByManagerId && user?.role !== 'OWNER';
    if (offline && (paymentMethod === 'CREDIT' || needsApproval)) {
      alert(paymentMethod === 'CREDIT'
        ? 'Credit sales need the server to check the credit limit. Take cash, UPI or card, or wait until the connection is back.'
        : 'Prices below the minimum need approval, which needs the server. Use a normal price or wait until the connection is back.');
      return;
    }
    setIsCheckingOut(true);

    const actualPaid = paymentMethod === 'CASH' ? Number(paidAmount) : totals.netAmount;
    // Same key for every attempt, so a retried or later-synced bill is never recorded twice
    const clientRef = newClientRef();
    const payload = {
      billData: {
        clientRef,
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

    // Saves the bill on this device and updates the local stock picture until it syncs
    const saveOffline = async (soldCart: CartItem[]) => {
      await enqueueBill(payload, { total: totals.netAmount, items: soldCart.length, customer: selectedCustomer?.name });
      if (!isQuote) {
        const sold = new Map(soldCart.map(i => [i.product.id, i.quantity]));
        const adjust = (list: Product[]) => list.map(p => sold.has(p.id) && p.stockLevels[0]
          ? { ...p, stockLevels: [{ ...p.stockLevels[0], quantity: Math.max(0, p.stockLevels[0].quantity - sold.get(p.id)!) }, ...p.stockLevels.slice(1)] }
          : p);
        setPosCatalogue(prev => {
          const next = adjust(prev);
          cacheSet('catalogue', next);
          return next;
        });
        setProducts(prev => adjust(prev));
      }
      setCheckoutResult({
        billNumber: `OFFLINE-${clientRef.slice(-6).toUpperCase()}`,
        netAmount: totals.netAmount,
        paidAmount: actualPaid,
        changeAmount: Math.max(0, actualPaid - totals.netAmount),
        isQuote,
        offline: true,
      });
      refreshQueue();
    };

    if (offline) {
      const soldCart = [...cart];
      await saveOffline(soldCart);
      setCart([]);
      setSelectedCustomer(null);
      setOverallDiscount(0);
      setPaidAmount('0');
      setIsCheckingOut(false);
      return;
    }

    const requiresApproval = cart.some(item => (item.unitPrice - item.discount) < item.product.level3Price) && !approvedByManagerId && user?.role !== 'OWNER';

    const optimisticInvoice = `BILL-${Date.now().toString().slice(-6)}`;
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
            id: order.id,
            billNumber: order.billNumber,
            netAmount: order.netAmount,
            paidAmount: order.paidAmount,
            changeAmount: Math.max(0, order.paidAmount - order.netAmount),
            isQuote: order.isQuote,
            customerPhone: savedCustomer && savedCustomer.phone !== '0000000000' ? savedCustomer.phone : null,
          });
          fetchCatalogProducts();
          loadPosCatalogue();
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
      if (!requiresApproval && isNetworkError(err) && paymentMethod !== 'CREDIT') {
        // Connection dropped mid-checkout: keep the sale, sync it later with the same clientRef
        await saveOffline(savedCart);
        await goOffline();
      } else if (!requiresApproval) {
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
  // Render Login Layout
  // ==========================================

  if (!user) {
    return <LoginScreen authError={authError} isLoading={isLoading} onLogin={handleLoginSubmit} />;
  }

  // ==========================================
  // Render Application Shell
  // ==========================================

  return (
    <ShopContext.Provider value={{ API_BASE, secureFetch, user, isSandboxMode, fetchAllData }}>
      <div className={`flex h-screen w-screen overflow-hidden ${isDarkMode ? 'bg-neutral-950 text-neutral-100 dark' : 'bg-neutral-50 text-neutral-900 light'} ${isCompactMode ? 'compact-mode' : ''}`}>

        {/* 1. Sidebar */}
        <Sidebar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          badges={{ approvals: approvals.filter(a => a.status === 'PENDING').length }}
          backendStatus={backendStatus}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          isCompactMode={isCompactMode}
          setIsCompactMode={setIsCompactMode}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
          handleLogout={handleLogout}
        />

        {/* 2. Main Content Frame */}
        <main className="flex-1 flex flex-col min-w-0 bg-neutral-950 relative">
          <OfflineBanner
            offline={backendStatus === 'offline'}
            queueVersion={queueVersion}
            syncing={isSyncing}
            onSyncNow={runSync}
            catalogueCachedAt={catalogueCachedAt}
          />
          <BarcodeScanner open={showScanner} onClose={() => setShowScanner(false)} onDetected={handleScannedCode} />
          <AnimatePresence mode="wait">
            {activeTab === 'pos' && (
              <PosTab
                key="pos"
                onSearchEnter={handleSearchEnter}
                onOpenScanner={() => setShowScanner(true)}
                cart={cart}
                totals={totals}
                setProducts={setProducts}
                customers={customers}
                setCustomers={setCustomers}
                categories={categories}
                units={units}
                activeSession={activeSession}
                setShowOpeningModal={setShowOpeningModal}
                setShowExpenseModal={setShowExpenseModal}
                setShowClosingModal={setShowClosingModal}
                productSearchRef={productSearchRef}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                filteredProducts={filteredProducts}
                customerSearchRef={customerSearchRef}
                customerSearch={customerSearch}
                setCustomerSearch={setCustomerSearch}
                filteredCustomers={filteredCustomers}
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                handleSelectCustomer={handleSelectCustomer}
                isQuote={isQuote}
                setIsQuote={setIsQuote}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paidAmount={paidAmount}
                setPaidAmount={setPaidAmount}
                isCheckingOut={isCheckingOut}
                addToCart={addToCart}
                updateCartQty={updateCartQty}
                updateCartSellingPrice={updateCartSellingPrice}
                removeFromCart={removeFromCart}
                clearCart={clearCart}
                handlePOSCheckout={handlePOSCheckout}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryTab
                key="inventory"
                products={products}
                setProducts={setProducts}
                categories={categories}
                units={units}
                suppliers={suppliers}
                catalogSearch={catalogSearch}
                handleCatalogSearchChange={handleCatalogSearchChange}
                catalogCursorHistory={catalogCursorHistory}
                hasMoreCatalog={hasMoreCatalog}
                handleCatalogPrevPage={handleCatalogPrevPage}
                handleCatalogNextPage={handleCatalogNextPage}
              />
            )}

            {activeTab === 'settings' && (
              <DevConsoleTab
                key="settings"
                products={products}
                aiSettingsList={aiSettingsList}
                setAiSettingsList={setAiSettingsList}
                fetchAiSettings={fetchAiSettings}
                handleSaveAiSettingsSubmit={handleSaveAiSettingsSubmit}
              />
            )}

            {activeTab === 'purchases' && <PurchasesTab key="purchases" />}
            {activeTab === 'reports' && <ReportsTab key="reports" />}
            {activeTab === 'users' && <UsersTab key="users" />}
            {activeTab === 'ai-quality' && <AiQualityTab key="ai-quality" />}

            {activeTab === 'knowledge-base' && user && (
              <TabPane key="knowledge-base" className="flex-1 flex flex-col overflow-hidden h-full">
                <KnowledgeBase apiBase={API_BASE} secureFetch={secureFetch} role={user.role} />
              </TabPane>
            )}

            {activeTab === 'order-history' && (
              <OrderHistoryTab
                key="order-history"
                selectedOrder={selectedOrder}
                setSelectedOrder={setSelectedOrder}
                orderDetailLoading={orderDetailLoading}
                setOrderDetailLoading={setOrderDetailLoading}
                openOrderDetail={openOrderDetail}
                startReturnFromOrder={startReturnFromOrder}
              />
            )}

            {activeTab === 'approvals' && (
              <ApprovalsTab key="approvals" approvals={approvals} fetchApprovals={fetchApprovals} />
            )}

            {activeTab === 'customer-ledgers' && (
              <CustomerLedgersTab key="customer-ledgers" handleOpenLedgerDrawer={handleOpenLedgerDrawer} />
            )}

            {activeTab === 'supplier-ledgers' && (
              <SupplierLedgersTab key="supplier-ledgers" handleOpenLedgerDrawer={handleOpenLedgerDrawer} />
            )}

            {activeTab === 'returns' && (
              <ReturnsTab
                key="returns"
                returnBillNumber={returnBillNumber}
                onReturnBillHandled={() => setReturnBillNumber(null)}
              />
            )}
          </AnimatePresence>
        </main>

        {/* ==========================================
            MODALS & FLOATING OVERLAYS
            (tab-specific dialogs are rendered by their tab component)
            ========================================== */}

        {/* OVERLAY A: Floating Asynchronous Approval Wait Overlay */}
        <PendingApprovalOverlay
          pendingBillId={pendingBillId}
          pendingBillNumber={pendingBillNumber}
          pendingBillStatus={pendingBillStatus}
          pendingBillReason={pendingBillReason}
          pendingBillApprover={pendingBillApprover}
          pendingBillRejectReason={pendingBillRejectReason}
          handleCancelPendingRequest={handleCancelPendingRequest}
        />

        {/* OVERLAY A2: Highly Visible Loss Sale Warning Modal for Owners */}
        <LossWarningModal lossWarningModal={lossWarningModal} setLossWarningModal={setLossWarningModal} />

        {/* OVERLAY B: Checkout Success Modal */}
        <CheckoutSuccessModal checkoutResult={checkoutResult} setCheckoutResult={setCheckoutResult} clearCart={clearCart} />

        {/* DRAWER: Advanced Customer/Supplier Ledger Timeline Statements */}
        <LedgerDrawer
          ledgerDrawerOpen={ledgerDrawerOpen}
          setLedgerDrawerOpen={setLedgerDrawerOpen}
          selectedLedgerDetails={selectedLedgerDetails}
          selectedLedgerType={selectedLedgerType}
          handleOpenLedgerDrawer={handleOpenLedgerDrawer}
        />

        {/* 3. Global Command Palette Modal (Ctrl + K) */}
        <CommandPalette
          isCommandPaletteOpen={isCommandPaletteOpen}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
          commands={getCommands()}
          commandPaletteSearch={commandPaletteSearch}
          setCommandPaletteSearch={setCommandPaletteSearch}
          commandPaletteIndex={commandPaletteIndex}
          setCommandPaletteIndex={setCommandPaletteIndex}
        />

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
        <OpeningSessionModal showOpeningModal={showOpeningModal} setShowOpeningModal={setShowOpeningModal} setActiveSession={setActiveSession} />

        {/* OVERLAY K: Day Closing Worksheet & Differences Modal */}
        <ClosingSessionModal showClosingModal={showClosingModal} setShowClosingModal={setShowClosingModal} setActiveSession={setActiveSession} />

        {/* OVERLAY L: Expense Management Modal */}
        <ExpenseModal
          showExpenseModal={showExpenseModal}
          setShowExpenseModal={setShowExpenseModal}
          fetchExpenses={fetchExpenses}
          fetchActiveSession={fetchActiveSession}
        />

        {/* OVERLAY M: AI Settings keys config screen */}
        <AiSettingsModal
          showAiSettings={showAiSettings}
          setShowAiSettings={setShowAiSettings}
          aiSettingsList={aiSettingsList}
          setAiSettingsList={setAiSettingsList}
          handleSaveAiSettingsSubmit={handleSaveAiSettingsSubmit}
        />

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
    </ShopContext.Provider>
  );
}
