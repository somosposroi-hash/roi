import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Barcode, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  X,
  Zap,
  Sparkles,
  Search,
  Camera,
  Flame,
  Layers,
  ArrowRight,
  Clock,
  PauseCircle,
  ShieldCheck,
  Gift,
  Wine,
  Tag
} from 'lucide-react';
import { Product, CartItem, Sale, HeldCart, ProductPresentation, Combo, BcvRateInfo } from '../types';
import { playScannerBeep, playErrorBeep, playCashRegisterChime } from '../utils/audio';
import { getProductEmoji, getPopularProducts } from '../utils/product-meta';
import { getPOSConfig } from '../utils/configHelper';
import { isModuleEnabled } from '../utils/systemModules';
import { printSaleReceipt } from '../utils/printerService';
import { PhotoUploadModal } from './PhotoUploadModal';
import { PaymentPage } from './PaymentPage';
import { HeldCartsModal } from './HeldCartsModal';
import { PaymentMethodLogo, PaymentMethodId } from './PaymentMethodLogo';
import { MeasurementQuantityModal } from './MeasurementQuantityModal';
import { ProductPresentationModal } from './ProductPresentationModal';
import { PosCombosModal } from './PosCombosModal';
import { PosSelectableComboModal } from './PosSelectableComboModal';
import { detectMeasurementCategory, formatMeasurementQuantity, parseScaleBarcode } from '../utils/measurementHelper';
import { processSaleContainers, getBeerBuckets, getProductReturnableConfig } from '../utils/bottleBucketService';

