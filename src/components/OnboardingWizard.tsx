import React, { useState } from 'react';
import { 
  Building2, 
  Printer, 
  DollarSign, 
  FileText, 
  ShieldCheck, 
  Users, 
  Cpu, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  AlertTriangle, 
  Info, 
  Plus, 
  Trash2, 
  Lock, 
  CheckCircle2, 
  Zap, 
  Eye, 
  EyeOff,
  User as UserIcon,
  Play
} from 'lucide-react';
import { POSConfig, Client } from '../types';
import { DEFAULT_POS_CONFIG, savePOSConfig } from '../utils/configHelper';
import { saveSystemModulesToBackend, OPTIONAL_MODULE_IDS } from '../utils/systemModules';
import { safeFetchJson } from '../utils/api';

interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  // Slide state: 0 to 5 are Welcome Slides, 6+ are Config Steps
  const [slide, setSlide] = useState<number>(0);
  
  // Local wizard-scoped configurations (loaded with factory defaults)
  const [businessName, setBusinessName] = useState<string>(DEFAULT_POS_CONFIG.businessName);
  const [businessRif, setBusinessRif] = useState<string>(DEFAULT_POS_CONFIG.businessRif);
  const [businessPhone, setBusinessPhone] = useState<string>(DEFAULT_POS_CONFIG.businessPhone);
  
  // Printer defaults
  const [printerConnectionType, setPrinterConnectionType] = useState<'BLUETOOTH' | 'PLUGIN_HTTP' | 'EPSON_EPOS' | 'WEB_USB' | 'SYSTEM_PRINT'>(
    DEFAULT_POS_CONFIG.printerConnectionType || 'SYSTEM_PRINT'
  );
  const [printerEnabled, setPrinterEnabled] = useState<boolean>(DEFAULT_POS_CONFIG.printerEnabled);
  const [printerAutoPrint, setPrinterAutoPrint] = useState<boolean>(DEFAULT_POS_CONFIG.printerAutoPrint);
  const [printerAutoCut, setPrinterAutoCut] = useState<boolean>(DEFAULT_POS_CONFIG.printerAutoCut ?? true);
  const [printerPaperWidth, setPrinterPaperWidth] = useState<'58mm' | '80mm'>(DEFAULT_POS_CONFIG.printerPaperWidth);
  const [printerName, setPrinterName] = useState<string>(DEFAULT_POS_CONFIG.printerName);
  const [printerPluginUrl, setPrinterPluginUrl] = useState<string>(DEFAULT_POS_CONFIG.printerPluginUrl);

  // References validation
  const [debitCardRefRequired, setDebitCardRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.debitCardRefRequired);
  const [pagoMovilRefRequired, setPagoMovilRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.pagoMovilRefRequired);
  const [cashBsRefRequired, setCashBsRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.cashBsRefRequired);
  const [cashUsdRefRequired, setCashUsdRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.cashUsdRefRequired);
  const [binanceRefRequired, setBinanceRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.binanceRefRequired);
  const [creditRefRequired, setCreditRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.creditRefRequired);
  const [splitRefRequired, setSplitRefRequired] = useState<boolean>(DEFAULT_POS_CONFIG.splitRefRequired);

  // Billing customization
  const [useClientData, setUseClientData] = useState<boolean>(DEFAULT_POS_CONFIG.useClientData);
  const [showClientName, setShowClientName] = useState<boolean>(DEFAULT_POS_CONFIG.showClientName ?? true);
  const [clientNameRequired, setClientNameRequired] = useState<boolean>(DEFAULT_POS_CONFIG.clientNameRequired);
  const [showClientRif, setShowClientRif] = useState<boolean>(DEFAULT_POS_CONFIG.showClientRif ?? true);
  const [clientRifRequired, setClientRifRequired] = useState<boolean>(DEFAULT_POS_CONFIG.clientRifRequired);
  const [showClientPhone, setShowClientPhone] = useState<boolean>(DEFAULT_POS_CONFIG.showClientPhone ?? true);
  const [clientPhoneRequired, setClientPhoneRequired] = useState<boolean>(DEFAULT_POS_CONFIG.clientPhoneRequired);
  const [showClientNotes, setShowClientNotes] = useState<boolean>(DEFAULT_POS_CONFIG.showClientNotes ?? true);
  const [clientNotesRequired, setClientNotesRequired] = useState<boolean>(DEFAULT_POS_CONFIG.clientNotesRequired ?? false);

  // Pago Movil details
  const [pagoMovilBankName, setPagoMovilBankName] = useState<string>(DEFAULT_POS_CONFIG.pagoMovilBankName);
  const [pagoMovilPhone, setPagoMovilPhone] = useState<string>(DEFAULT_POS_CONFIG.pagoMovilPhone);
  const [pagoMovilRif, setPagoMovilRif] = useState<string>(DEFAULT_POS_CONFIG.pagoMovilRif);
  const [pagoMovilShowBank, setPagoMovilShowBank] = useState<boolean>(DEFAULT_POS_CONFIG.pagoMovilShowBank ?? true);
  const [pagoMovilShowAccountType, setPagoMovilShowAccountType] = useState<boolean>(DEFAULT_POS_CONFIG.pagoMovilShowAccountType ?? true);

  // Currency & Display defaults
  const [deliveryNotePriceCurrency, setDeliveryNotePriceCurrency] = useState<'USD' | 'BS' | 'BOTH'>(DEFAULT_POS_CONFIG.deliveryNotePriceCurrency || 'BS');
  const [askQuantityInPos, setAskQuantityInPos] = useState<boolean>(DEFAULT_POS_CONFIG.askQuantityInPos || false);
  const [enableScaleEan13, setEnableScaleEan13] = useState<boolean>(DEFAULT_POS_CONFIG.enableScaleEan13 || false);
  const [showPopularProducts, setShowPopularProducts] = useState<boolean>(DEFAULT_POS_CONFIG.showPopularProducts ?? true);
  const [enableDiscountsAndCharges, setEnableDiscountsAndCharges] = useState<boolean>(DEFAULT_POS_CONFIG.enableDiscountsAndCharges ?? true);
  const [hideProductPhotosAndEmojis, setHideProductPhotosAndEmojis] = useState<boolean>(DEFAULT_POS_CONFIG.hideProductPhotosAndEmojis ?? false);

  // Security authorization passwords
  const [wholesalePassword, setWholesalePassword] = useState<string>(DEFAULT_POS_CONFIG.wholesalePassword || '1234');
  const [outflowPassword, setOutflowPassword] = useState<string>(DEFAULT_POS_CONFIG.outflowPassword || '1234');
  const [voidSalePassword, setVoidSalePassword] = useState<string>(DEFAULT_POS_CONFIG.voidSalePassword || '1234');

  // Delivery note printed fields
  const [deliveryNoteShowBusinessName, setDeliveryNoteShowBusinessName] = useState<boolean>(DEFAULT_POS_CONFIG.deliveryNoteShowBusinessName);
  const [deliveryNoteShowBusinessRif, setDeliveryNoteShowBusinessRif] = useState<boolean>(DEFAULT_POS_CONFIG.deliveryNoteShowBusinessRif);
  const [deliveryNoteShowBusinessPhone, setDeliveryNoteShowBusinessPhone] = useState<boolean>(DEFAULT_POS_CONFIG.deliveryNoteShowBusinessPhone);
  const [deliveryNoteShowBcvRate, setDeliveryNoteShowBcvRate] = useState<boolean>(DEFAULT_POS_CONFIG.deliveryNoteShowBcvRate);
  const [deliveryNoteShowPaymentMethod, setDeliveryNoteShowPaymentMethod] = useState<boolean>(DEFAULT_POS_CONFIG.deliveryNoteShowPaymentMethod);

  // Departments (Sidebar Categories)
  const [sidebarCategories, setSidebarCategories] = useState<any[]>(DEFAULT_POS_CONFIG.sidebarCategories || [
    { id: 'cat-sales', name: 'Ventas y Caja', itemIds: ['pos', 'combos', 'shifts', 'sales', 'cxc', 'rates'] },
    { id: 'cat-inventory', name: 'Inventario y Almacén', itemIds: ['inventory', 'kardex', 'audits', 'alerts'] },
    { id: 'cat-admin', name: 'Administración', itemIds: ['dashboard', 'cxp', 'clients', 'config'] },
    { id: 'cat-dev', name: 'Desarrollo y Pruebas', itemIds: ['concurrency', 'architecture'] }
  ]);

  // User list to create at Step 10
  const [usersToCreate, setUsersToCreate] = useState<any[]>([
    { 
      username: 'admin', 
      password: 'admin_password', 
      name: 'Administrador General', 
      role: 'Administrador',
      imageUrl: '',
      allowedDepartments: ['all'],
      allowedFunctions: ['all'],
      canConfigurePrinters: true,
      canModifyManualRate: true,
      canViewOtherShifts: true,
      canViewAllSales: true,
      dashboardType: 'ADMIN',
      canRegisterExpenses: true,
      canApplyDiscountOrSurcharge: true,
      canSellOnCredit: true,
      canVoidSales: true
    }
  ]);
  const [newUserUsername, setNewUserUsername] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'Administrador' | 'Supervisor' | 'Cajero'>('Cajero');
  const [newUserImageUrl, setNewUserImageUrl] = useState<string>('');
  const [newUserAllowedDepartments, setNewUserAllowedDepartments] = useState<string[]>([]);
  const [newUserAllowedFunctions, setNewUserAllowedFunctions] = useState<string[]>([]);
  const [newUserCanViewOtherShifts, setNewUserCanViewOtherShifts] = useState<boolean>(false);
  const [newUserCanViewAllSales, setNewUserCanViewAllSales] = useState<boolean>(false);
  const [newUserCanRegisterExpenses, setNewUserCanRegisterExpenses] = useState<boolean>(false);
  const [newUserCanApplyDiscountOrSurcharge, setNewUserCanApplyDiscountOrSurcharge] = useState<boolean>(true);
  const [newUserCanSellOnCredit, setNewUserCanSellOnCredit] = useState<boolean>(true);
  const [newUserCanVoidSales, setNewUserCanVoidSales] = useState<boolean>(true);
  const [newUserCanConfigurePrinters, setNewUserCanConfigurePrinters] = useState<boolean>(true);
  const [newUserCanModifyManualRate, setNewUserCanModifyManualRate] = useState<boolean>(true);
  const [newUserDashboardType, setNewUserDashboardType] = useState<'ADMIN' | 'CAJERO'>('CAJERO');
  const [newUserCashRegister, setNewUserCashRegister] = useState<string>('');
  
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [showAddUserPanel, setShowAddUserPanel] = useState<boolean>(false);
  const [showPermissionsPanel, setShowPermissionsPanel] = useState<boolean>(false);

  // Module configuration
  const [enabledModules, setEnabledModules] = useState<string[]>([...OPTIONAL_MODULE_IDS]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFinishing, setIsSaving] = useState<boolean>(false);

  const userFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUserPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es demasiado grande (máx 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setNewUserImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Helper to add users to custom collection
  const handleAddUser = () => {
    if (!newUserUsername.trim() || !newUserPassword || !newUserName.trim()) {
      alert('Por favor complete todos los datos del usuario.');
      return;
    }
    const usernameClean = newUserUsername.trim().toLowerCase();
    if (usersToCreate.some(u => u.username === usernameClean)) {
      alert('Este usuario ya se encuentra registrado en el listado.');
      return;
    }
    setUsersToCreate([...usersToCreate, {
      username: usernameClean,
      password: newUserPassword,
      name: newUserName.trim(),
      role: newUserRole
    }]);
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserName('');
    setNewUserRole('Cajero');
  };

  const handleRemoveUser = (index: number) => {
    const list = [...usersToCreate];
    if (list[index].username === 'admin') {
      alert('La cuenta de Administrador Principal ("admin") es obligatoria y no puede ser removida.');
      return;
    }
    list.splice(index, 1);
    setUsersToCreate(list);
  };

  // Move slide forwards with validations
  const handleNextSlide = () => {
    setErrorMsg(null);

    // Slide 6 is Step 1: Company details validation
    if (slide === 6) {
      if (!businessName.trim()) {
        setErrorMsg('El Nombre de la Empresa o Negocio es obligatorio para continuar.');
        return;
      }
    }

    // Step 5: Pago Movil fields validation
    if (slide === 10) {
      if (!pagoMovilBankName.trim() || !pagoMovilPhone.trim() || !pagoMovilRif.trim()) {
        setErrorMsg('Todos los campos del Pago Móvil Receptor son obligatorios para continuar.');
        return;
      }
    }

    // Step 9: Passwords validation (Moved to slide 15 because of new step)
    if (slide === 15) {
      const adminAcc = usersToCreate.find(u => u.username === 'admin');
      if (!adminAcc || !adminAcc.password || adminAcc.password.trim() === 'admin_password') {
        setErrorMsg('Por favor configure una contraseña real y segura para la cuenta "admin" principal.');
        return;
      }
    }

    setSlide(prev => prev + 1);
  };

  const handlePrevSlide = () => {
    setErrorMsg(null);
    setSlide(prev => Math.max(0, prev - 1));
  };

  // Complete onboarding installation flow and persist structures
  const handleFinishInstallation = async () => {
    setIsSaving(true);
    setErrorMsg(null);

    try {
      // 1. Build and compile final POS Config structure
      const finalConfig: POSConfig = {
        businessName: businessName.trim(),
        businessRif: businessRif.trim(),
        businessPhone: businessPhone.trim(),
        deliveryNoteShowBusinessName,
        deliveryNoteShowBusinessRif,
        deliveryNoteShowBusinessPhone,
        deliveryNotePriceCurrency,
        deliveryNoteDisclaimerAccepted: true,
        deliveryNoteShowBcvRate,
        deliveryNoteShowPaymentMethod,
        debitCardRefRequired,
        pagoMovilRefRequired,
        cashBsRefRequired,
        cashUsdRefRequired,
        binanceRefRequired,
        creditRefRequired,
        splitRefRequired,
        useClientData,
        showClientName,
        clientNameRequired,
        showClientRif,
        clientRifRequired,
        showClientPhone,
        clientPhoneRequired,
        showClientNotes,
        clientNotesRequired,
        enablePOSContainerCharges: enabledModules.includes('envases'),
        enableContainerLoans: enabledModules.includes('envases'),
        enableScaleEan13,
        askQuantityInPos,
        showPopularProducts,
        enableDiscountsAndCharges,
        hideProductPhotosAndEmojis,
        pagoMovilBankName: pagoMovilBankName.trim(),
        pagoMovilPhone: pagoMovilPhone.trim(),
        pagoMovilRif: pagoMovilRif.trim(),
        pagoMovilShowBank,
        pagoMovilShowAccountType,
        wholesalePassword: wholesalePassword.trim(),
        outflowPassword: outflowPassword.trim(),
        voidSalePassword: voidSalePassword.trim(),
        printerConnectionType,
        printerEnabled,
        printerAutoPrint,
        printerAutoCut,
        printerPaperWidth,
        printerName,
        printerPluginUrl,
        printerEpsonIp: '192.168.1.100',
        printerEpsonPort: '8008',
        btDeviceName: '',
        btDeviceId: '',
        sidebarCategories: sidebarCategories,
        darkMode: false
      };

      // 2. Persist to localStorage client cache
      savePOSConfig(finalConfig);

      // 3. Persist enabled modules to Server DB configuration (zero data-loss guarantees)
      const moduleResult = await saveSystemModulesToBackend(enabledModules);
      if (!moduleResult.success) {
        throw new Error(moduleResult.error || 'No se pudo guardar la configuración modular.');
      }

      // 4. Create all configured user accounts on database
      for (const u of usersToCreate) {
        // Since we can have a seeded "admin" user, we attempt to create or overwrite it smoothly.
        const userRes = await safeFetchJson<any>('/api/auth/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: u.username,
            password: u.password,
            name: u.name,
            role: u.role,
            imageUrl: u.imageUrl,
            allowedDepartments: u.allowedDepartments,
            allowedFunctions: u.allowedFunctions,
            canConfigurePrinters: u.canConfigurePrinters,
            canModifyManualRate: u.canModifyManualRate,
            cashRegister: u.cashRegister,
            canViewOtherShifts: u.canViewOtherShifts,
            canViewAllSales: u.canViewAllSales,
            dashboardType: u.dashboardType,
            canRegisterExpenses: u.canRegisterExpenses,
            canApplyDiscountOrSurcharge: u.canApplyDiscountOrSurcharge,
            canSellOnCredit: u.canSellOnCredit,
            canVoidSales: u.canVoidSales,
          })
        });

        // If it is 'admin' and failed because of 'already exists', we update the seeded admin's password!
        if (!userRes.ok && u.username === 'admin') {
          const listRes = await safeFetchJson<any>('/api/auth/users');
          if (listRes.ok && Array.isArray(listRes.data?.users)) {
            const serverAdmin = listRes.data.users.find((su: any) => su.username === 'admin');
            if (serverAdmin) {
              await safeFetchJson<any>(`/api/auth/users/${serverAdmin.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: u.name,
                  password: u.password,
                  role: u.role,
                  imageUrl: u.imageUrl,
                  allowedDepartments: u.allowedDepartments,
                  allowedFunctions: u.allowedFunctions,
                  canConfigurePrinters: u.canConfigurePrinters,
                  canModifyManualRate: u.canModifyManualRate,
                  cashRegister: u.cashRegister,
                  canViewOtherShifts: u.canViewOtherShifts,
                  canViewAllSales: u.canViewAllSales,
                  dashboardType: u.dashboardType,
                  canRegisterExpenses: u.canRegisterExpenses,
                  canApplyDiscountOrSurcharge: u.canApplyDiscountOrSurcharge,
                  canSellOnCredit: u.canSellOnCredit,
                  canVoidSales: u.canVoidSales,
                })
              });
            }
          }
        }
      }

      // Finish setup wizard
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al registrar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 relative overflow-hidden font-sans">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 flex-1 flex flex-col justify-between my-4 z-10">
        
        {/* WIZARD HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-600/10">
              N
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 tracking-tight">NUBLY ERP</h1>
              <p className="text-[10px] text-blue-600 font-bold font-mono tracking-widest uppercase">Asistente de Configuración Inicial</p>
            </div>
          </div>
          
          {slide >= 6 && (
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-blue-600">PASO {slide - 5} DE 11</span>
              <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${((slide - 5) / 11) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* WIZARD CONTENT AREA */}
        <div className="flex-1 flex flex-col justify-center py-4">
          
          {errorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ==================================================================== */}
          {/* WELCOME SLIDES (0 TO 5) */}
          {/* ==================================================================== */}
          
          {/* SLIDE 0: Main Welcome */}
          {slide === 0 && (
            <div className="text-center space-y-6 py-6 animate-fade-in text-wrap">
              <div className="w-24 h-24 bg-blue-50/70 border border-blue-100 rounded-2xl mx-auto flex items-center justify-center p-3 relative shadow-inner">
                <img 
                  src="/images/nubly_logo.jpg" 
                  alt="Nubly Logo" 
                  className="w-16 h-16 object-cover rounded-xl shadow-md border border-white"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -top-2.5 -right-2 bg-emerald-500 text-white rounded-full p-1 border-2 border-white shadow-xs animate-pulse">
                  <Check className="w-2.5 h-2.5" />
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bienvenido a Nubly</h2>
                <p className="text-base text-slate-600 font-semibold max-w-md mx-auto text-wrap">
                  La solución modular diseñada para impulsar la gestión de tu negocio.
                </p>
              </div>
              <p className="text-xs text-slate-400 font-medium">Configuremos tu espacio comercial en un instante.</p>
            </div>
          )}

          {/* SLIDE 1: Modular Architecture Explanation */}
          {slide === 1 && (
            <div className="space-y-6 py-6 animate-fade-in">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/10">
                  <Cpu className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900">Tecnología Inteligente Modular</h3>
                  <span className="text-[10px] font-mono bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-300">
                    Zero-Resource Overhead Engine
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium text-wrap">
                Nubly es un sistema de punto de venta y gestión empresarial creado para adaptarse a las necesidades reales de tu negocio. A través de nuestra arquitectura modular inteligente, el sistema se ajusta exactamente a lo que necesitas: activa únicamente los módulos que tu empresa utiliza y mantiene el software ligero, rápido y optimizado, evitando el consumo innecesario de recursos en tu equipo o servidor.
              </p>
            </div>
          )}

          {/* SLIDE 2: Mission & Vision */}
          {slide === 2 && (
            <div className="space-y-6 py-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-2">
                  <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest">Misión</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold text-wrap">
                    Proporcionar a pequeños y medianos comercios una herramienta tecnológica robusta, intuitiva y flexible que simplifique sus operaciones diarias, ventas e inventarios sin complicaciones técnicas.
                  </p>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-2">
                  <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest">Visión</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold text-wrap">
                    Convertirnos en la plataforma de gestión comercial más eficiente y adaptable del mercado, evolucionando constantemente junto a nuestros usuarios mediante actualizaciones continuas y optimización de procesos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: Development Team & Credits */}
          {slide === 3 && (
            <div className="space-y-6 py-6 animate-fade-in text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Desarrollado con dedicación por:</h3>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">🛠️ Equipo de Desarrollo STRATUS ERP</p>
                    <p className="text-xs font-bold text-blue-600">👤 Líder de Proyecto / Desarrollador Principal: Marco Vance</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold text-wrap">
                  Este software está en constante evolución. Seguimos trabajando día a día para integrar mejoras, optimizar el rendimiento y añadir nuevas funcionalidades que hagan crecer tu negocio.
                </p>
              </div>
            </div>
          )}

          {/* SLIDE 4: Installation Process */}
          {slide === 4 && (
            <div className="space-y-6 py-4 animate-fade-in">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-lg font-extrabold text-slate-900">El Proceso de Instalación</h3>
                <p className="text-xs text-slate-500 font-medium">¿Qué haremos a continuación?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">1</div>
                  <h4 className="text-xs font-extrabold text-slate-800">Datos Generales</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Configurar la identidad comercial y de contacto de tu negocio.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">2</div>
                  <h4 className="text-xs font-extrabold text-slate-800">Preferencia Modular</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Elegir qué módulos e integraciones utilizarás para mantener todo rápido.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">3</div>
                  <h4 className="text-xs font-extrabold text-slate-800">Cuentas de Usuarios</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Establecer los accesos del Administrador Principal y cajeros.</p>
                </div>
              </div>

              <p className="text-xs text-center text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold">
                Recuerda que podrás activar o desactivar módulos en cualquier momento desde el panel de configuración.
              </p>
            </div>
          )}

          {/* SLIDE 5: Ready to Start */}
          {slide === 5 && (
            <div className="text-center space-y-6 py-12 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">
                🚀
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">¿Listo para comenzar?</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Presiona el botón "Iniciar Configuración" para empezar a personalizar tu experiencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSlide(6)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-lg shadow-blue-500/20 cursor-pointer transition-colors"
              >
                <span>Iniciar Configuración</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* CONFIGURATION STEPS (6 TO 15) */}
          {/* ==================================================================== */}

          {/* STEP 1: Identidad del Negocio */}
          {slide === 6 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span>Identidad de la Empresa / Negocio</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Datos comerciales impresos en las notas de entrega y reportes.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Nombre de la Empresa o Negocio *</label>
                  <input 
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ej: Bodegón Stratus"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={deliveryNoteShowBusinessName}
                      onChange={(e) => setDeliveryNoteShowBusinessName(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Mostrar en el Ticket</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Número de RIF</label>
                  <input 
                    type="text"
                    value={businessRif}
                    onChange={(e) => setBusinessRif(e.target.value)}
                    placeholder="Ej: J-50123456-7"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={deliveryNoteShowBusinessRif}
                      onChange={(e) => setDeliveryNoteShowBusinessRif(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Mostrar en el Ticket</span>
                  </label>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Teléfono de Contacto</label>
                  <input 
                    type="text"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="Ej: 0412-1234567"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={deliveryNoteShowBusinessPhone}
                      onChange={(e) => setDeliveryNoteShowBusinessPhone(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Mostrar en el Ticket</span>
                  </label>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1">
                <h4 className="text-[11px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Aviso Reglamentario No Fiscal</span>
                </h4>
                <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
                  Las notas de entrega emitidas por Nubly son comprobantes operativos internos y no sustituyen facturas fiscales formales ni usan la palabra factura.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Impresora POS */}
          {slide === 7 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-blue-600" />
                    <span>Configuración de Impresora POS</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Soporte directo para Bluetooth, USB, WiFi, Red y Epson.</p>
                </div>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1 border border-slate-200 cursor-pointer transition-colors"
                >
                  Configurar después
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Método de Conexión</label>
                  <select
                    value={printerConnectionType}
                    onChange={(e) => setPrinterConnectionType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="SYSTEM_PRINT">Llamar diálogo de Windows (Estándar)</option>
                    <option value="PLUGIN_HTTP">Servidor de Impresión Local (Plugin)</option>
                    <option value="EPSON_EPOS">Epson ePOS (Red/WiFi)</option>
                    <option value="BLUETOOTH">Bluetooth Directo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Tamaño del Papel</label>
                  <select
                    value={printerPaperWidth}
                    onChange={(e) => setPrinterPaperWidth(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="58mm">58mm (Estándar Angosto)</option>
                    <option value="80mm">80mm (Ancho de Escritorio)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <input 
                      type="checkbox"
                      checked={printerEnabled}
                      onChange={(e) => setPrinterEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">Habilitar Impresora</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <input 
                      type="checkbox"
                      checked={printerAutoPrint}
                      onChange={(e) => setPrinterAutoPrint(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">Impresión Automática</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <input 
                      type="checkbox"
                      checked={printerAutoCut}
                      onChange={(e) => setPrinterAutoCut(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">Corte Automático</span>
                  </label>
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Detalles del Ticket:</p>
                   <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input 
                          type="checkbox"
                          checked={deliveryNoteShowBcvRate}
                          onChange={(e) => setDeliveryNoteShowBcvRate(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span>Ver Tasa BCV</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input 
                          type="checkbox"
                          checked={deliveryNoteShowPaymentMethod}
                          onChange={(e) => setDeliveryNoteShowPaymentMethod(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span>Ver Método de Pago</span>
                      </label>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Referencias Obligatorias */}
          {slide === 8 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span>Validación de Referencias Obligatorias</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Marque los métodos de pago que requieren obligatoriamente un número de referencia/aprobación.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Pago Móvil</span>
                  <input 
                    type="checkbox"
                    checked={pagoMovilRefRequired}
                    onChange={(e) => setPagoMovilRefRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Tarjeta de Débito (Punto)</span>
                  <input 
                    type="checkbox"
                    checked={debitCardRefRequired}
                    onChange={(e) => setDebitCardRefRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Binance Pay</span>
                  <input 
                    type="checkbox"
                    checked={binanceRefRequired}
                    onChange={(e) => setBinanceRefRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Créditos / Cuentas por Cobrar</span>
                  <input 
                    type="checkbox"
                    checked={creditRefRequired}
                    onChange={(e) => setCreditRefRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none col-span-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Efectivo (Bs. / USD)</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-500 uppercase">
                      <input 
                        type="checkbox"
                        checked={cashBsRefRequired}
                        onChange={(e) => setCashBsRefRequired(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-blue-600"
                      />
                      <span>Bolívares</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-500 uppercase">
                      <input 
                        type="checkbox"
                        checked={cashUsdRefRequired}
                        onChange={(e) => setCashUsdRefRequired(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-blue-600"
                      />
                      <span>Dólares</span>
                    </label>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: Datos de Facturación */}
          {slide === 9 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Datos de Facturación del Cliente</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Determine si solicita datos de clientes al momento de facturar en el POS.</p>
                </div>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1 border border-slate-200 cursor-pointer transition-colors"
                >
                  Omitir paso
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                  <input 
                    type="checkbox"
                    checked={useClientData}
                    onChange={(e) => setUseClientData(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Solicitar datos de cliente en pantalla</span>
                    <span className="text-[10px] text-slate-500 leading-tight block">Abre un panel en el POS para buscar o registrar clientes rápidamente antes de la facturación.</span>
                  </div>
                </label>

                {useClientData && (
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-4 animate-fade-in">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Visibilidad de Campos:</p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <input 
                            type="checkbox"
                            checked={showClientName}
                            onChange={(e) => setShowClientName(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Ver Nombre</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <input 
                            type="checkbox"
                            checked={showClientRif}
                            onChange={(e) => setShowClientRif(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Ver RIF</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <input 
                            type="checkbox"
                            checked={showClientPhone}
                            onChange={(e) => setShowClientPhone(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Ver Teléfono</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <input 
                            type="checkbox"
                            checked={showClientNotes}
                            onChange={(e) => setShowClientNotes(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Ver Notas</span>
                        </label>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campos Obligatorios:</p>
                      <div className="flex flex-wrap gap-4">
                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${!showClientName ? 'opacity-40 pointer-events-none' : 'text-slate-700'}`}>
                          <input 
                            type="checkbox"
                            checked={clientNameRequired}
                            onChange={(e) => setClientNameRequired(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Nombre</span>
                        </label>
                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${!showClientRif ? 'opacity-40 pointer-events-none' : 'text-slate-700'}`}>
                          <input 
                            type="checkbox"
                            checked={clientRifRequired}
                            onChange={(e) => setClientRifRequired(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>RIF</span>
                        </label>
                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${!showClientPhone ? 'opacity-40 pointer-events-none' : 'text-slate-700'}`}>
                          <input 
                            type="checkbox"
                            checked={clientPhoneRequired}
                            onChange={(e) => setClientPhoneRequired(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Teléfono</span>
                        </label>
                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${!showClientNotes ? 'opacity-40 pointer-events-none' : 'text-slate-700'}`}>
                          <input 
                            type="checkbox"
                            checked={clientNotesRequired}
                            onChange={(e) => setClientNotesRequired(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Notas</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Pago Movil Detalles */}
          {slide === 10 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <span>Detalles de Pago Móvil Receptor *</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure la cuenta a la cual transferirán los clientes y que se imprimirá en los tickets.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Banco Destino *</label>
                  <input 
                    type="text"
                    required
                    value={pagoMovilBankName}
                    onChange={(e) => setPagoMovilBankName(e.target.value)}
                    placeholder="Ej: Banco de Venezuela (BDV)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Teléfono Registrado *</label>
                  <input 
                    type="text"
                    required
                    value={pagoMovilPhone}
                    onChange={(e) => setPagoMovilPhone(e.target.value)}
                    placeholder="Ej: 0412-1234567"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">RIF o Cédula del Titular *</label>
                  <input 
                    type="text"
                    required
                    value={pagoMovilRif}
                    onChange={(e) => setPagoMovilRif(e.target.value)}
                    placeholder="Ej: J-12345678-9 o V-12345678"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2.5">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opciones de Impresión en Ticket:</p>
                 <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                      <input 
                        type="checkbox"
                        checked={pagoMovilShowBank}
                        onChange={(e) => setPagoMovilShowBank(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>Ver Banco</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                      <input 
                        type="checkbox"
                        checked={pagoMovilShowAccountType}
                        onChange={(e) => setPagoMovilShowAccountType(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>Ver Tipo de Cuenta</span>
                    </label>
                 </div>
              </div>
            </div>
          )}

          {/* STEP 6: Caja Ajustes */}
          {slide === 11 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <span>Visualización y Ajustes de Caja *</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Parámetros obligatorios de interacción en el Punto de Venta.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Moneda de Visualización Predeterminada</label>
                  <select
                    value={deliveryNotePriceCurrency}
                    onChange={(e) => setDeliveryNotePriceCurrency(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="BS">Bolívares (Bs. - Recomendado)</option>
                    <option value="USD">Dólares ($ USD - Internacional)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={askQuantityInPos}
                      onChange={(e) => setAskQuantityInPos(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">Preguntar cantidad al añadir ítems</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={showPopularProducts}
                      onChange={(e) => setShowPopularProducts(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">Mostrar carrusel de productos populares</span>
                  </label>
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                    <input 
                      type="checkbox"
                      checked={enableDiscountsAndCharges}
                      onChange={(e) => setEnableDiscountsAndCharges(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Habilitar Descuentos y Recargos</span>
                      <span className="text-[10px] text-slate-500 leading-tight block">Permite aplicar % de rebaja o cargos extras en el total.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                    <input 
                      type="checkbox"
                      checked={hideProductPhotosAndEmojis}
                      onChange={(e) => setHideProductPhotosAndEmojis(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Ocultar fotos de productos</span>
                      <span className="text-[10px] text-slate-500 leading-tight block">Optimiza la velocidad en dispositivos lentos.</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl">
                    <input 
                      type="checkbox"
                      checked={enableScaleEan13}
                      onChange={(e) => setEnableScaleEan13(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block">Soporte para Códigos de Barra de Balanza Etiquetadora</span>
                      <span className="text-[10px] text-emerald-600 leading-tight block">Permite procesar automáticamente etiquetas de carnicería/charcutería de formato 13 dígitos que contienen el peso y precio.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Gestión de Departamentos */}
          {slide === 12 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span>Configuración de Departamentos y Menú</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Defina las categorías principales que aparecerán en su barra lateral.</p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {sidebarCategories.map((cat, idx) => (
                    <div key={cat.id} className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <input 
                          type="text"
                          value={cat.name}
                          onChange={(e) => {
                            const newList = [...sidebarCategories];
                            newList[idx].name = e.target.value;
                            setSidebarCategories(newList);
                          }}
                          className="text-xs font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full"
                          placeholder="Nombre del Departamento"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (sidebarCategories.length <= 1) return;
                            setSidebarCategories(sidebarCategories.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.itemIds.map((itemId: string) => (
                          <span key={itemId} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                            {itemId.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const id = `cat-new-${Date.now()}`;
                    setSidebarCategories([...sidebarCategories, { id, name: 'Nuevo Departamento', itemIds: [] }]);
                  }}
                  className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Departamento</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: Claves de Seguridad */}
          {slide === 13 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600" />
                    <span>Seguridad y Clave de Autorización para Precio al Mayor</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Establezca claves numéricas para operaciones restringidas en el POS.</p>
                </div>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1 border border-slate-200 cursor-pointer transition-colors"
                >
                  Omitir paso
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Clave Precio Mayor</label>
                  <input 
                    type="password"
                    maxLength={10}
                    value={wholesalePassword}
                    onChange={(e) => setWholesalePassword(e.target.value)}
                    placeholder="1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[9px] text-slate-400">Para autorizar precios especiales de mayorista en caja.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Clave Egreso de Caja</label>
                  <input 
                    type="password"
                    maxLength={10}
                    value={outflowPassword}
                    onChange={(e) => setOutflowPassword(e.target.value)}
                    placeholder="1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[9px] text-slate-400">Requerido para registrar retiros de efectivo o gastos.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Clave Anulación</label>
                  <input 
                    type="password"
                    maxLength={10}
                    value={voidSalePassword}
                    onChange={(e) => setVoidSalePassword(e.target.value)}
                    placeholder="1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[9px] text-slate-400">Para borrar productos del carrito o anular facturas.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: Personalización Nota de Entrega */}
          {slide === 14 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Personalización de la Nota de Entrega</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Active o desactive los campos impresos en el comprobante del cliente.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Mostrar Nombre de la Empresa</span>
                  <input 
                    type="checkbox"
                    checked={deliveryNoteShowBusinessName}
                    onChange={(e) => setDeliveryNoteShowBusinessName(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Mostrar RIF</span>
                  <input 
                    type="checkbox"
                    checked={deliveryNoteShowBusinessRif}
                    onChange={(e) => setDeliveryNoteShowBusinessRif(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Mostrar Teléfono</span>
                  <input 
                    type="checkbox"
                    checked={deliveryNoteShowBusinessPhone}
                    onChange={(e) => setDeliveryNoteShowBusinessPhone(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none">
                  <span className="text-xs font-semibold text-slate-700">Imprimir Tasa de Cambio BCV</span>
                  <input 
                    type="checkbox"
                    checked={deliveryNoteShowBcvRate}
                    onChange={(e) => setDeliveryNoteShowBcvRate(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all select-none col-span-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Desglosar Métodos de Pago utilizados</span>
                  <input 
                    type="checkbox"
                    checked={deliveryNoteShowPaymentMethod}
                    onChange={(e) => setDeliveryNoteShowPaymentMethod(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 10: Creación de Usuarios */}
          {slide === 15 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Gestión de Cuentas, Permisos & Roles de Usuarios</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Cree y configure accesos para sus cajeros y supervisores.</p>
              </div>

              {/* Admin configuration Card */}
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                  <h4 className="text-xs font-extrabold text-blue-900">Establecer Contraseña del Administrador Principal ("admin") *</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Usuario de Acceso</label>
                    <input 
                      type="text"
                      disabled
                      value="admin"
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Contraseña del Administrador *</label>
                    <div className="relative">
                      <input 
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        value={usersToCreate.find(u => u.username === 'admin')?.password === 'admin_password' ? '' : (usersToCreate.find(u => u.username === 'admin')?.password || '')}
                        onChange={(e) => {
                          const list = [...usersToCreate];
                          const idx = list.findIndex(u => u.username === 'admin');
                          if (idx >= 0) {
                            list[idx].password = e.target.value;
                            setUsersToCreate(list);
                          }
                        }}
                        placeholder="Nueva contraseña"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cajeros creator */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    <span>Crear Usuarios Adicionales</span>
                  </h4>
                  <button 
                    type="button"
                    onClick={() => setShowPermissionsPanel(!showPermissionsPanel)}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {showPermissionsPanel ? 'Ocultar Permisos' : 'Configurar Permisos'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:border-blue-300 transition-all cursor-pointer relative group" onClick={() => userFileInputRef.current?.click()}>
                    {newUserImageUrl ? (
                      <img src={newUserImageUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-slate-300 group-hover:text-blue-400" />
                    )}
                    <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Subir Foto</span>
                    <input type="file" ref={userFileInputRef} hidden accept="image/*" onChange={handleUserPhotoUpload} />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <input 
                      type="text"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      placeholder="Usuario (ej: carlos)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold"
                    />
                    <input 
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Contraseña"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold"
                    />
                    <input 
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Nombre Completo"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rol:</span>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="Cajero">Cajero POS (Ventas directas)</option>
                      <option value="Supervisor">Supervisor (Claves y Arqueo)</option>
                      <option value="Administrador">Administrador Total</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                       if (!newUserUsername.trim() || !newUserPassword || !newUserName.trim()) {
                        alert('Por favor complete todos los datos del usuario.');
                        return;
                      }
                      const usernameClean = newUserUsername.trim().toLowerCase();
                      if (usersToCreate.some(u => u.username === usernameClean)) {
                        alert('Este usuario ya se encuentra registrado.');
                        return;
                      }
                      setUsersToCreate([...usersToCreate, {
                        username: usernameClean,
                        password: newUserPassword,
                        name: newUserName.trim(),
                        role: newUserRole,
                        imageUrl: newUserImageUrl,
                        canViewOtherShifts: newUserCanViewOtherShifts,
                        canViewAllSales: newUserCanViewAllSales,
                        canRegisterExpenses: newUserCanRegisterExpenses,
                        canApplyDiscountOrSurcharge: newUserCanApplyDiscountOrSurcharge,
                        canSellOnCredit: newUserCanSellOnCredit,
                        canVoidSales: newUserCanVoidSales,
                        canConfigurePrinters: newUserCanConfigurePrinters,
                        canModifyManualRate: newUserCanModifyManualRate,
                        dashboardType: newUserDashboardType,
                        cashRegister: newUserCashRegister
                      }]);
                      setNewUserUsername('');
                      setNewUserPassword('');
                      setNewUserName('');
                      setNewUserImageUrl('');
                    }}
                    className="bg-blue-600 text-white rounded-xl py-2 px-4 text-xs font-bold hover:bg-blue-700 cursor-pointer text-center"
                  >
                    Agregar Usuario
                  </button>
                </div>

                {showPermissionsPanel && (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 animate-fade-in">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Permisos Avanzados para el Nuevo Usuario:</p>
                    <div className="grid grid-cols-2 gap-2">
                       <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanViewOtherShifts} onChange={(e) => setNewUserCanViewOtherShifts(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Ver otros turnos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanViewAllSales} onChange={(e) => setNewUserCanViewAllSales(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Ver todas las ventas</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanRegisterExpenses} onChange={(e) => setNewUserCanRegisterExpenses(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Registrar Egresos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanApplyDiscountOrSurcharge} onChange={(e) => setNewUserCanApplyDiscountOrSurcharge(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Descuentos/Recargos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanSellOnCredit} onChange={(e) => setNewUserCanSellOnCredit(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Ventas a Crédito</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanVoidSales} onChange={(e) => setNewUserCanVoidSales(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Anular Facturas</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanConfigurePrinters} onChange={(e) => setNewUserCanConfigurePrinters(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Conf. Impresoras</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUserCanModifyManualRate} onChange={(e) => setNewUserCanModifyManualRate(e.target.checked)} className="w-3.5 h-3.5 rounded text-blue-600" />
                        <span className="text-[10px] font-semibold text-slate-600">Modificar Tasa</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* User collection table */}
              {usersToCreate.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuarios creados en el asistente:</p>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {usersToCreate.map((u, i) => (
                      <div key={u.username} className="flex items-center justify-between p-3 bg-white text-xs">
                        <div className="flex items-center gap-3">
                          {u.imageUrl ? (
                             <img src={u.imageUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-800">{u.name}</span>
                            <span className="text-[10px] text-slate-500 ml-2">@{u.username}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            u.role === 'Administrador' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}>
                            {u.role}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(i)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 11: Zero-Resource Modular Config */}
          {slide === 16 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <span>Zero-Resource Overhead Engine</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Personalice su experiencia desactivando módulos que su negocio no utilice.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Integridad Histórica Preservada</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  Los módulos inactivos entran en Modo Solo Lectura para reportes y liberan memoria RAM, sockets, workers en segundo plano y transacciones en disco sin borrar ningún dato histórico ni romper claves foráneas.
                </p>
              </div>

              {/* Module Registry Toggle grid */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activar módulos de tu empresa:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  <label className="flex items-start gap-3 p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enabledModules.includes('shifts')}
                      onChange={(e) => {
                        const list = [...enabledModules];
                        if (e.target.checked) list.push('shifts');
                        else {
                          const idx = list.indexOf('shifts');
                          if (idx >= 0) list.splice(idx, 1);
                        }
                        setEnabledModules(list);
                      }}
                      className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Arqueo de Caja & Turnos</span>
                      <span className="text-[9px] text-slate-500 leading-tight block">Aperturas, egresos, retiros de caja y reportes X/Z obligatorios.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enabledModules.includes('combos')}
                      onChange={(e) => {
                        const list = [...enabledModules];
                        if (e.target.checked) list.push('combos');
                        else {
                          const idx = list.indexOf('combos');
                          if (idx >= 0) list.splice(idx, 1);
                        }
                        setEnabledModules(list);
                      }}
                      className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Combos & Promociones</span>
                      <span className="text-[9px] text-slate-500 leading-tight block">Venda combos fijos o mixtos con descuento automático de stock.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enabledModules.includes('kardex')}
                      onChange={(e) => {
                        const list = [...enabledModules];
                        if (e.target.checked) list.push('kardex');
                        else {
                          const idx = list.indexOf('kardex');
                          if (idx >= 0) list.splice(idx, 1);
                        }
                        setEnabledModules(list);
                      }}
                      className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Kardex de Inventario</span>
                      <span className="text-[9px] text-slate-500 leading-tight block">Trazabilidad forense inmutable de todo movimiento y costo de stock.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enabledModules.includes('alerts')}
                      onChange={(e) => {
                        const list = [...enabledModules];
                        if (e.target.checked) list.push('alerts');
                        else {
                          const idx = list.indexOf('alerts');
                          if (idx >= 0) list.splice(idx, 1);
                        }
                        setEnabledModules(list);
                      }}
                      className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Cron de Alertas Stock 60s</span>
                      <span className="text-[9px] text-slate-500 leading-tight block">Monitorea y emite alertas de reabastecimiento en segundo plano.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enabledModules.includes('cxc')}
                      onChange={(e) => {
                        const list = [...enabledModules];
                        if (e.target.checked) list.push('cxc');
                        else {
                          const idx = list.indexOf('cxc');
                          if (idx >= 0) list.splice(idx, 1);
                        }
                        setEnabledModules(list);
                      }}
                      className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Cuentas por Cobrar (CxC)</span>
                      <span className="text-[9px] text-slate-500 leading-tight block">Control de deudas de clientes, créditos y cobro de abonos parciales.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 border border-slate-200 rounded-xl bg-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enabledModules.includes('cxp')}
                      onChange={(e) => {
                        const list = [...enabledModules];
                        if (e.target.checked) list.push('cxp');
                        else {
                          const idx = list.indexOf('cxp');
                          if (idx >= 0) list.splice(idx, 1);
                        }
                        setEnabledModules(list);
                      }}
                      className="w-4.5 h-4.5 rounded text-blue-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Cuentas por Pagar (CxP)</span>
                      <span className="text-[9px] text-slate-500 leading-tight block">Facturas a crédito de proveedores y cronograma de vencimientos.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* WIZARD BOTTOM ACTIONS BAR */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
          <button
            type="button"
            onClick={slide === 0 ? onCancel : handlePrevSlide}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-xs font-bold cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{slide === 0 ? 'Regresar al Login' : 'Atrás'}</span>
          </button>

          {slide < 15 ? (
            <button
              type="button"
              onClick={handleNextSlide}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer transition-all shadow-md shadow-blue-500/10"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isFinishing}
              onClick={handleFinishInstallation}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50"
            >
              {isFinishing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Configurando Sistema...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Finalizar Instalación</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