interface PosTerminalProps {
  products: Product[];
  onRefreshProducts: () => void;
  onRefreshAlerts: () => void;
  bcvRate?: number;
  bcvRateInfo?: BcvRateInfo | null;
  onNavigate?: (tab: any) => void;
  currentUser?: any;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  products,
  onRefreshProducts,
  onRefreshAlerts,
  bcvRate: propBcvRate,
  bcvRateInfo,
  onNavigate,
  currentUser,
}) => {
  const [posConfig, setPosConfig] = useState(() => getPOSConfig());

  const fetchActiveShift = async () => {
    try {
      const url = currentUser ? `/api/v1/shifts/active?cashierName=${encodeURIComponent(currentUser.name)}` : '/api/v1/shifts/active';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setActiveShift(data.data);
      } else {
        setActiveShift(null);
      }
    } catch {
      setActiveShift(null);
    }
  };

  useEffect(() => {
    fetchActiveShift();
    const handleSync = () => {
      setPosConfig(getPOSConfig());
      fetchActiveShift();
    };
    window.addEventListener('focus', handleSync);
    const interval = setInterval(handleSync, 3000);
    return () => {
      window.removeEventListener('focus', handleSync);
      clearInterval(interval);
    };
  }, []);

  const handleConfirmOpenShift = async () => {
    setIsOpeningShift(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierName,
          bcvRate,
          initialCashBs: 0,
          initialCashUsd: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'No se pudo abrir el turno');
      }
      setActiveShift(data.data);
      setIsOpenShiftModalOpen(false);
      playCashRegisterChime();
    } catch (err: any) {
      playErrorBeep();
      setErrorMessage(err.message || 'Error abriendo turno');
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleStartPayment = () => {
    if (!activeShift) {
      if (onNavigate) {
        onNavigate('shifts');
      } else {
        setIsOpenShiftModalOpen(true);
      }
      return;
    }
    setIsPaymentModalOpen(true);
  };

  const [barcodeInput, setBarcodeInput] = useState('');
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const cashierName = currentUser?.name || 'Caja 1 - Principal';
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [lastLookupTiming, setLastLookupTiming] = useState<{ ms: number; cached: boolean; barcode: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  
  // Selected category for popular products filter
  const [popularCategoryFilter, setPopularCategoryFilter] = useState<string>('TODOS');
  const [isPopularProductsMinimized, setIsPopularProductsMinimized] = useState<boolean>(false);
  
  // Photo upload modal state
  const [photoModalProduct, setPhotoModalProduct] = useState<Product | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Quantity Selector Modal State
  const [quantityModalProduct, setQuantityModalProduct] = useState<Product | null>(null);
  const [quantityModalValue, setQuantityModalValue] = useState<number>(1);
  const [quantityModalPriceOverride, setQuantityModalPriceOverride] = useState<number | undefined>(undefined);

  // Measurement Quantity Modal State (Weight, Length, Volume)
  const [measurementModalProduct, setMeasurementModalProduct] = useState<Product | null>(null);
  const [measurementModalInitialQty, setMeasurementModalInitialQty] = useState<number>(1);

  // Presentation Selection Modal State (Caja, Sixpack, Combo, Bulto, Custom)
  const [presentationModalProduct, setPresentationModalProduct] = useState<Product | null>(null);

  // Variable Price (Open Price) Modal State
  const [openPriceProduct, setOpenPriceProduct] = useState<Product | null>(null);
  const [openPriceInputValue, setOpenPriceInputValue] = useState<string>('');
  const openPriceInputRef = useRef<HTMLInputElement>(null);

  // Wholesale Authorization Password Modal State
  const [wholesaleModalItem, setWholesaleModalItem] = useState<{ productId: string; presentationId?: string; enable: boolean } | null>(null);
  const [wholesalePasswordInput, setWholesalePasswordInput] = useState<string>('');
  const [wholesaleAuthError, setWholesaleAuthError] = useState<string | null>(null);
  const wholesaleInputRef = useRef<HTMLInputElement>(null);

  // Held Carts (Carritos / Tickets en espera con numeración 0, 1, 2...)
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      const saved = localStorage.getItem('bodegon_held_carts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);
  const [heldToastMessage, setHeldToastMessage] = useState<string | null>(null);

  // Combos Modals & State
  const [isCombosModalOpen, setIsCombosModalOpen] = useState(false);
  const [selectableComboToPick, setSelectableComboToPick] = useState<Combo | null>(null);
  const isCombosModuleActive = isModuleEnabled('combos');

  // Containers (Tobos & Botellas) Modal
  const [isContainersModalOpen, setIsContainersModalOpen] = useState(false);
  const [customContainerTitle, setCustomContainerTitle] = useState('Garantía / Envase Especial');
  const [customContainerPrice, setCustomContainerPrice] = useState('1.00');

  const showHeldToast = (msg: string) => {
    setHeldToastMessage(msg);
    setTimeout(() => setHeldToastMessage(null), 3000);
  };

  const handleAddContainerToCart = (title: string, priceUsd: number, barcode: string) => {
    if (priceUsd <= 0) return;
    const containerProduct: Product = {
      id: `container-${barcode}`,
      barcode: barcode,
      sku: barcode,
      name: title,
      category: 'Envases & Tobos',
      price: priceUsd,
      cost: 0,
      stock: 9999,
      minStock: 0,
      unit: 'und',
      isActive: true,
    };
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === containerProduct.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + 1 };
        return updated;
      }
      return [{ product: containerProduct, quantity: 1 }, ...prev];
    });
    playCashRegisterChime();
  };

  // Sync heldCarts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bodegon_held_carts', JSON.stringify(heldCarts));
    } catch (e) {
      console.error('Error saving held carts to localStorage:', e);
    }
  }, [heldCarts]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const nameSearchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<any>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  // Focus open price input when modal opens
  useEffect(() => {
    if (openPriceProduct) {
      setTimeout(() => openPriceInputRef.current?.focus(), 100);
    }
  }, [openPriceProduct]);

  // Exchange rate for Venezuelan Bodegón context (synced via live BCV API)
  const bcvRate = propBcvRate || 849.56;

  // Auto-focus barcode input for instant scan gun operation
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Auto-print receipt when sale completes if direct printing is enabled in POSConfig
  useEffect(() => {
    if (completedSale && posConfig.printerEnabled && posConfig.printerAutoPrint) {
      printSaleReceipt(completedSale, bcvRate);
    }
  }, [completedSale]);

  // POS Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaymentModalOpen) return;

      // SUCCESS MODAL SHORTCUTS: If completed sale is open, F1 goes to new sale, F2 prints
      if (completedSale) {
        if (e.key === 'F1') {
          e.preventDefault();
          setCompletedSale(null);
        } else if (e.key === 'F2') {
          e.preventDefault();
          printSaleReceipt(completedSale, bcvRate);
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        nameSearchInputRef.current?.focus();
      } else if (e.key === 'F3' || (e.ctrlKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        handleHoldCurrentCart();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsHeldCartsModalOpen((prev) => !prev);
      } else if (e.key === 'Delete' || e.key === 'Supr') {
        if (!isInputFocused && cart.length > 0) {
          e.preventDefault();
          clearCart();
        }
      } else if ((e.key === '+' || e.key === '=' || e.key === '-') && !isInputFocused) {
        if (cart.length > 0) {
          e.preventDefault();
          const lastItem = cart[cart.length - 1];
          updateQuantity(lastItem.product.id, e.key === '-' ? -1 : 1);
        }
      } else if (e.key === 'F9' || (e.key === ' ' && !isInputFocused)) {
        if (cart.length > 0) {
          e.preventDefault();
          handleStartPayment();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentModalOpen, cart, heldCarts, completedSale]);

  // Keyboard and Input helper logic for the Quantity Selection Modal
  useEffect(() => {
    if (!quantityModalProduct) return;

    // Auto-select text or focus quantity box safely
    const timer = setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);

    const handleModalKeys = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl === quantityInputRef.current;

      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        setQuantityModalValue((prev) => Math.min(quantityModalProduct.stock, prev + 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setQuantityModalValue((prev) => Math.max(1, prev - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setQuantityModalProduct(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isInputFocused) {
          quantityInputRef.current?.focus();
          quantityInputRef.current?.select();
        } else {
          // Commit the quantity
          const val = Number(quantityInputRef.current?.value || quantityModalValue);
          if (!isNaN(val) && val > 0 && val <= quantityModalProduct.stock) {
            commitProductToCart(quantityModalProduct, val);
            setQuantityModalProduct(null);
          } else {
            playErrorBeep();
            setErrorMessage(`Cantidad no permitida o stock insuficiente (Stock: ${quantityModalProduct.stock})`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleModalKeys);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleModalKeys);
    };
  }, [quantityModalProduct, quantityModalValue]);

  // Cart calculations (IVA removed per user request)
  const subtotal = cart.reduce((sum, item) => {
    const priceToUse = item.effectiveUnitPrice !== undefined ? item.effectiveUnitPrice : item.product.price;
    return sum + priceToUse * item.quantity;
  }, 0);
  const tax = 0;
  const total = subtotal;
  const totalBs = Math.round(total * bcvRate * 100) / 100;

  // Filter active products so inactive products never appear in POS
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.isActive !== false && (p.isActive as any) !== 0);
  }, [products]);

  // Real-time product search by name
  const nameSearchResults = useMemo(() => {
    const query = nameSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return activeProducts.filter((p) => 
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [nameSearchQuery, activeProducts]);

  // Popular / high-demand products
  const popularProducts = useMemo(() => {
    const list = getPopularProducts(activeProducts);
    if (popularCategoryFilter === 'TODOS') return list.slice(0, 12);
    return list.filter((p) => p.category.toLowerCase().includes(popularCategoryFilter.toLowerCase())).slice(0, 12);
  }, [activeProducts, popularCategoryFilter]);

  // Unique categories for popular filter tabs
  const categoryTabs = useMemo(() => {
    const cats = Array.from(new Set(activeProducts.map((p) => p.category)));
    return ['TODOS', ...cats];
  }, [activeProducts]);

  // Handle direct product addition into cart
  const handleAddProductToCart = (product: Product) => {
    setErrorMessage(null);

    if (product.isVariablePrice) {
      setOpenPriceProduct(product);
      setOpenPriceInputValue('');
      return;
    }

    if (product.stock <= 0) {
      playErrorBeep();
      setErrorMessage(`"${product.name}" está agotado en inventario`);
      return;
    }

    const activePresentations = (product.presentations || []).filter((p) => p.enabled);
    if (activePresentations.length > 0) {
      setPresentationModalProduct(product);
      return;
    }

    const cat = detectMeasurementCategory(product.unit);
    if (cat !== 'UNIT') {
      const existing = cart.find((i) => i.product.id === product.id && !i.presentation);
      setMeasurementModalInitialQty(existing ? existing.quantity : 1);
      setMeasurementModalProduct(product);
    } else {
      if (posConfig.askQuantityInPos !== false) {
        setQuantityModalProduct(product);
        setQuantityModalValue(1);
      } else {
        commitProductToCart(product, 1);
      }
    }
  };

  const handleSelectPresentationPackage = (product: Product, presentation: ProductPresentation) => {
    if (product.stock < presentation.unitsToDeduct) {
      playErrorBeep();
      setErrorMessage(`Stock insuficiente para vender "${presentation.name}". Requiere ${presentation.unitsToDeduct} ${product.unit} y solo quedan ${product.stock}`);
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.product.id === product.id && i.presentation?.id === presentation.id
      );
      if (existingIdx >= 0) {
        const newQty = prev[existingIdx].quantity + 1;
        const totalUnits = newQty * presentation.unitsToDeduct;
        if (totalUnits > product.stock) {
          playErrorBeep();
          setErrorMessage(`Stock máximo excedido. Solo quedan ${product.stock} ${product.unit} de ${product.name}`);
          return prev;
        }
        playScannerBeep();
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        return updated;
      } else {
        playScannerBeep();
        return [
          {
            product,
            quantity: 1,
            presentation,
            effectiveUnitPrice: presentation.packagePrice,
            unitsDeductedPerPackage: presentation.unitsToDeduct,
          },
          ...prev,
        ];
      }
    });
  };

  // Add all items from a Fixed Combo to Cart with exact stock deduction and total combo price
  const handleAddFixedComboToCart = (combo: Combo) => {
    if (!combo.items || combo.items.length === 0) {
      setErrorMessage(`El combo "${combo.name}" no tiene productos configurados`);
      return;
    }

    // Verify stock for all items
    for (const item of combo.items) {
      const prod = products.find(p => p.id === item.productId || p.barcode === item.productBarcode);
      const unitsNeeded = item.unitsToDeduct > 0 ? item.unitsToDeduct : item.quantity;
      if (!prod || prod.stock < unitsNeeded) {
        playErrorBeep();
        setErrorMessage(`Stock insuficiente para agregar el combo: "${item.productName}" solo tiene ${prod?.stock || 0} disponibles`);
        return;
      }
    }

    // Distribute combo price proportionally or equally among items
    const itemCount = combo.items.length;
    const refSum = combo.items.reduce((sum, item) => sum + (item.unitPrice || 1) * (item.unitsToDeduct || 1), 0);
    
    let distributedSoFar = 0;
    const newCartItems: CartItem[] = [];

    combo.items.forEach((item, idx) => {
      const prod = products.find(p => p.id === item.productId || p.barcode === item.productBarcode);
      if (!prod) return;

      let itemPrice = 0;
      if (idx === itemCount - 1) {
        // Last item takes remainder to guarantee exact combo price sum
        itemPrice = Math.max(0, Math.round((combo.price - distributedSoFar) * 100) / 100);
      } else {
        const itemWeight = refSum > 0 ? ((item.unitPrice || 1) * (item.unitsToDeduct || 1)) / refSum : 1 / itemCount;
        itemPrice = Math.round(combo.price * itemWeight * 100) / 100;
        distributedSoFar += itemPrice;
      }

      const comboPres: ProductPresentation = {
        id: `combo-${combo.id}-${item.id}`,
        type: 'COMBO',
        name: `🎁 ${combo.name}`,
        unitsToDeduct: item.unitsToDeduct > 0 ? item.unitsToDeduct : item.quantity,
        packagePrice: itemPrice,
        enabled: true
      };

      newCartItems.push({
        product: prod,
        quantity: 1,
        presentation: comboPres,
        effectiveUnitPrice: itemPrice,
        unitsDeductedPerPackage: item.unitsToDeduct > 0 ? item.unitsToDeduct : item.quantity
      });
    });

    setCart(prev => [...newCartItems, ...prev]);
    playCashRegisterChime();
  };

  // Add customized variety combo items to cart
  const handleConfirmSelectableCombo = (combo: Combo, selectedItems: Array<{ product: Product; quantity: number }>) => {
    if (!selectedItems || selectedItems.length === 0) return;

    const totalSelectedQty = selectedItems.reduce((sum, i) => sum + i.quantity, 0);
    const unitPricePerItem = totalSelectedQty > 0 ? Math.round((combo.price / totalSelectedQty) * 100) / 100 : 0;

    const newCartItems: CartItem[] = selectedItems.map(item => {
      const comboPres: ProductPresentation = {
        id: `combo-var-${combo.id}-${item.product.id}`,
        type: 'COMBO',
        name: `🎁 ${combo.name}`,
        unitsToDeduct: 1,
        packagePrice: unitPricePerItem,
        enabled: true
      };

      return {
        product: item.product,
        quantity: item.quantity,
        presentation: comboPres,
        effectiveUnitPrice: unitPricePerItem,
        unitsDeductedPerPackage: 1
      };
    });

    setCart(prev => [...newCartItems, ...prev]);
    playCashRegisterChime();
  };

  const handleSelectBaseUnitFromPresentationModal = (product: Product) => {
    const cat = detectMeasurementCategory(product.unit);
    if (cat !== 'UNIT') {
      const existing = cart.find((i) => i.product.id === product.id && !i.presentation);
      setMeasurementModalInitialQty(existing ? existing.quantity : 1);
      setMeasurementModalProduct(product);
    } else {
      setQuantityModalProduct(product);
      setQuantityModalValue(1);
    }
  };

  const handleConfirmMeasurement = (product: Product, baseQuantity: number) => {
    if (baseQuantity <= 0) return;

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        if (!product.isVariablePrice && baseQuantity > product.stock) {
          playErrorBeep();
          setErrorMessage(`Stock máximo excedido. Solo quedan ${product.stock} ${product.unit} de ${product.name}`);
          return prev;
        }
        playScannerBeep();
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: baseQuantity };
        return updated;
      } else {
        if (!product.isVariablePrice && baseQuantity > product.stock) {
          playErrorBeep();
          setErrorMessage(`Stock máximo excedido. Solo quedan ${product.stock} ${product.unit} de ${product.name}`);
          return prev;
        }
        playScannerBeep();
        return [{ 
          product, 
          quantity: baseQuantity,
          effectiveUnitPrice: quantityModalPriceOverride !== undefined ? quantityModalPriceOverride : undefined
        }, ...prev];
      }
    });
    setQuantityModalPriceOverride(undefined);
  };

  const handleConfirmOpenPrice = (product: Product, inputPrice: number) => {
    if (inputPrice <= 0) return;

    let finalPriceUsd = inputPrice;
    if (product.variablePriceCurrency === 'BS') {
      finalPriceUsd = bcvRate > 0 ? Math.round((inputPrice / bcvRate) * 100) / 100 : inputPrice;
    }

    setOpenPriceProduct(null);

    // If unit product, show quantity modal if configured
    const cat = detectMeasurementCategory(product.unit);
    if (cat === 'UNIT') {
      if (posConfig.askQuantityInPos !== false) {
        setQuantityModalProduct(product);
        setQuantityModalValue(1);
        setQuantityModalPriceOverride(finalPriceUsd);
      } else {
        commitProductToCart(product, 1, finalPriceUsd);
      }
    } else {
      // Measurement product (Weight, Length, Volume) - usually requires quantity input
      setMeasurementModalInitialQty(1);
      setMeasurementModalProduct(product);
      setQuantityModalPriceOverride(finalPriceUsd);
    }
  };

  const commitProductToCart = (product: Product, quantity: number, priceOverride?: number) => {
    if (quantity <= 0) return;
    setCart((prev) => {
      // Note: for open price products, we don't merge them if they have different prices
      const existingIdx = prev.findIndex((item) => 
        item.product.id === product.id && 
        (!priceOverride || item.effectiveUnitPrice === priceOverride)
      );
      if (existingIdx >= 0) {
        const newQty = prev[existingIdx].quantity + quantity;
        if (!product.isVariablePrice && newQty > product.stock) {
          playErrorBeep();
          setErrorMessage(`No se puede agregar ${quantity} unidades más. El stock disponible es ${product.stock} y ya posee ${prev[existingIdx].quantity} en el carrito.`);
          return prev;
        }
        playScannerBeep();
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        return updated;
      } else {
        if (!product.isVariablePrice && quantity > product.stock) {
          playErrorBeep();
          setErrorMessage(`Stock máximo excedido. Solo quedan ${product.stock} unidades de ${product.name}`);
          return prev;
        }
        playScannerBeep();
        return [{ 
          product, 
          quantity,
          effectiveUnitPrice: priceOverride !== undefined ? priceOverride : undefined
        }, ...prev];
      }
    });
  };

  // Handle Barcode Scan / Lookup
  const handleScan = async (codeToScan?: string) => {
    const rawBarcode = (codeToScan || barcodeInput).trim();
    if (!rawBarcode) return;

    setErrorMessage(null);

    // 1. Instant Client-side Scale Barcode Check (Prefix 21 / PLU + Embedded Price)
    if (posConfig.enableScaleEan13 !== false) {
      const scaleResult = parseScaleBarcode(rawBarcode, products);
      if (scaleResult && scaleResult.matchedProduct) {
        const p = scaleResult.matchedProduct as Product;
        const qty = scaleResult.calculatedQuantity || 1;
        
        commitProductToCart(p, qty);
        setBarcodeInput('');
        showHeldToast(`⚖️ Balanza: ${p.name} - ${qty} ${p.unit} ($${scaleResult.embeddedPrice.toFixed(2)} USD)`);
        barcodeInputRef.current?.focus();
        return;
      }
    }

    const clientStart = performance.now();

    try {
      const res = await fetch(`/api/v1/products/barcode/${encodeURIComponent(rawBarcode)}`);
      const data = await res.json();
      const clientDuration = performance.now() - clientStart;

      if (!res.ok || !data.success) {
        // If it was a scale barcode that wasn't found in products
        const scaleCheck = parseScaleBarcode(rawBarcode);
        if (scaleCheck && scaleCheck.isScaleBarcode) {
          playErrorBeep();
          setErrorMessage(`⚖️ Código de Balanza detectado (PLU: ${scaleCheck.plu}, Precio: $${scaleCheck.embeddedPrice.toFixed(2)} USD), pero no se encontró un producto asignado al PLU ${scaleCheck.plu} en el inventario. Por favor asigne el PLU ${scaleCheck.plu} a su producto en Inventario.`);
          return;
        }

        playErrorBeep();
        setErrorMessage(data.error?.message || 'Producto no encontrado por código de barras');
        return;
      }

      const product: Product = data.data;

      // Handle scale barcode data returned from backend if applicable
      if ((data.data as any).scaleBarcodeData) {
        const scaleData = (data.data as any).scaleBarcodeData;
        const qty = scaleData.calculatedQuantity || 1;
        commitProductToCart(product, qty);
        setBarcodeInput('');
        showHeldToast(`⚖️ Balanza: ${product.name} - ${qty} ${product.unit} ($${scaleData.embeddedPrice.toFixed(2)} USD)`);
        return;
      }

      setLastLookupTiming({
        ms: data.meta?.lookupTimeMs ?? Number(clientDuration.toFixed(2)),
        cached: data.meta?.cached ?? false,
        barcode: product.barcode,
      });

      handleAddProductToCart(product);
      setBarcodeInput('');
    } catch {
      playErrorBeep();
      setErrorMessage('Error de comunicación con el motor local POS');
    } finally {
      barcodeInputRef.current?.focus();
    }
  };

  // Handle Wholesale Price Toggle with Supervisor Password Authorization
  const handleToggleWholesalePrice = (productId: string, presentationId: string | undefined, enable: boolean) => {
    if (!enable) {
      setCart((prev) =>
        prev.map((item) => {
          const match =
            item.product.id === productId &&
            (presentationId ? item.presentation?.id === presentationId : !item.presentation);
          if (match) {
            return {
              ...item,
              isWholesale: false,
              effectiveUnitPrice: item.presentation ? item.presentation.packagePrice : item.product.price,
            };
          }
          return item;
        })
      );
      return;
    }

    setWholesaleModalItem({ productId, presentationId, enable: true });
    setWholesalePasswordInput('');
    setWholesaleAuthError(null);
  };

  const handleVerifyWholesalePassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!wholesaleModalItem) return;

    const targetPass = (posConfig.wholesalePassword || '1234').trim();
    const entered = wholesalePasswordInput.trim();

    if (entered === targetPass) {
      playCashRegisterChime();
      setCart((prev) =>
        prev.map((item) => {
          const match =
            item.product.id === wholesaleModalItem.productId &&
            (wholesaleModalItem.presentationId
              ? item.presentation?.id === wholesaleModalItem.presentationId
              : !item.presentation);
          if (match && item.product.wholesalePrice) {
            return {
              ...item,
              isWholesale: true,
              effectiveUnitPrice: item.product.wholesalePrice,
            };
          }
          return item;
        })
      );
      setWholesaleModalItem(null);
      setWholesalePasswordInput('');
      setWholesaleAuthError(null);
    } else {
      playErrorBeep();
      setWholesaleAuthError('Clave o código de supervisor incorrecto');
    }
  };

  const updateQuantity = (productId: string, delta: number, presentationId?: string) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          const match = item.product.id === productId && (presentationId ? item.presentation?.id === presentationId : !item.presentation);
          if (match) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            const unitsNeeded = item.unitsDeductedPerPackage ? nextQty * item.unitsDeductedPerPackage : nextQty;
            if (unitsNeeded > item.product.stock) {
              setErrorMessage(`Stock insuficiente. Solo quedan ${item.product.stock} ${item.product.unit} de ${item.product.name}`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string, presentationId?: string) => {
    setCart((prev) => prev.filter((item) => {
      if (item.product.id !== productId) return true;
      if (presentationId) return item.presentation?.id !== presentationId;
      return !!item.presentation;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMessage(null);
    barcodeInputRef.current?.focus();
  };

  // Poner el ticket de venta actual en espera con numeración 0, 1, 2...
  const handleHoldCurrentCart = () => {
    if (cart.length === 0) return;

    // Calcular el siguiente número de ticket (0, 1, 2, ...)
    const existingNumbers = heldCarts.map((h) => h.ticketNumber);
    let nextNum = 0;
    while (existingNumbers.includes(nextNum)) {
      nextNum++;
    }

    const newHeld: HeldCart = {
      id: crypto.randomUUID ? crypto.randomUUID() : `held-${Date.now()}-${Math.random()}`,
      ticketNumber: nextNum,
      createdAt: new Date().toISOString(),
      items: [...cart],
      subtotal,
      tax,
      total,
      note: `Ticket pausado en caja`,
    };

    setHeldCarts((prev) => [...prev, newHeld]);
    setCart([]);
    playCashRegisterChime();
    setHeldToastMessage(`Ticket #${nextNum} guardado en espera.`);
    setTimeout(() => setHeldToastMessage(null), 4000);
  };

  // Cargar un ticket en espera a la caja
  const handleLoadHeldCart = (held: HeldCart) => {
    // Si la caja ya tiene productos, pausamos el actual primero para no perderlo
    if (cart.length > 0) {
      const existingNumbers = heldCarts.map((h) => h.ticketNumber);
      let nextNum = 0;
      while (existingNumbers.includes(nextNum) || nextNum === held.ticketNumber) {
        nextNum++;
      }
      const autoParkCurrent: HeldCart = {
        id: crypto.randomUUID ? crypto.randomUUID() : `held-${Date.now()}-${Math.random()}`,
        ticketNumber: nextNum,
        createdAt: new Date().toISOString(),
        items: [...cart],
        subtotal,
        tax,
        total,
        note: `Pausado automáticamente al cargar Ticket #${held.ticketNumber}`,
      };
      setHeldCarts((prev) => [...prev.filter((h) => h.id !== held.id), autoParkCurrent]);
      setHeldToastMessage(`Ticket #${held.ticketNumber} cargado. Venta previa archivada como Ticket #${nextNum}`);
    } else {
      setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
      setHeldToastMessage(`Ticket #${held.ticketNumber} cargado a la caja`);
    }

    setCart(held.items);
    setIsHeldCartsModalOpen(false);
    playScannerBeep();
    setTimeout(() => setHeldToastMessage(null), 4000);
  };

  // Eliminar ticket en espera
  const handleDeleteHeldCart = (id: string) => {
    setHeldCarts((prev) => prev.filter((h) => h.id !== id));
  };

  // Vaciar todos los tickets en espera
  const handleClearAllHeldCarts = () => {
    setHeldCarts([]);
    setIsHeldCartsModalOpen(false);
  };

  // Process payment confirmation from the Payment Modal with atomic guarantees
  const handleConfirmPaymentFromModal = async (paymentData: {
    paymentMethod: PaymentMethodId;
    amountPaid: number;
    reference: string;
  }) => {
    if (cart.length === 0) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const payload = {
        cashierName,
        paymentMethod: paymentData.paymentMethod,
        amountPaid: paymentData.amountPaid,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          productBarcode: item.product.barcode,
          quantity: item.quantity,
          unitPrice: item.effectiveUnitPrice !== undefined ? item.effectiveUnitPrice : item.product.price,
          unitsToDeduct: item.unitsDeductedPerPackage !== undefined ? item.unitsDeductedPerPackage : 1,
          presentationName: item.presentation ? item.presentation.name : undefined,
        })),
        notes: paymentData.reference,
      };

      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        playErrorBeep();
        throw new Error(data.error?.message || 'Error procesando la transacción atómica');
      }

      playCashRegisterChime();
      
      // Auto-process empty returnable beer bottles and combo beer buckets (tobos)
      try {
        processSaleContainers({
          items: cart.map(item => ({
            productId: item.product.id,
            productBarcode: item.product.barcode,
            productName: item.product.name,
            quantity: item.quantity,
            presentation: item.presentation,
            comboDetails: (item as any).comboDetails,
          })),
          products,
          invoiceNumber: data.data.invoiceNumber || 'VTA-POS',
          loanBucketForCombos: true,
        });
      } catch (err) {
        console.warn('Error processing containers on sale:', err);
      }

      setCompletedSale(data.data);
      setCart([]);
      setIsPaymentModalOpen(false);
      await Promise.resolve(onRefreshProducts());
      await Promise.resolve(onRefreshAlerts());
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('inventory-sync', { detail: { type: 'sale', saleId: data.data?.id, timestamp: Date.now() } }));
        try {
          localStorage.setItem('nubly_last_inventory_sync', Date.now().toString());
        } catch {}
      }
    } catch (err: any) {
      playErrorBeep();
      setErrorMessage(err.message || 'Error crítico conectando con el servidor POS');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenPhotoModal = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setPhotoModalProduct(product);
    setIsPhotoModalOpen(true);
  };

  return (
    <div id="pos-terminal-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT/CENTER WORKSPACE: BARCODE SCANNER, NAME SEARCH & POPULAR PRODUCTS PREVIEW (7-8 cols - expanded for spacious cards) */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-5">
        
        {/* TOP WORKBAR: LECTOR DE CÓDIGO DE BARRAS & BUSCADOR POR NOMBRE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          
          {/* Row 1: Barcode Scanner Gun Input */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="pos-barcode-input" className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-blue-600" />
                <span>Lector de Código de Barras</span>
                <span className="text-[10px] font-normal text-slate-500 font-sans">(Escaneo con pistola o manual)</span>
              </label>

              {lastLookupTiming && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1 font-semibold">
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                  {lastLookupTiming.ms} ms {lastLookupTiming.cached ? '(Caché RAM)' : '(SQLite WAL)'}
                </span>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  id="pos-barcode-input"
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBarcodeInput(val);
                    
                    if (scanTimeoutRef.current) {
                      clearTimeout(scanTimeoutRef.current);
                    }

                    const trimmed = val.trim();
                    if (trimmed) {
                      // 1. Instant match in memory for existing loaded products
                      const localMatch = products.find(
                        (p) => (p.barcode === trimmed || p.sku === trimmed) && p.isActive !== false && (p.isActive as any) !== 0
                      );
                      if (localMatch) {
                        handleScan(trimmed);
                        return;
                      }

                      // 2. Automated fallback database check after 180ms of scanner input stream completion
                      if (trimmed.length >= 3) {
                        scanTimeoutRef.current = setTimeout(() => {
                          handleScan(trimmed);
                        }, 180);
                      }
                    }
                  }}
                  placeholder="Escanee código de barra (Ej: 7591011000012)..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  autoComplete="off"
                />
              </div>
              <button
                id="btn-scan-barcode"
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-500/25 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Escanear</span>
              </button>

              {isCombosModuleActive && (
                <button
                  id="btn-pos-combos"
                  type="button"
                  onClick={() => setIsCombosModalOpen(true)}
                  className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 active:scale-95 text-white font-extrabold px-4 sm:px-5 py-3 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
                  title="Abrir catálogo de combos de varios productos y promociones"
                >
                  <Gift className="w-4 h-4 text-amber-200 animate-bounce" />
                  <span>Combos</span>
                </button>
              )}

              {(posConfig.enablePOSContainerCharges !== false || posConfig.enableContainerLoans !== false) && (
                <button
                  id="btn-pos-containers"
                  type="button"
                  onClick={() => setIsContainersModalOpen(true)}
                  className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 hover:from-purple-700 hover:to-indigo-900 active:scale-95 text-white font-extrabold px-4 sm:px-5 py-3 rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20 shrink-0"
                  title="Añadir envases, botellas retornables o tobos de cerveza al carrito"
                >
                  <Wine className="w-4 h-4 text-amber-300" />
                  <span>🪣 + Envase / Tobo</span>
                </button>
              )}
            </form>
          </div>

          {/* Row 2: Buscador de Productos por Nombre */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="pos-name-search" className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>Buscador de Productos por Nombre</span>
              </label>
              {nameSearchQuery && (
                <button
                  type="button"
                  onClick={() => setNameSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="pos-name-search"
                ref={nameSearchInputRef}
                type="text"
                value={nameSearchQuery}
                onChange={(e) => setNameSearchQuery(e.target.value)}
                placeholder="Escriba el nombre del producto (Ej: Harina, Nutella, Cerveza Polar, Café...)"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
              />
            </div>

            {/* Instant Name Search Results Dropdown/Grid */}
            {nameSearchQuery.trim() !== '' && (
              <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fade-in z-20">
                {nameSearchResults.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-500">
                    No se encontraron productos con el nombre "{nameSearchQuery}"
                  </div>
                ) : (
                  nameSearchResults.map((p, idx) => {
                    const isOutOfStock = p.stock <= 0;
                    return (
                      <div
                        key={`search-prod-${p.id}-${idx}`}
                        onClick={() => {
                          if (!isOutOfStock) {
                            handleAddProductToCart(p);
                            setNameSearchQuery('');
                          }
                        }}
                        className={`p-2 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                          isOutOfStock
                            ? 'opacity-50 cursor-not-allowed bg-slate-50'
                            : 'hover:bg-blue-50/70 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {!posConfig.hideProductPhotosAndEmojis && (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center text-lg">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{getProductEmoji(p)}</span>
                              )}
                            </div>
                          )}
                          <div className="truncate">
                            <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-1 rounded">{p.barcode}</span>
                              <span>•</span>
                              <span>Stock: {p.stock} {p.unit}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-bold font-mono text-slate-900">${p.price.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Bs. {(p.price * bcvRate).toFixed(1)}</div>
                          </div>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                              isOutOfStock
                                ? 'bg-slate-200 text-slate-400'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Agregar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* No Active Shift Banner */}
        {!activeShift && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-sm animate-fade-in shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-amber-950">No hay un turno abierto en la caja</p>
                <p className="text-xs text-amber-800">Para poder cobrar y registrar ingresos en Arqueo de Caja debe abrir un turno primero.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('shifts');
                } else {
                  setIsOpenShiftModalOpen(true);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4" />
              <span>Abrir Turno</span>
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between text-rose-800 text-sm animate-fade-in shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* VISTA PREVIA DE PRODUCTOS CON MÁS DEMANDA (Directly below barcode reader) */}
        {posConfig.showPopularProducts && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight whitespace-nowrap">
                    Productos con Más Demanda (Alta Rotación)
                  </h3>
                </div>
              </div>

              {/* Category Filter Dropdown & Minimize Button */}
              <div className="flex items-center gap-2">
                {!isPopularProductsMinimized && (
                  <div className="relative inline-block text-left shrink-0">
                    <select
                      value={popularCategoryFilter}
                      onChange={(e) => setPopularCategoryFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer appearance-none pr-8 transition-all"
                    >
                      {categoryTabs.map((cat) => (
                        <option key={cat} value={cat}>
                          Categoría: {cat === 'TODOS' ? 'Todas' : cat}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                      <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsPopularProductsMinimized(!isPopularProductsMinimized)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  {isPopularProductsMinimized ? 'Maximizar [+]' : 'Minimizar [-]'}
                </button>
              </div>
            </div>

            {/* Grid of Popular Products with Photo, Emoji, Name, Price, and Stock */}
            {!isPopularProductsMinimized && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 animate-fade-in">
              {popularProducts.map((p, idx) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock <= p.minStock && !isOutOfStock;
                const emoji = getProductEmoji(p);

                return (
                  <div
                    key={`popular-card-${p.id}-${idx}`}
                    id={`popular-card-${p.id}`}
                    onClick={() => {
                      if (!isOutOfStock) {
                        handleAddProductToCart(p);
                      }
                    }}
                    className={`group relative bg-white border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-150 select-none ${
                      isOutOfStock
                        ? 'border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                    }`}
                  >
                    {/* Photo or Emoji Preview Area */}
                    {!posConfig.hideProductPhotosAndEmojis ? (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/70 flex items-center justify-center mb-2.5">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-4xl filter drop-shadow-xs group-hover:scale-110 transition-transform">
                              {emoji}
                            </span>
                          </div>
                        )}

                        {/* Stock Badge Overlay */}
                        <div className="absolute top-1.5 left-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {isOutOfStock ? 'Agotado' : `${p.stock} ${p.unit}`}
                          </span>
                        </div>

                        {/* Quick Camera Upload Button */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenPhotoModal(e, p)}
                          title="Subir o cambiar foto del producto"
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-blue-600 shadow-xs transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Compact header with stock badge and camera icon */
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isOutOfStock ? 'Agotado' : `Stock: ${p.stock} ${p.unit}`}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleOpenPhotoModal(e, p)}
                          title="Subir o cambiar foto del producto"
                          className="p-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-blue-600 border border-slate-200 shadow-xs transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="space-y-1 mb-2.5">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors" title={p.name}>
                        {p.name}
                      </h4>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {p.barcode}
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-black font-mono text-slate-900 leading-tight">
                          ${p.price.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          Bs. {(p.price * bcvRate).toFixed(1)}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                          isOutOfStock
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs hover:shadow'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

      </div>

      {/* RIGHT SIDE: TICKET DE VENTA ACTUAL (Sticky panel on desktop - 5-4 cols) */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4">
          
          {/* Ticket Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Ticket de Venta Actual</span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">Cajero: {cashierName}</p>
              </div>
            </div>

            {/* Quick Actions in Header: Hold / View Held / Clear */}
            <div className="flex items-center gap-1.5">

              {/* Button to View Held Carts */}
              <button
                type="button"
                onClick={() => setIsHeldCartsModalOpen(true)}
                className={`text-xs flex items-center gap-1.5 font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  heldCarts.length > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Ver carritos guardados en espera"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>En Espera</span>
                {heldCarts.length > 0 && (
                  <span className="bg-amber-500 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {heldCarts.length}
                  </span>
                )}
              </button>

              {/* Button to Put Current Ticket on Hold */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleHoldCurrentCart}
                  className="text-xs text-amber-700 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 flex items-center gap-1 font-bold px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Pausar ticket actual y guardarlo con numeración 0, 1, 2..."
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </button>
              )}

              {/* Button to Clear Cart */}
              {cart.length > 0 && (
                <button
                  id="btn-clear-cart"
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Vaciar ticket"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 -mx-2 px-2">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Barcode className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Ticket vacío</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  Escanee un código de barras o seleccione productos con demanda
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const effectivePrice = item.effectiveUnitPrice !== undefined ? item.effectiveUnitPrice : item.product.price;
                const itemTotal = effectivePrice * item.quantity;
                const itemKey = item.presentation ? `${item.product.id}-${item.presentation.id}-${idx}` : `${item.product.id}-${idx}`;

                return (
                  <div
                    key={itemKey}
                    id={`cart-item-${itemKey}`}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg px-1.5 transition-colors"
                  >
                    {/* Item Thumbnail & Name */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {!posConfig.hideProductPhotosAndEmojis && (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center text-sm">
                          {item.product.imageUrl ? (
                            <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{getProductEmoji(item.product)}</span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                          <span>{item.product.name}</span>
                          {item.presentation && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              {item.presentation.name}
                            </span>
                          )}
                        </h4>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>${effectivePrice.toFixed(2)} c/u</span>
                          {item.unitsDeductedPerPackage && item.unitsDeductedPerPackage > 1 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({(item.unitsDeductedPerPackage * item.quantity).toFixed(2)} {item.product.unit} stock)
                            </span>
                          )}
                          {item.product.wholesalePrice && item.product.wholesalePrice > 0 && !item.presentation && (
                            <button
                              type="button"
                              onClick={() => handleToggleWholesalePrice(item.product.id, item.presentation?.id, !item.isWholesale)}
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 border transition-all cursor-pointer ${
                                item.isWholesale
                                  ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-500/20'
                                  : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                              }`}
                              title="Activar/desactivar Precio al Mayor (requiere clave de supervisor)"
                            >
                              <span>{item.isWholesale ? 'MAYORISTAS $' + item.product.wholesalePrice.toFixed(2) : 'Aplica Mayor ($' + item.product.wholesalePrice.toFixed(2) + ')'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    {(() => {
                      const itemMeasCat = detectMeasurementCategory(item.product.unit);
                      const isMeasItem = itemMeasCat !== 'UNIT' && !item.presentation;

                      if (isMeasItem) {
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setMeasurementModalInitialQty(item.quantity);
                              setMeasurementModalProduct(item.product);
                            }}
                            className="px-2 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg shrink-0 transition-colors text-left"
                            title="Haz clic para modificar la cantidad por kilos/gramos/metros/litros"
                          >
                            <span className="font-mono font-extrabold text-xs text-blue-900 block">
                              {formatMeasurementQuantity(item.quantity, itemMeasCat, item.product.unit)}
                            </span>
                            <span className="text-[9px] text-blue-600 font-medium block">
                              ✎ Editar
                            </span>
                          </button>
                        );
                      }

                      return (
                        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1, item.presentation?.id)}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1, item.presentation?.id)}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })()}

                    {/* Subtotal & Delete */}
                    <div className="text-right min-w-[65px] shrink-0">
                      <div className="font-mono font-bold text-xs text-slate-900">
                        ${itemTotal.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Bs. {(itemTotal * bcvRate).toFixed(1)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id, item.presentation?.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors shrink-0"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals & Calculations Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Nota de Entrega:</span>
              <span className="font-mono font-medium text-slate-800">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-blue-700 block">Total a Pagar (Bs)</span>
                <div className="text-[11px] font-mono text-slate-500">
                  {bcvRateInfo?.activeScheduleName ? (
                    <span className="text-amber-800 font-bold flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>Script: {bcvRateInfo.activeScheduleName} (Bs. {bcvRate.toFixed(2)})</span>
                    </span>
                  ) : bcvRateInfo?.effectiveCurrency === 'EUR' ? (
                    <span className="text-indigo-700 font-bold">
                      Tasa Euro Oficial (€): Bs. {bcvRate.toFixed(2)}
                    </span>
                  ) : bcvRateInfo?.effectiveCurrency === 'USDT' ? (
                    <span className="text-emerald-700 font-bold">
                      Tasa USDT Paralelo (₮): Bs. {bcvRate.toFixed(2)}
                    </span>
                  ) : (
                    <span>Tasa Oficial BCV ($): Bs. {bcvRate.toFixed(2)}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-black font-mono text-blue-700 tracking-tight">
                  Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                  Ref: ${total.toFixed(2)} USD
                </div>
              </div>
            </div>
          </div>

          {/* Action Button: COBRAR TICKET (Bolívares in large prominence) */}
          <button
            id="btn-process-sale"
            type="button"
            onClick={() => {
              if (cart.length > 0) {
                handleStartPayment();
              }
            }}
            disabled={cart.length === 0 || isProcessing}
            className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md active:scale-98 ${
              cart.length === 0 || isProcessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/25'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Procesando Transacción Atómica...</span>
              </div>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span className="truncate">
                  COBRAR TICKET • Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-mono font-normal opacity-85 shrink-0">
                  (${total.toFixed(2)})
                </span>
              </>
            )}
          </button>

          <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Transacción atómica garantizada con Prisma $transaction</span>
          </div>
        </div>
      </div>

      {/* VENTANA DE COBRO OPTIMIZADA (PÁGINA DEDICADA) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto">
          <PaymentPage
            totalUsd={total}
            totalBs={totalBs}
            bcvRate={bcvRate}
            itemCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
            cashierName={cashierName}
            currentUser={currentUser}
            onBack={() => setIsPaymentModalOpen(false)}
            onConfirmPayment={handleConfirmPaymentFromModal}
            isProcessing={isProcessing}
          />
        </div>
      )}

      {/* COMPLETED SALE RECEIPT MODAL (White Theme) */}
      {completedSale && (() => {
        // Parse client data if present in completed sale notes
        const posConfig = getPOSConfig();
        const currencyMode = posConfig.deliveryNotePriceCurrency || 'BS';

        let client: { name: string; docType: string; docNumber: string; phone?: string; notes?: string } | null = null;
        let discount: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
        let charge: { amount: number; type: 'USD' | 'BS'; description: string } | null = null;
        let pagoMovil: { emisorBank?: string; accountType?: string } | null = null;
        let reference = completedSale.notes || '';
        let adjustedTotalUsd: number | null = null;
        let adjustedTotalBs: number | null = null;

        if (completedSale.notes) {
          if (completedSale.notes.startsWith('METADATA_JSON:')) {
            try {
              const jsonStr = completedSale.notes.replace('METADATA_JSON:', '');
              const meta = JSON.parse(jsonStr);
              client = meta.client || null;
              discount = meta.discount || null;
              charge = meta.charge || null;
              pagoMovil = meta.pagoMovil || null;
              reference = meta.paymentReference || '';
              if (meta.adjustedTotalUsd !== undefined) {
                adjustedTotalUsd = meta.adjustedTotalUsd;
                adjustedTotalBs = meta.adjustedTotalBs;
              }
            } catch (e) {
              console.error('Error parsing METADATA_JSON:', e);
            }
          } else if (completedSale.notes.startsWith('CLIENT_DATA_JSON:')) {
            try {
              const parts = completedSale.notes.split(' | REFERENCE: ');
              const jsonStr = parts[0].replace('CLIENT_DATA_JSON:', '');
              client = JSON.parse(jsonStr);
              reference = parts[1] || '';
            } catch (e) {
              console.error('Error parsing client data from notes:', e);
            }
          }
        }

        const effectiveReceiptRate = (completedSale as any).bcvRate || bcvRate;
        const finalTotalUsd = adjustedTotalUsd !== null ? adjustedTotalUsd : completedSale.total;
        const finalTotalBs = adjustedTotalBs !== null ? adjustedTotalBs : (completedSale.total * effectiveReceiptRate);
        const originalSubtotalUsd = completedSale.subtotal;
        const originalSubtotalBs = completedSale.subtotal * effectiveReceiptRate;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="text-center pb-3 border-b border-slate-100">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">¡Venta Registrada Exitosamente!</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Nota de Entrega: #{completedSale.invoiceNumber}
                </p>
              </div>

              {/* Receipt Ticket Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 space-y-2 select-all">
                <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
                  {posConfig.deliveryNoteShowBusinessName && (
                    <div className="font-bold text-sm text-slate-900 tracking-wider">
                      {(posConfig.businessName || 'NUBLY APP POS').toUpperCase()}
                    </div>
                  )}
                  {posConfig.deliveryNoteShowBusinessRif && posConfig.businessRif && (
                    <div className="text-[11px] text-slate-600 font-bold">RIF: {posConfig.businessRif}</div>
                  )}
                  {posConfig.deliveryNoteShowBusinessPhone && posConfig.businessPhone && (
                    <div className="text-[11px] text-slate-600 font-bold">Tel: {posConfig.businessPhone}</div>
                  )}
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Nota de Entrega • Comprobante No Fiscal
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div>Cajero: {completedSale.cashierName || 'Caja 1 - Principal'}</div>
                    {currentUser?.cashRegister && (
                      <div className="font-bold text-amber-700">Origen: Caja #{currentUser.cashRegister}</div>
                    )}
                  </div>
                  <div>Fecha: {new Date(completedSale.createdAt).toLocaleString('es-VE')}</div>
                  {client ? (
                    <>
                      <div className="font-bold text-slate-950">Cliente: {client.name}</div>
                      <div>RIF/Cédula: {client.docType}-{client.docNumber}</div>
                      {client.phone && <div>Teléfono: {client.phone}</div>}
                      {client.notes && <div className="text-[10px] text-slate-500 italic">Notas: {client.notes}</div>}
                    </>
                  ) : (
                    <div>Cliente: Contado / Cliente General</div>
                  )}
                </div>

                {/* Items */}
                <div className="py-1 border-b border-dashed border-slate-300 space-y-2 max-h-40 overflow-y-auto">
                  {completedSale.items.map((item, idx) => {
                    const itemUnitBs = item.unitPrice * effectiveReceiptRate;
                    const itemSubBs = item.subtotal * effectiveReceiptRate;

                    return (
                      <div key={`receipt-item-${item.id || item.productId || idx}-${idx}`} className="space-y-0.5">
                        <div className="flex justify-between font-semibold">
                          <span>{item.quantity}x {item.productName}</span>
                          {currencyMode === 'BS' ? (
                            <span>Bs. {itemSubBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : currencyMode === 'USD' ? (
                            <span>${item.subtotal.toFixed(2)}</span>
                          ) : (
                            <span>Bs. {itemSubBs.toFixed(2)} (${item.subtotal.toFixed(2)})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 pl-3">
                          {currencyMode === 'BS' ? (
                            <span>SKU: {item.productBarcode || 'N/A'} • Unit: Bs. {itemUnitBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : currencyMode === 'USD' ? (
                            <span>SKU: {item.productBarcode || 'N/A'} • Unit: ${item.unitPrice.toFixed(2)}</span>
                          ) : (
                            <span>SKU: {item.productBarcode || 'N/A'} • Unit: Bs. {itemUnitBs.toFixed(2)} (${item.unitPrice.toFixed(2)})</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal & BCV Rate */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal Original:</span>
                    {currencyMode === 'BS' ? (
                      <span>Bs. {originalSubtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    ) : currencyMode === 'USD' ? (
                      <span>${originalSubtotalUsd.toFixed(2)} USD</span>
                    ) : (
                      <span>Bs. {originalSubtotalBs.toFixed(2)} (${originalSubtotalUsd.toFixed(2)} USD)</span>
                    )}
                  </div>

                  {discount && discount.amount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold bg-emerald-50/50 p-1 rounded">
                      <span>Descuento ({discount.description || 'General'}):</span>
                      <span>
                        {discount.type === 'USD' 
                          ? (currencyMode === 'BS' ? `-Bs. ${(discount.amount * effectiveReceiptRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (-$${discount.amount.toFixed(2)})` : `-$${discount.amount.toFixed(2)} USD`)
                          : `-Bs. ${discount.amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  )}

                  {charge && charge.amount > 0 && (
                    <div className="flex justify-between text-amber-600 font-bold bg-amber-50/50 p-1 rounded">
                      <span>Cargo Extra ({charge.description || 'Adicional'}):</span>
                      <span>
                        {charge.type === 'USD' 
                          ? (currencyMode === 'BS' ? `+Bs. ${(charge.amount * effectiveReceiptRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+$${charge.amount.toFixed(2)})` : `+$${charge.amount.toFixed(2)} USD`)
                          : `+Bs. ${charge.amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  )}

                  {posConfig.deliveryNoteShowBcvRate && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tasa BCV Aplicada:</span>
                      <span>Bs. {effectiveReceiptRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/USD</span>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5 font-bold">
                  {currencyMode === 'BS' ? (
                    <>
                      <div className="flex justify-between text-blue-700 text-sm">
                        <span>TOTAL EN BOLÍVARES:</span>
                        <span>Bs. {finalTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] font-normal">
                        <span>Referencia en Dólares ($):</span>
                        <span>${finalTotalUsd.toFixed(2)} USD</span>
                      </div>
                    </>
                  ) : currencyMode === 'USD' ? (
                    <>
                      <div className="flex justify-between text-slate-900 text-sm">
                        <span>TOTAL EN DÓLARES:</span>
                        <span>${finalTotalUsd.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] font-normal">
                        <span>Referencia en Bolívares (Bs.):</span>
                        <span>Bs. {finalTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-900">
                        <span>TOTAL EN DÓLARES:</span>
                        <span>${finalTotalUsd.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between text-blue-700">
                        <span>TOTAL EN BOLÍVARES:</span>
                        <span>Bs. {finalTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Payment Methods */}
                {posConfig.deliveryNoteShowPaymentMethod && (
                  <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                    <div className="font-bold text-slate-900">MÉTODO DE PAGO:</div>
                    <div className="pl-2 space-y-1">
                      <div className="flex justify-between font-medium">
                        <span>• {completedSale.paymentMethod === 'DEBIT_CARD' ? 'Tarjeta Débito (Punto)' :
                                 completedSale.paymentMethod === 'PAGO_MOVIL' ? 'Pago Móvil (Bs)' :
                                 completedSale.paymentMethod === 'CASH_USD' ? 'Efectivo USD ($)' :
                                 completedSale.paymentMethod === 'CASH_BS' ? 'Efectivo Bolívares (Bs)' :
                                 completedSale.paymentMethod === 'BINANCE' ? 'Binance Pay (USDT)' :
                                 completedSale.paymentMethod === 'CREDIT' ? 'Crédito' :
                                 completedSale.paymentMethod === 'SPLIT' ? 'Pago Mixto' :
                                 completedSale.paymentMethod}:</span>
                        <span>
                          {currencyMode === 'BS' 
                            ? `Bs. ${finalTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `$${finalTotalUsd.toFixed(2)} USD`}
                        </span>
                      </div>

                      {/* Rule: Explicitly state USD / USDT payments and received amount in $ */}
                      {completedSale.paymentMethod === 'CASH_USD' && (
                        <div className="p-1.5 bg-emerald-50 rounded text-emerald-800 font-bold text-[11px] border border-emerald-200">
                          <div>💵 PAGO RECIBIDO EN DIVISA EN EFECTIVO ($):</div>
                          <div className="text-right font-mono text-xs">${finalTotalUsd.toFixed(2)} USD recibidos</div>
                        </div>
                      )}

                      {completedSale.paymentMethod === 'BINANCE' && (
                        <div className="p-1.5 bg-amber-50 rounded text-amber-900 font-bold text-[11px] border border-amber-200">
                          <div>🪙 PAGO RECIBIDO EN CRIPTOACTIVO (BINANCE PAY):</div>
                          <div className="text-right font-mono text-xs">${finalTotalUsd.toFixed(2)} USDT recibidos</div>
                        </div>
                      )}

                      {pagoMovil && (
                        <div className="text-[11px] text-slate-600 font-bold pl-3 space-y-0.5">
                          {pagoMovil.emisorBank && <div>Emisor: {pagoMovil.emisorBank}</div>}
                          {pagoMovil.accountType && <div>Cuenta: {pagoMovil.accountType === 'PERSONAL' ? 'Personal' : 'Jurídica'}</div>}
                        </div>
                      )}
                      
                      {reference && (
                        <div className="text-[11px] text-slate-500 pl-3 break-all">
                          Nro. Ref / Aprobación: {reference}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 pt-1 text-center text-[10px] text-slate-400">
                  --------------------------------------------------
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => printSaleReceipt(completedSale, bcvRate)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="F2 para Imprimir"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Ticket (F2)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedSale(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold transition-colors cursor-pointer shadow-sm shadow-blue-500/20"
                  title="F1 para Nueva Venta"
                >
                  <span>Nueva Venta (F1)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PHOTO UPLOAD MODAL */}
      <PhotoUploadModal
        product={photoModalProduct}
        isOpen={isPhotoModalOpen}
        onClose={() => {
          setIsPhotoModalOpen(false);
          setPhotoModalProduct(null);
        }}
        onPhotoSaved={(updatedProduct) => {
          onRefreshProducts();
        }}
      />

      {/* VARIABLE PRICE (OPEN PRICE) MODAL */}
      {openPriceProduct && (() => {
        const product = openPriceProduct;
        const currency = product.variablePriceCurrency || 'USD';
        const emoji = getProductEmoji(product);
        
        return (
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  {emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white uppercase">
                      Precio Variable
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      en {currency === 'USD' ? 'Dólares ($)' : 'Bolívares (Bs.)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block ml-1">
                  Ingrese el precio de venta ({currency}):
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-600 text-lg">
                    {currency === 'USD' ? '$' : 'Bs.'}
                  </div>
                  <input
                    ref={openPriceInputRef}
                    type="number"
                    step="0.01"
                    value={openPriceInputValue}
                    onChange={(e) => setOpenPriceInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && openPriceInputValue) {
                        handleConfirmOpenPrice(product, parseFloat(openPriceInputValue));
                      } else if (e.key === 'Escape') {
                        setOpenPriceProduct(null);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white border border-slate-200 shrink-0">
                  <Tag className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Este producto no tiene un precio fijo. El monto ingresado será {currency === 'BS' ? 'convertido a dólares y' : ''} cargado al carrito.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpenPriceProduct(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  disabled={!openPriceInputValue || parseFloat(openPriceInputValue) <= 0}
                  onClick={() => handleConfirmOpenPrice(product, parseFloat(openPriceInputValue))}
                  className="flex-[1.5] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black transition-all shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* HELD CARTS (CARRITOS EN ESPERA 0, 1, 2...) MODAL */}
      <HeldCartsModal
        isOpen={isHeldCartsModalOpen}
        onClose={() => setIsHeldCartsModalOpen(false)}
        heldCarts={heldCarts}
        bcvRate={bcvRate}
        onLoadCart={handleLoadHeldCart}
        onDeleteCart={handleDeleteHeldCart}
        onClearAll={handleClearAllHeldCarts}
        hasActiveCartItems={cart.length > 0}
      />

      {/* QUANTITY SELECTOR MODAL */}
      {quantityModalProduct && (() => {
        const product = quantityModalProduct;
        const emoji = getProductEmoji(product);
        const itemTotal = product.price * quantityModalValue;
        const itemTotalBs = itemTotal * bcvRate;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-5 text-center">
              
              {/* Product Info Header */}
              <div className="space-y-2">
                <span className="text-5xl block select-none filter drop-shadow-sm">{emoji}</span>
                <h4 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h4>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-mono">
                  <span>Código:</span>
                  <span className="font-bold">{product.barcode}</span>
                </div>
              </div>

              {/* Stock Status Banner */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>Stock Disponible:</span>
                <span className="font-extrabold text-slate-900 font-mono">
                  {product.stock} {product.unit}
                </span>
              </div>

              {/* Huge Quantity Selector Control */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Cantidad a Agregar
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setQuantityModalValue((v) => Math.max(1, v - 1))}
                    disabled={quantityModalValue <= 1}
                    className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xl font-bold flex items-center justify-center select-none active:scale-95 cursor-pointer transition-all"
                  >
                    -
                  </button>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min={1}
                    max={product.stock}
                    value={quantityModalValue}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0) {
                        setQuantityModalValue(Math.min(product.stock, v));
                      }
                    }}
                    className="w-24 text-center font-black text-3xl text-slate-900 border-b-2 border-slate-200 focus:border-blue-600 focus:outline-none py-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantityModalValue((v) => Math.min(product.stock, v + 1))}
                    disabled={quantityModalValue >= product.stock}
                    className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xl font-bold flex items-center justify-center select-none active:scale-95 cursor-pointer transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Live Subtotal Preview */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3.5 space-y-0.5">
                <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-wider">
                  Monto de esta Línea
                </span>
                <div className="text-xl font-black text-blue-900 font-mono">
                  ${itemTotal.toFixed(2)}
                </div>
                <div className="text-[11px] text-blue-700 font-mono font-medium">
                  Bs. {itemTotalBs.toFixed(2)}
                </div>
              </div>

              {/* Keyboard Cheat Sheet */}
              <div className="text-[9px] text-slate-400 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                <div className="flex justify-between">
                  <span>Flechas <strong>↑↓ / ←→</strong></span>
                  <span>Sumar / Restar</span>
                </div>
                <div className="flex justify-between">
                  <span>Tecla <strong>Enter</strong></span>
                  <span>Escribir / Confirmar</span>
                </div>
                <div className="flex justify-between">
                  <span>Tecla <strong>Esc</strong></span>
                  <span>Cancelar</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setQuantityModalProduct(null);
                    setQuantityModalPriceOverride(undefined);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitProductToCart(product, quantityModalValue, quantityModalPriceOverride);
                    setQuantityModalProduct(null);
                    setQuantityModalPriceOverride(undefined);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  Confirmar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MEASUREMENT QUANTITY MODAL (Weight, Length, Volume) */}
      <MeasurementQuantityModal
        product={measurementModalProduct}
        initialQuantity={measurementModalInitialQty}
        isOpen={!!measurementModalProduct}
        bcvRate={bcvRate}
        priceOverride={quantityModalPriceOverride}
        onClose={() => {
          setMeasurementModalProduct(null);
          setQuantityModalPriceOverride(undefined);
        }}
        onConfirm={(baseQty) => {
          if (measurementModalProduct) {
            handleConfirmMeasurement(measurementModalProduct, baseQty);
          }
        }}
      />

      {/* PRODUCT PRESENTATION MODAL (Caja, Sixpack, Bulto, Combo, Custom) */}
      <ProductPresentationModal
        product={presentationModalProduct}
        bcvRate={bcvRate}
        onClose={() => setPresentationModalProduct(null)}
        onSelectPresentation={(presentation) => {
          if (presentationModalProduct) {
            handleSelectPresentationPackage(presentationModalProduct, presentation);
            setPresentationModalProduct(null);
          }
        }}
        onSelectUnit={() => {
          if (presentationModalProduct) {
            handleSelectBaseUnitFromPresentationModal(presentationModalProduct);
            setPresentationModalProduct(null);
          }
        }}
      />

      {/* WHOLESALE PASSWORD AUTHORIZATION MODAL */}
      {wholesaleModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Autorización de Precio al Mayor</h3>
                  <p className="text-[11px] text-slate-500">Supervisión requerida para aplicar tarifa mayorista</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWholesaleModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyWholesalePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ingrese clave o escanee código de barras de supervisor:
                </label>
                <input
                  ref={wholesaleInputRef}
                  type="password"
                  value={wholesalePasswordInput}
                  onChange={(e) => setWholesalePasswordInput(e.target.value)}
                  placeholder="Escanee con lector o teclee clave (def: 1234)..."
                  autoFocus
                  className="w-full bg-slate-50 border border-purple-300 focus:border-purple-600 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {wholesaleAuthError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{wholesaleAuthError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWholesaleModalItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Autorizar y Aplicar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION SECURITY MODAL FOR OPENING A SHIFT */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <Zap className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                ¿Seguro que quieres abrir turno?
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Al abrir un turno, la caja registrará todas las operaciones de venta y métodos de pago a su nombre.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs text-slate-600 space-y-1 font-medium">
              <div className="flex justify-between">
                <span>Cajero:</span>
                <span className="font-bold text-slate-900">{cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Tasa Oficial BCV:</span>
                <span className="font-bold font-mono text-blue-700">Bs. {bcvRate.toFixed(2)} / $</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmOpenShift}
                disabled={isOpeningShift}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                {isOpeningShift ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sí</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST FEEDBACK FOR HELD TICKETS */}
      {heldToastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs font-semibold">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{heldToastMessage}</span>
          <button
            type="button"
            onClick={() => setHeldToastMessage(null)}
            className="text-slate-400 hover:text-white ml-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MODAL DE COMBOS Y PAQUETES PROMOCIONALES */}
      <PosCombosModal
        isOpen={isCombosModalOpen}
        onClose={() => setIsCombosModalOpen(false)}
        products={products}
        bcvRate={bcvRate}
        onAddFixedComboToCart={handleAddFixedComboToCart}
        onOpenSelectableModal={(combo) => {
          setSelectableComboToPick(combo);
        }}
      />

      {/* MODAL DE SELECCIÓN DE VARIEDAD PARA COMBOS PERSONALIZABLES (EJ. 5 CERVEZAS A ESCOGER) */}
      <PosSelectableComboModal
        isOpen={Boolean(selectableComboToPick)}
        combo={selectableComboToPick}
        allProducts={products}
        bcvRate={bcvRate}
        onClose={() => setSelectableComboToPick(null)}
        onConfirm={handleConfirmSelectableCombo}
      />
      {/* MODAL DE SELECCIÓN Y COBRO DE ENVASES Y TOBOS PARA EL CARRITO */}
      {isContainersModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center font-bold text-lg">
                  🪣
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Añadir Tobos y Envases Retornables al Carrito
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cobro de garantías, depósitos o alquiler de tobos y botellas para la venta actual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContainersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* SECCIÓN 1: TOBOS DE CERVEZA (BEER BUCKETS) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>🪣 Tobos y Baldes de Cerveza</span>
                <span className="text-[10px] text-purple-700 font-mono bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  Garantías & Depósitos
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getBeerBuckets().map((b) => (
                  <div
                    key={`bucket-pos-${b.id}`}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-purple-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs">{b.name}</div>
                        <div className="text-[10px] text-slate-500">{b.brand} • {b.color}</div>
                      </div>
                      <span className="text-xs font-black font-mono text-purple-900 bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200 shrink-0">
                        ${b.depositPrice.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleAddContainerToCart(`Tobo ${b.name} (Garantía)`, b.depositPrice, `TOBO-${b.id}`);
                        showHeldToast(`Tobo "${b.name}" añadido al carrito ($${b.depositPrice.toFixed(2)} USD).`);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Añadir Tobo al Ticket</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 2: BOTELLAS RETORNABLES */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Wine className="w-4 h-4 text-amber-600" />
                <span>🍾 Cobro de Envases / Botellas Vacías</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products
                  .filter((p) => getProductReturnableConfig(p).hasReturnableBottle)
                  .map((p) => {
                    const conf = getProductReturnableConfig(p);
                    const deposit = conf.bottleDepositPrice || 0.50;
                    return (
                      <div
                        key={`bottle-pos-${p.id}`}
                        className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200 hover:border-amber-300 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs">{p.name}</div>
                            <div className="text-[10px] text-amber-900 font-medium">
                              {conf.bottleName || 'Botella Retornable'}
                            </div>
                          </div>
                          <span className="text-xs font-black font-mono text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300 shrink-0">
                            ${deposit.toFixed(2)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleAddContainerToCart(`Cobro Envase: ${conf.bottleName || p.name}`, deposit, `ENV-${p.barcode}`);
                            showHeldToast(`Envase para "${p.name}" añadido al carrito ($${deposit.toFixed(2)} USD).`);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Añadir Cobro de Envase</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* SECCIÓN 3: MONTO LIBRE DE GARANTÍA DE ENVASE */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                ⚙️ Cargo o Garantía de Envase Personalizado
              </h4>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customContainerTitle}
                  onChange={(e) => setCustomContainerTitle(e.target.value)}
                  placeholder="Nombre de la garantía o envase..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
                <input
                  type="number"
                  step="0.25"
                  min="0.1"
                  value={customContainerPrice}
                  onChange={(e) => setCustomContainerPrice(e.target.value)}
                  placeholder="0.00 $"
                  className="w-24 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const price = parseFloat(customContainerPrice) || 1.0;
                    const title = customContainerTitle.trim() || 'Garantía de Envase';
                    handleAddContainerToCart(title, price, `ENV-CUSTOM-${Date.now()}`);
                    showHeldToast(`"${title}" añadido al carrito ($${price.toFixed(2)} USD).`);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  + Agregar
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsContainersModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
