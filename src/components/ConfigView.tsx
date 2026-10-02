import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Save, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink,
  Building2,
  Receipt,
  AlertTriangle,
  FileText,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Moon,
  Sun,
  User as UserIcon,
  Trash2,
  Edit3,
  Plus,
  Key,
  Printer,
  Shield,
  Check,
  X,
  Users,
  CheckCircle2,
  Upload,
  LayoutDashboard,
  Coins,
  ArrowUpRight,
  Percent,
  CreditCard,
  Boxes,
  Cpu,
  FolderTree,
  Cloud,
  Globe
} from 'lucide-react';
import { POSConfig, DeliveryNoteCurrency } from '../types';
import { getPOSConfig, savePOSConfig } from '../utils/configHelper';
import { safeFetchJson } from '../utils/api';
import { SystemModulesConfig } from './SystemModulesConfig';

interface ConfigViewProps {
  currentUser?: any;
  onUpdateCurrentUser?: (updatedUser: any) => void;
}

export function ConfigView({ currentUser, onUpdateCurrentUser }: ConfigViewProps = {}) {
  const [config, setConfig] = useState<POSConfig>(getPOSConfig());
  const [configTab, setConfigTab] = useState<'modules' | 'users' | 'company' | 'pos' | 'departments' | 'printers' | 'cloud'>('modules');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [btFeedback, setBtFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showLegalWarningModal, setShowLegalWarningModal] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState<boolean>(false);
  const [purgeInput, setPurgeInput] = useState<string>('');

  // Cloud Sync State
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudAppId, setCloudAppId] = useState('');
  const [cloudToken, setCloudToken] = useState('');
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  // Fetch Cloud Sync Config
  useEffect(() => {
    const fetchCloudConfig = async () => {
      try {
        const res = await safeFetchJson<any>('/api/v1/system/cloud-config');
        if (res.ok && res.data) {
          setCloudSyncEnabled(res.data.cloudSyncEnabled);
          setCloudAppId(res.data.cloudAppId || '');
          setCloudToken(res.data.cloudToken || '');
        }
      } catch (e) {
        console.error('Error fetching cloud config:', e);
      }
    };
    fetchCloudConfig();
  }, []);

  const handleSaveCloudSync = async () => {
    setIsCloudSaving(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/system/cloud-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudSyncEnabled,
          cloudAppId,
          cloudToken
        })
      });
      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      } else {
        alert(res.error || 'Error al guardar la configuración de nube');
      }
    } catch (e) {
      alert('Error de conexión al guardar configuración de nube');
    } finally {
      setIsCloudSaving(false);
    }
  };

  const userFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUserPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es demasiado grande. El límite es de 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUserForm(prev => ({ ...prev, imageUrl: reader.result as string }));
    };
    reader.onerror = () => {
      alert('Error al leer el archivo de imagen.');
    };
    reader.readAsDataURL(file);
  };

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    id: '', // Empty for new
    username: '',
    password: '',
    name: '',
    role: 'Cajero',
    imageUrl: '',
    allowedDepartments: [] as string[],
    allowedFunctions: [] as string[],
    canConfigurePrinters: true,
    canModifyManualRate: true,
    cashRegister: '',
    canViewOtherShifts: false,
    canViewAllSales: false,
    dashboardType: 'CAJERO' as 'ADMIN' | 'CAJERO',
    canRegisterExpenses: false,
    canApplyDiscountOrSurcharge: false,
    canSellOnCredit: false,
    canVoidSales: false
  });
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);

  // Fetch users from server
  const loadUsers = async () => {
    setIsUsersLoading(true);
    try {
      const res = await safeFetchJson<any>('/api/auth/users');
      if (res.ok && Array.isArray(res.data?.users)) {
        setUsers(res.data.users);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);
    setIsSavingUser(true);

    if (!userForm.username || !userForm.name) {
      setUserError('El usuario y nombre completo son obligatorios.');
      setIsSavingUser(false);
      return;
    }
    if (!isEditingUser && !userForm.password) {
      setUserError('La contraseña es obligatoria para nuevos usuarios.');
      setIsSavingUser(false);
      return;
    }

    try {
      const method = isEditingUser ? 'PUT' : 'POST';
      const url = isEditingUser ? `/api/auth/users/${userForm.id}` : '/api/auth/users';
      
      const payload = {
        username: userForm.username.trim(),
        password: userForm.password ? userForm.password : undefined,
        name: userForm.name.trim(),
        role: userForm.role,
        imageUrl: userForm.imageUrl,
        allowedDepartments: userForm.allowedDepartments,
        allowedFunctions: userForm.allowedFunctions,
        canConfigurePrinters: userForm.canConfigurePrinters,
        canModifyManualRate: userForm.canModifyManualRate,
        cashRegister: userForm.cashRegister,
        canViewOtherShifts: userForm.canViewOtherShifts,
        canViewAllSales: userForm.canViewAllSales,
        dashboardType: userForm.dashboardType,
        canRegisterExpenses: userForm.canRegisterExpenses,
        canApplyDiscountOrSurcharge: userForm.canApplyDiscountOrSurcharge,
        canSellOnCredit: userForm.canSellOnCredit,
        canVoidSales: userForm.canVoidSales
      };

      const res = await safeFetchJson<any>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setUserSuccess(isEditingUser ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito');
        
        if (isEditingUser && currentUser && userForm.id === currentUser.id && onUpdateCurrentUser) {
          onUpdateCurrentUser({
            ...currentUser,
            name: payload.name,
            role: payload.role,
            imageUrl: payload.imageUrl,
            username: payload.username,
            allowedDepartments: payload.allowedDepartments,
            allowedFunctions: payload.allowedFunctions,
            canConfigurePrinters: payload.canConfigurePrinters,
            canModifyManualRate: payload.canModifyManualRate,
            cashRegister: payload.cashRegister,
            canViewOtherShifts: payload.canViewOtherShifts,
            canViewAllSales: payload.canViewAllSales,
            dashboardType: payload.dashboardType,
            canRegisterExpenses: payload.canRegisterExpenses,
            canApplyDiscountOrSurcharge: payload.canApplyDiscountOrSurcharge,
            canSellOnCredit: payload.canSellOnCredit,
            canVoidSales: payload.canVoidSales
          });
        }

        setUserForm({
          id: '',
          username: '',
          password: '',
          name: '',
          role: 'Cajero',
          imageUrl: '',
          allowedDepartments: [],
          allowedFunctions: [],
          canConfigurePrinters: true,
          canModifyManualRate: true,
          cashRegister: '',
          canViewOtherShifts: false,
          canViewAllSales: false,
          dashboardType: 'CAJERO',
          canRegisterExpenses: false,
          canApplyDiscountOrSurcharge: false,
          canSellOnCredit: false,
          canVoidSales: false
        });
        setIsEditingUser(false);
        loadUsers();
      } else {
        setUserError(res.error || 'Ocurrió un error al procesar el usuario.');
      }
    } catch (err: any) {
      setUserError('Error al conectar con el servidor.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleEditUserClick = (u: any) => {
    setIsEditingUser(true);
    const isCaj = u.role?.toLowerCase()?.includes('caje');
    setUserForm({
      id: u.id,
      username: u.username,
      password: '', // Leave blank to keep current
      name: u.name,
      role: u.role,
      imageUrl: u.imageUrl || '',
      allowedDepartments: Array.isArray(u.allowedDepartments) ? u.allowedDepartments : [],
      allowedFunctions: Array.isArray(u.allowedFunctions) ? u.allowedFunctions : [],
      canConfigurePrinters: u.canConfigurePrinters !== false,
      canModifyManualRate: u.canModifyManualRate !== false,
      cashRegister: u.cashRegister || '',
      canViewOtherShifts: u.canViewOtherShifts !== undefined ? !!u.canViewOtherShifts : !isCaj,
      canViewAllSales: u.canViewAllSales !== undefined ? !!u.canViewAllSales : !isCaj,
      dashboardType: (u.dashboardType as 'ADMIN' | 'CAJERO') || (isCaj ? 'CAJERO' : 'ADMIN'),
      canRegisterExpenses: u.canRegisterExpenses !== undefined ? !!u.canRegisterExpenses : !isCaj,
      canApplyDiscountOrSurcharge: u.canApplyDiscountOrSurcharge !== undefined ? !!u.canApplyDiscountOrSurcharge : !isCaj,
      canSellOnCredit: u.canSellOnCredit !== undefined ? !!u.canSellOnCredit : !isCaj,
      canVoidSales: u.canVoidSales !== undefined ? !!u.canVoidSales : !isCaj
    });
    setUserError(null);
    setUserSuccess(null);
  };

  const handleDeleteUserClick = async (id: string, username: string) => {
    if (username === 'admin') {
      alert('No se puede eliminar el administrador inicial "admin".');
      return;
    }
    if (!confirm(`¿Está seguro de eliminar al usuario @${username}?`)) {
      return;
    }

    try {
      const res = await safeFetchJson<any>(`/api/auth/users/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUserSuccess('Usuario eliminado exitosamente.');
        loadUsers();
      } else {
        alert(res.error || 'Error al eliminar usuario.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggle = (key: keyof POSConfig) => {
    setConfig((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      
      // Validation rule adjustments
      if (key === 'showClientName' && !updated.showClientName) {
        updated.clientNameRequired = false;
      }
      if (key === 'showClientRif' && !updated.showClientRif) {
        updated.clientRifRequired = false;
      }
      if (key === 'showClientPhone' && !updated.showClientPhone) {
        updated.clientPhoneRequired = false;
      }
      if (key === 'showClientNotes' && !updated.showClientNotes) {
        updated.clientNotesRequired = false;
      }

      return updated;
    });
    setIsSaved(false);
  };

  const handleChangeText = (key: keyof POSConfig, val: string) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
    setIsSaved(false);
  };

  const handleSelectCurrency = (currency: DeliveryNoteCurrency) => {
    if (currency === 'USD' || currency === 'BOTH') {
      if (!config.deliveryNoteDisclaimerAccepted) {
        setShowLegalWarningModal(true);
      }
    }
    setConfig((prev) => ({
      ...prev,
      deliveryNotePriceCurrency: currency,
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    // If currency is USD or BOTH but disclaimer not accepted, alert and reset to BS
    if (config.deliveryNotePriceCurrency !== 'BS' && !config.deliveryNoteDisclaimerAccepted) {
      alert('Para expresar notas en Dólares ($) debe leer y aceptar el descargo de responsabilidad fiscal.');
      return;
    }
    savePOSConfig(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePurgeSystem = async () => {
    if (purgeInput !== 'ELIMINAR') {
      alert('Debe escribir ELIMINAR para confirmar.');
      return;
    }

    setIsPurging(true);
    try {
      const res = await safeFetchJson<any>('/api/v1/system/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPurge: 'PURGE_ALL_DATA_NOW' })
      });

      if (res.ok && res.data?.success) {
        alert('Sistema purgado exitosamente. La aplicación se reiniciará.');
        
        // Clear all localStorage related to the app
        localStorage.removeItem('nubly_app_pos_config_v1');
        localStorage.removeItem('nubly_app_pos_clients_v1');
        localStorage.removeItem('nubly_app_suppliers_v1');
        localStorage.removeItem('nubly_app_purchase_receipts_v1');
        localStorage.removeItem('nubly_app_supplier_credit_notes_v1');
        localStorage.removeItem('nubly_app_supplier_general_payments_v1');
        localStorage.removeItem('user');
        
        // Force reload to trigger onboarding/login
        window.location.href = '/';
      } else {
        alert(res.error || 'Error al purgar los datos del servidor.');
        setIsPurging(false);
      }
    } catch (err) {
      console.error('[Purge] Error:', err);
      alert('Error de conexión al intentar purgar el sistema.');
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Title Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Configuración de Permisos y Cobros del POS</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Personalice los requisitos de referencias de pago y los datos obligatorios del cliente durante el cierre de caja.
          </p>
        </div>
        
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Guardar Configuración</span>
        </button>
      </div>

      {isSaved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>¡La configuración del POS se ha guardado exitosamente y se aplicará de inmediato!</span>
        </div>
      )}

      {/* NAVEGACIÓN POR PESTAÑAS DE CONFIGURACIÓN */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto scrollbar-none border border-slate-200">
        <button
          type="button"
          onClick={() => setConfigTab('modules')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'modules'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Módulos & Optimización</span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
            Zero-Overhead
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConfigTab('users')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'users'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios & Roles</span>
        </button>

        <button
          type="button"
          onClick={() => setConfigTab('company')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'company'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Empresa & Ticket</span>
        </button>

        <button
          type="button"
          onClick={() => setConfigTab('pos')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'pos'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Cobros & Referencias</span>
        </button>

        <button
          type="button"
          onClick={() => setConfigTab('departments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'departments'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Departamentos</span>
        </button>

        <button
          type="button"
          onClick={() => setConfigTab('printers')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'printers'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Impresoras Térmicas</span>
        </button>

        <button
          type="button"
          onClick={() => setConfigTab('cloud')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            configTab === 'cloud'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Nube / Sync</span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            NUEVO
          </span>
        </button>
      </div>

      {configTab === 'modules' && (
        <SystemModulesConfig />
      )}

      {configTab === 'users' && (
      /* CONTROL DE SEGURIDAD & GESTIÓN DE USUARIOS */
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Gestión de Cuentas, Permisos & Roles de Usuarios</h3>
            <p className="text-[11px] text-slate-500">Cree y configure accesos para sus cajeros y supervisores. Configure a qué departamentos y funciones tendrán acceso.</p>
          </div>
        </div>

        {userError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold animate-fade-in flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{userError}</span>
          </div>
        )}

        {userSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold animate-fade-in flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{userSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* USER FORM */}
          <form onSubmit={handleSaveUser} className="lg:col-span-5 space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>{isEditingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</span>
              {isEditingUser && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUser(false);
                    setUserForm({
                      id: '',
                      username: '',
                      password: '',
                      name: '',
                      role: 'Cajero',
                      imageUrl: '',
                      allowedDepartments: [],
                      allowedFunctions: [],
                      canConfigurePrinters: true,
                      canModifyManualRate: true,
                      cashRegister: '',
                      canViewOtherShifts: false,
                      canViewAllSales: false,
                      dashboardType: 'CAJERO',
                      canRegisterExpenses: false,
                      canApplyDiscountOrSurcharge: false,
                      canSellOnCredit: false,
                      canVoidSales: false
                    });
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer uppercase font-semibold"
                >
                  Cancelar Edición
                </button>
              )}
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Sofia Rodríguez"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Usuario</label>
                  <input
                    type="text"
                    required
                    disabled={isEditingUser}
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                    placeholder="Ej: sofia"
                    className="w-full px-3 py-2 bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rol</label>
                  <input
                    type="text"
                    required
                    value={userForm.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      const isCaj = newRole.toLowerCase().includes('caje');
                      setUserForm(prev => ({
                        ...prev,
                        role: newRole,
                        dashboardType: isCaj ? 'CAJERO' : prev.dashboardType
                      }));
                    }}
                    placeholder="Ej: Cajero o Administrador"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] text-slate-400 font-bold">Plantillas rápidas:</span>
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => ({
                        ...prev,
                        role: 'Cajero',
                        dashboardType: 'CAJERO',
                        canViewOtherShifts: false,
                        canViewAllSales: false,
                        canRegisterExpenses: false,
                        canApplyDiscountOrSurcharge: false,
                        canSellOnCredit: false,
                        canVoidSales: false
                      }))}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Cajero Estándar
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => ({
                        ...prev,
                        role: 'Administrador',
                        dashboardType: 'ADMIN',
                        canViewOtherShifts: true,
                        canViewAllSales: true,
                        canRegisterExpenses: true,
                        canApplyDiscountOrSurcharge: true,
                        canSellOnCredit: true,
                        canVoidSales: true
                      }))}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Administrador
                    </button>
                  </div>
                </div>
              </div>

              {/* TIPO DE DASHBOARD ASIGNADO */}
              <div className="border-t border-slate-200 pt-3">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dashboard Visualizado al Iniciar Sesión</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserForm(prev => ({ ...prev, dashboardType: 'ADMIN' }))}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      userForm.dashboardType === 'ADMIN'
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600/20 text-blue-950 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black flex items-center gap-1">
                      <span>Dashboard Admin</span>
                      {userForm.dashboardType === 'ADMIN' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Torre de control, KPIs globales, margen y ventas de toda la empresa
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserForm(prev => ({ ...prev, dashboardType: 'CAJERO' }))}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      userForm.dashboardType === 'CAJERO'
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600/20 text-blue-950 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black flex items-center gap-1">
                      <span>Dashboard Cajero</span>
                      {userForm.dashboardType === 'CAJERO' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Operativo, turno personal, caja asignada y accesos rápidos
                    </div>
                  </button>
                </div>
              </div>

              {(userForm.role.toLowerCase().startsWith('caje') || userForm.role.toLowerCase() === 'cajero' || userForm.role.toLowerCase() === 'cajera') && (
                <div className="bg-amber-50/55 border border-amber-200 rounded-xl p-3.5 space-y-1.5 animate-fade-in">
                  <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">Número de Caja Asignada (Obligatorio)</label>
                  <input
                    type="text"
                    required
                    value={userForm.cashRegister}
                    onChange={(e) => setUserForm(prev => ({ ...prev, cashRegister: e.target.value.replace(/[^0-9]/g, '') }))}
                    placeholder="Ej: 1"
                    className="w-full px-3 py-2 bg-white border-2 border-amber-200 focus:border-amber-500 rounded-lg text-xs font-black text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  <p className="text-[9px] text-amber-600 font-bold leading-normal">Defina el número de caja asignado a este cajero. Esto automatizará los Arqueos de Caja individuales y se imprimirá en cada nota de entrega.</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contraseña {isEditingUser && <span className="text-slate-400 font-normal">(Opcional para actualizar)</span>}
                </label>
                <input
                  type="password"
                  required={!isEditingUser}
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={isEditingUser ? "•••••••• (Vacio para mantener)" : "Mínimo 4 caracteres"}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Foto del Usuario</label>
                
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2">
                  <div className="shrink-0 relative">
                    {userForm.imageUrl ? (
                      <div className="relative group">
                        <img
                          src={userForm.imageUrl}
                          alt="Previsualización"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => setUserForm(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-colors cursor-pointer"
                          title="Quitar foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-lg shadow-inner border-2 border-white">
                        {userForm.name ? userForm.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={userFileInputRef}
                        onChange={handleUserPhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => userFileInputRef.current?.click()}
                        className="py-1.5 px-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir desde mi PC</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">PNG, JPG o WEBP (máx 2MB)</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">O introduce una URL de foto / Ejemplos:</span>
                  <input
                    type="text"
                    value={userForm.imageUrl}
                    onChange={(e) => setUserForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => ({ ...prev, imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' }))}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                    >
                      Sofia (Cajera)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => ({ ...prev, imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' }))}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                    >
                      Carlos (Supervisor)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => ({ ...prev, imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80' }))}
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                    >
                      Maria (Admin)
                    </button>
                  </div>
                </div>
              </div>

              {/* DEPARTAMENTOS PERMITIDOS */}
              <div className="border-t border-slate-200 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Departamentos Permitidos</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-white p-2 rounded-lg border border-slate-200/80">
                  {config.sidebarCategories?.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userForm.allowedDepartments.includes(cat.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUserForm(prev => {
                            const current = [...prev.allowedDepartments];
                            if (checked) {
                              return { ...prev, allowedDepartments: [...current, cat.id] };
                            } else {
                              return { ...prev, allowedDepartments: current.filter(x => x !== cat.id) };
                            }
                          });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  ))}
                  {(!config.sidebarCategories || config.sidebarCategories.length === 0) && (
                    <span className="text-[10px] text-slate-400 italic">No hay departamentos creados</span>
                  )}
                </div>
              </div>

              {/* FUNCIONES PERMITIDAS */}
              <div className="border-t border-slate-200 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Funciones Permitidas</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-white p-2 rounded-lg border border-slate-200/80">
                  {[
                    { id: 'dashboard', name: 'Torre de Control' },
                    { id: 'pos', name: 'Terminal POS' },
                    { id: 'combos', name: 'Combos & Promociones' },
                    { id: 'shifts', name: 'Arqueo de Caja' },
                    { id: 'kardex', name: 'Kardex' },
                    { id: 'audits', name: 'Auditorías Stock' },
                    { id: 'sales', name: 'Ventas Recientes' },
                    { id: 'cxc', name: 'Cuentas por Cobrar' },
                    { id: 'cxp', name: 'Cuentas por Pagar' },
                    { id: 'inventory', name: 'Inventario' },
                    { id: 'alerts', name: 'Alertas Stock' },
                    { id: 'rates', name: 'Historial de Tasas' },
                    { id: 'clients', name: 'Clientes' },
                    { id: 'config', name: 'Configuración' }
                  ].map((fn) => (
                    <label key={fn.id} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userForm.allowedFunctions.includes(fn.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUserForm(prev => {
                            const current = [...prev.allowedFunctions];
                            if (checked) {
                              return { ...prev, allowedFunctions: [...current, fn.id] };
                            } else {
                              return { ...prev, allowedFunctions: current.filter(x => x !== fn.id) };
                            }
                          });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{fn.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* EXTRA BOOLEAN PERMISSIONS */}
              <div className="border-t border-slate-200 pt-3 space-y-2.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Permisos Operativos y de Aislamiento
                </div>

                {/* 1. Ver Arqueos de Otros vs Solo Propio */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>¿Puede ver los arqueos de los demás cajeros?</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {userForm.canViewOtherShifts
                        ? 'Permitido: Ve y consulta el historial de arqueos y turnos de todos los usuarios.'
                        : 'Restringido: Solo ve y gestiona sus propios turnos y arqueos de caja.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.canViewOtherShifts}
                    onChange={(e) => setUserForm(prev => ({ ...prev, canViewOtherShifts: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                </label>

                {/* 2. Ver Todas las Ventas vs Solo Propias */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>¿Puede ver todo el historial de ventas?</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {userForm.canViewAllSales
                        ? 'Permitido: Acceso total al historial de ventas de todas las cajas y cajeros.'
                        : 'Restringido: Solo ve las ventas facturadas por su propio usuario.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.canViewAllSales}
                    onChange={(e) => setUserForm(prev => ({ ...prev, canViewAllSales: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                </label>

                {/* 3. Botón Registrar Salidas de Dinero en Arqueo */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Mostrar botón para Registrar Salidas de Dinero</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {userForm.canRegisterExpenses
                        ? 'Visible: Se muestra el botón de egresos/gastos en el módulo de Arqueo de Caja.'
                        : 'Oculto: No se le muestra el botón de egresos ni salidas de caja.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.canRegisterExpenses}
                    onChange={(e) => setUserForm(prev => ({ ...prev, canRegisterExpenses: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                </label>

                {/* 4. Dar Descuentos o Recargos Extras en POS */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Dar Descuentos o Cargos Extras en el POS</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {userForm.canApplyDiscountOrSurcharge
                        ? 'Permitido: Puede ingresar descuentos o recargos adicionales al cobrar una venta.'
                        : 'Bloqueado: La tarjeta de descuentos y cargos extras no se muestra en el POS.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.canApplyDiscountOrSurcharge}
                    onChange={(e) => setUserForm(prev => ({ ...prev, canApplyDiscountOrSurcharge: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                </label>

                {/* 5. Vender a Crédito */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Vender bajo Método de Pago a Crédito (Fiado)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {userForm.canSellOnCredit
                        ? 'Permitido: Habilita el botón y método Crédito en la ventana de cobro del POS.'
                        : 'Bloqueado: Oculta la opción de crédito; solo permite métodos de contado.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.canSellOnCredit}
                    onChange={(e) => setUserForm(prev => ({ ...prev, canSellOnCredit: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                </label>

                {/* 6. Anular Ventas en el Historial */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>¿Puede anular ventas en el Historial de Ventas?</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {userForm.canVoidSales
                        ? 'Permitido: Muestra el botón de "Anular Venta" en el historial de ventas y le da acceso a solicitar la anulación.'
                        : 'Restringido: Oculta el botón de anular ventas; no podrá visualizarlo ni anular notas de entrega.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.canVoidSales}
                    onChange={(e) => setUserForm(prev => ({ ...prev, canVoidSales: e.target.checked }))}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                </label>

                {/* Other flags */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/70">
                  <label className="flex items-center justify-between text-xs text-slate-700 font-bold cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                    <span className="flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px]">Configurar impresoras</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={userForm.canConfigurePrinters}
                      onChange={(e) => setUserForm(prev => ({ ...prev, canConfigurePrinters: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-slate-700 font-bold cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px]">Modificar tasa manual</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={userForm.canModifyManualRate}
                      onChange={(e) => setUserForm(prev => ({ ...prev, canModifyManualRate: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingUser}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isSavingUser ? 'Guardando...' : (isEditingUser ? 'GUARDAR CAMBIOS' : 'REGISTRAR USUARIO')}
            </button>
          </form>

          {/* USER LIST */}
          <div className="lg:col-span-7 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center justify-between">
              <span>Usuarios Registrados ({users.length})</span>
              <button
                type="button"
                onClick={loadUsers}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                Refrescar
              </button>
            </h4>

            {isUsersLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                Cargando lista de usuarios de forma segura...
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {users.map((u) => (
                  <div key={u.id} className="p-3.5 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-4 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.imageUrl ? (
                        <img
                          src={u.imageUrl}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-900 truncate" title={u.name}>{u.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">@{u.username}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">{u.role}</span>
                          {u.cashRegister && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200/60 font-black px-1.5 py-0.2 rounded uppercase select-none">
                              Caja #{u.cashRegister}
                            </span>
                          )}
                        </div>

                        {/* Special flags indicator */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 border ${
                            u.dashboardType === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                              : 'bg-blue-50 text-blue-700 border-blue-200/70'
                          }`}>
                            <LayoutDashboard className="w-2.5 h-2.5" />
                            <span>Dash: {u.dashboardType || (u.role?.toLowerCase()?.includes('caje') ? 'CAJERO' : 'ADMIN')}</span>
                          </span>

                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 border ${
                            u.canViewOtherShifts ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <Coins className="w-2.5 h-2.5" />
                            <span>Arqueos: {u.canViewOtherShifts ? 'Todos' : 'Propios'}</span>
                          </span>

                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 border ${
                            u.canViewAllSales ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <Receipt className="w-2.5 h-2.5" />
                            <span>Ventas: {u.canViewAllSales ? 'Todas' : 'Propias'}</span>
                          </span>

                          {u.canRegisterExpenses ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              <span>Salidas</span>
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-100 text-slate-400 border border-slate-200/70 font-bold px-1.5 py-0.5 rounded-md line-through">
                              Salidas
                            </span>
                          )}

                          {u.canApplyDiscountOrSurcharge ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Percent className="w-2.5 h-2.5" />
                              <span>Desctos</span>
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-100 text-slate-400 border border-slate-200/70 font-bold px-1.5 py-0.5 rounded-md line-through">
                              Desctos
                            </span>
                          )}

                          {u.canSellOnCredit ? (
                            <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <CreditCard className="w-2.5 h-2.5" />
                              <span>Crédito</span>
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-100 text-slate-400 border border-slate-200/70 font-bold px-1.5 py-0.5 rounded-md line-through">
                              Crédito
                            </span>
                          )}

                          {u.canConfigurePrinters && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Printer className="w-2.5 h-2.5 text-slate-500" />
                              <span>Impresoras</span>
                            </span>
                          )}
                          {u.canModifyManualRate && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <DollarSign className="w-2.5 h-2.5 text-slate-500" />
                              <span>Tasa Manual</span>
                            </span>
                          )}
                          {Array.isArray(u.allowedDepartments) && u.allowedDepartments.length > 0 && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-md">
                              Deps: {u.allowedDepartments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditUserClick(u)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                        title="Editar permisos y usuario"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {u.username !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUserClick(u.id, u.username)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs italic">
                    Ningún usuario adicional registrado. Configure uno arriba.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {configTab === 'company' && (
      <>
      {/* SECTION 1: BUSINESS PROFILE & DELIVERY NOTE CUSTOMIZATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel A: Business Profile */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Identidad de la Empresa / Negocio</h3>
              <p className="text-[11px] text-slate-500">Datos comerciales impresos en las notas de entrega y reportes.</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nombre de la Empresa o Negocio
              </label>
              <input
                type="text"
                value={config.businessName || ''}
                onChange={(e) => handleChangeText('businessName', e.target.value)}
                placeholder="Ej: Inversiones Los Andes C.A."
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none transition-all font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Número de RIF
                </label>
                <input
                  type="text"
                  value={config.businessRif || ''}
                  onChange={(e) => handleChangeText('businessRif', e.target.value.toUpperCase())}
                  placeholder="Ej: J-50123456-7"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={config.businessPhone || ''}
                  onChange={(e) => handleChangeText('businessPhone', e.target.value)}
                  placeholder="Ej: 0412-1234567"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-blue-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-blue-800">
                <FileText className="w-3.5 h-3.5" />
                <span>Encabezado no fiscal reglamentario</span>
              </span>
              <p className="text-slate-600">
                Las notas de entrega emitidas por Nubly son comprobantes operativos internos y no sustituyen facturas fiscales formales ni usan la palabra factura.
              </p>
            </div>
          </div>
        </div>

        {/* Panel B: Delivery Note Customization (POS Checks & Currency) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Personalización de la Nota de Entrega</h3>
              <p className="text-[11px] text-slate-500">Active o desactive los campos impresos en el comprobante del cliente.</p>
            </div>
          </div>

          {/* Visibility Checkboxes */}
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Datos visibles en la nota:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.deliveryNoteShowBusinessName}
                  onChange={() => handleToggle('deliveryNoteShowBusinessName')}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800">Nombre de la Empresa</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.deliveryNoteShowBusinessRif}
                  onChange={() => handleToggle('deliveryNoteShowBusinessRif')}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800">RIF del Negocio</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.deliveryNoteShowBusinessPhone}
                  onChange={() => handleToggle('deliveryNoteShowBusinessPhone')}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800">Teléfono de Contacto</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.deliveryNoteShowBcvRate}
                  onChange={() => handleToggle('deliveryNoteShowBcvRate')}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800">Tasa BCV del Día</span>
              </label>
            </div>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={config.deliveryNoteShowPaymentMethod}
                onChange={() => handleToggle('deliveryNoteShowPaymentMethod')}
                className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 block">Mostrar Método de Pago Recibido</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Si se paga en USD o USDT en efectivo o Binance, especificará detalladamente la divisa y el monto exacto recibido en $.
                </span>
              </div>
            </label>
          </div>

          {/* Currency Presentation Options */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Expresión de Moneda (Precios Unitarios y Totales):
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectCurrency('BS')}
                className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                  (config.deliveryNotePriceCurrency || 'BS') === 'BS'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">Todo en Bs.</span>
                  <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Precios unitarios y totales expresados 100% en Bolívares.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCurrency('USD')}
                className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                  config.deliveryNotePriceCurrency === 'USD'
                    ? 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">Todo en $</span>
                  <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    Riesgo Fiscal
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Precios unitarios y totales expresados en Dólares ($).
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCurrency('BOTH')}
                className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                  config.deliveryNotePriceCurrency === 'BOTH'
                    ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">Ambas (Bs. y $)</span>
                  <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                    Dual
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Expresa precios en Bolívares y referencia en Dólares.
                </p>
              </button>
            </div>

            {/* Legal Warning Notice if USD or BOTH is active */}
            {(config.deliveryNotePriceCurrency === 'USD' || config.deliveryNotePriceCurrency === 'BOTH') && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-fade-in">
                <div className="flex items-start gap-2 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold block text-rose-950">
                      AVISO FISCAL Y EXONERACIÓN DE RESPONSABILIDAD:
                    </span>
                    La normativa tributaria venezolana vigente exige que los precios y comprobantes se expresen prioritariamente en moneda de curso legal (Bolívares). Al expresar sus notas en Dólares ($), <strong>Nubly queda totalmente libre de toda responsabilidad fiscal, administrativa o sancionatoria</strong> ante el SENIAT u organismos competentes. Usted asume voluntariamente las consecuencias legales.
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 border-t border-rose-200/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.deliveryNoteDisclaimerAccepted}
                    onChange={() => handleToggle('deliveryNoteDisclaimerAccepted')}
                    className="mt-0.5 h-4 w-4 rounded-sm border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-rose-900">
                    He leído y acepto que asumo toda la responsabilidad legal y fiscal, liberando a Nubly de cualquier responsabilidad.
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: DANGER ZONE / MAINTENANCE */}
      <div className="mt-8 pt-6 border-t border-slate-200 animate-fade-in">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-rose-900 uppercase tracking-tight">Zona de Peligro: Mantenimiento del Sistema</h3>
              <p className="text-[11px] text-rose-700 font-medium">Acciones críticas e irreversibles de limpieza de datos.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-1">
              <p className="text-xs font-bold text-rose-950">Restauración de Fábrica / Purga Total</p>
              <p className="text-[10px] text-rose-600 leading-tight">
                Elimina permanentemente todo el inventario, catálogo, historial de ventas, registros de caja (turnos), deudores (CxC), cuentas por pagar (CxP) y usuarios. El sistema volverá a su estado inicial.
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isPurging}
                onClick={() => {
                  setPurgeInput('');
                  setShowPurgeConfirm(true);
                }}
                className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Purgando Sistema...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Todos los Datos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LEGAL WARNING MODAL (Appears on click of USD / BOTH) */}
      {showLegalWarningModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Advertencia Legal y Consecuencias Fiscales</h3>
                <p className="text-xs text-rose-700 font-medium">Expresión de precios en Divisas Extranjeras ($)</p>
              </div>
            </div>

            <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
              <p>
                Estimado comerciante: La legislación tributaria y la Ley del Banco Central de Venezuela estipulan que los precios de los bienes y servicios ofertados y sus soportes de venta deben expresarse en <strong>Bolívares (moneda de curso legal)</strong>.
              </p>
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-900 font-semibold space-y-1">
                <p>
                  Al configurar sus notas de entrega con precios unitarios o totales expresados en Dólares ($), le advertimos que <strong>puede tener consecuencias legales y fiscales</strong> ante inspecciones tributarias.
                </p>
                <p className="text-rose-950 font-bold">
                  Nubly queda expresamente LIBRE de toda responsabilidad fiscal, administrativa, tributaria o sancionatoria. El usuario asume plena y exclusivamente las consecuencias de que sus notas se expresen en $.
                </p>
              </div>
              <p className="text-slate-500 text-[11px]">
                Predeterminadamente el sistema mantendrá todo en Bolívares (Bs.). Si decide continuar con Dólares ($), debe confirmar que acepta este descargo de responsabilidad.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfig((prev) => ({
                    ...prev,
                    deliveryNotePriceCurrency: 'BS',
                    deliveryNoteDisclaimerAccepted: false,
                  }));
                  setShowLegalWarningModal(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Volver a Bolívares (Recomendado)
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfig((prev) => ({
                    ...prev,
                    deliveryNoteDisclaimerAccepted: true,
                  }));
                  setShowLegalWarningModal(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Entendido, Asumo la Responsabilidad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM PURGE CONFIRMATION MODAL */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mx-auto border-4 border-rose-50 mb-2">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">¿Eliminar TODOS los datos?</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Esta acción es <span className="font-bold text-rose-600 uppercase">irreversible</span> e inmediata. Se borrará el inventario, ventas, deudores, cuentas por pagar y usuarios.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <label className="block text-[11px] font-black text-rose-900 uppercase tracking-widest mb-2 text-center">
                  Escriba "ELIMINAR" para continuar:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={purgeInput}
                  onChange={(e) => setPurgeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && purgeInput === 'ELIMINAR' && handlePurgeSystem()}
                  placeholder="Escriba aquí..."
                  className="w-full bg-white border-2 border-rose-200 focus:border-rose-600 rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest text-rose-700 placeholder:text-rose-200 outline-none transition-all shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isPurging || purgeInput !== 'ELIMINAR'}
                  onClick={handlePurgeSystem}
                  className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-rose-500/30 transition-all disabled:opacity-30 disabled:grayscale cursor-pointer"
                >
                  {isPurging ? 'Procesando Purga...' : '¡SÍ, ELIMINAR TODO!'}
                </button>
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={() => setShowPurgeConfirm(false)}
                  className="w-full py-3 rounded-2xl text-slate-500 hover:text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar y Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {configTab === 'pos' && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel 1: Payment Method References */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Validación de Referencias obligatorias
          </h3>
          <p className="text-xs text-slate-500">
            Marque los métodos de pago que requieren obligatoriamente ingresar un número de referencia/aprobación antes de confirmar el ticket.
          </p>

          <div className="space-y-2.5 pt-2">
            {[
              { id: 'debitCardRefRequired', label: 'Tarjeta Débito (Punto de Venta POS)', desc: 'Solicita lote/aprobación del punto' },
              { id: 'pagoMovilRefRequired', label: 'Pago Móvil Interbancario', desc: 'Solicita últimos dígitos del comprobante' },
              { id: 'binanceRefRequired', label: 'Binance Pay (USDT)', desc: 'Solicita ID de orden o de transacción' },
              { id: 'cashBsRefRequired', label: 'Efectivo Bolívares (Bs.)', desc: 'Solicita referencia opcional de arqueo' },
              { id: 'cashUsdRefRequired', label: 'Efectivo Dólares ($)', desc: 'Solicita serial de billetes o notas' },
              { id: 'creditRefRequired', label: 'Venta a Crédito / Fiado', desc: 'Solicita nota de autorización del deudor' },
              { id: 'splitRefRequired', label: 'Pago Mixto (Split Payment)', desc: 'Exige referencias individuales en el desglose' },
            ].map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-all"
              >
                <input
                  type="checkbox"
                  checked={!!(config as any)[item.id]}
                  onChange={() => handleToggle(item.id as keyof POSConfig)}
                  className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">{item.label}</span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">{item.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Panel 2: Client Checkout Requirements */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Datos de Facturación del Cliente
          </h3>
          
          <label className="flex items-start gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50/60 cursor-pointer select-none transition-all">
            <input
              type="checkbox"
              checked={config.useClientData}
              onChange={() => handleToggle('useClientData')}
              className="mt-0.5 h-5 w-5 rounded-sm border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-black text-blue-950 block">Activar datos del cliente al cobrar</span>
              <span className="text-blue-800 text-[10px] block mt-1">
                Al cobrar el ticket, se abrirá un formulario para buscar o registrar al cliente con sus datos fiscales (Cédula/RIF, Nombre, Teléfono, etc.).
              </span>
            </div>
          </label>

          {config.useClientData ? (
            <div className="space-y-3.5 pt-2 animate-fade-in">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Campos activos y obligatorios:
              </p>

              {[
                { 
                  showKey: 'showClientName', 
                  reqKey: 'clientNameRequired', 
                  label: 'Nombre o Razón Social',
                  desc: 'Nombre legal de la persona natural o jurídica'
                },
                { 
                  showKey: 'showClientRif', 
                  reqKey: 'clientRifRequired', 
                  label: 'Documento Identidad / RIF',
                  desc: 'Cédula de identidad (V/E) o RIF fiscal (J/G/G/P/C...)'
                },
                { 
                  showKey: 'showClientPhone', 
                  reqKey: 'clientPhoneRequired', 
                  label: 'Número de Teléfono',
                  desc: 'Contacto telefónico del cliente'
                },
                { 
                  showKey: 'showClientNotes', 
                  reqKey: 'clientNotesRequired', 
                  label: 'Datos Adicionales / Notas',
                  desc: 'Dirección física u observaciones especiales'
                },
              ].map((field) => {
                const isShown = !!(config as any)[field.showKey];
                const isReq = !!(config as any)[field.reqKey];

                return (
                  <div key={field.showKey} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{field.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{field.desc}</span>
                    </div>
                    
                    <div className="flex items-center gap-5 text-xs pt-0.5 border-t border-slate-100/50">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isShown}
                          onChange={() => handleToggle(field.showKey as keyof POSConfig)}
                          className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-slate-600 font-medium">Mostrar</span>
                      </label>

                      {isShown && (
                        <label className="flex items-center gap-1.5 cursor-pointer select-none animate-fade-in">
                          <input
                            type="checkbox"
                            checked={isReq}
                            onChange={() => handleToggle(field.reqKey as keyof POSConfig)}
                            className="h-4 w-4 rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                          <span className="text-rose-700 font-semibold">Obligatorio</span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400 space-y-1.5">
              <AlertCircle className="w-5 h-5 text-slate-300 mx-auto" />
              <p className="font-medium">Formulario de Cliente Desactivado</p>
              <p className="text-[10px]">
                Los cobros se registrarán automáticamente bajo la denominación predeterminada <strong className="text-slate-500 font-mono">"Contado / Cliente General"</strong>.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* NEW PANEL ROW: Pago Móvil and Additional Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel 3: Pago Móvil Detallado */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Detalles de Pago Móvil Receptor
          </h3>
          <p className="text-xs text-slate-500">
            Configure los datos de su cuenta receptora que el cajero y el cliente visualizan al seleccionar el método de Pago Móvil.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Banco Receptor
              </label>
              <input
                type="text"
                value={config.pagoMovilBankName || ''}
                onChange={(e) => handleChangeText('pagoMovilBankName', e.target.value)}
                placeholder="Ej: Banco de Venezuela (BDV)"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Teléfono Receptor
                </label>
                <input
                  type="text"
                  value={config.pagoMovilPhone || ''}
                  onChange={(e) => handleChangeText('pagoMovilPhone', e.target.value)}
                  placeholder="Ej: 0412-1234567"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  RIF Receptor
                </label>
                <input
                  type="text"
                  value={config.pagoMovilRif || ''}
                  onChange={(e) => handleChangeText('pagoMovilRif', e.target.value)}
                  placeholder="Ej: J-12345678-9"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Datos adicionales requeridos del cliente:
            </p>

            <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={config.pagoMovilShowBank}
                onChange={() => handleToggle('pagoMovilShowBank')}
                className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Selección de Banco Emisor</span>
                <span className="text-slate-500 text-[10px] block mt-0.5">
                  Permite o exige elegir desde qué banco el cliente realizó el Pago Móvil.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={config.pagoMovilShowAccountType}
                onChange={() => handleToggle('pagoMovilShowAccountType')}
                className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Selección de Tipo de Cuenta</span>
                <span className="text-slate-500 text-[10px] block mt-0.5">
                  Permite o exige marcar si la cuenta emisora es Personal o Jurídica.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Panel 4: Visualización y Ajustes de Caja */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Visualización y Ajustes de Caja
          </h3>
          <p className="text-xs text-slate-500">
            Controle la presentación de elementos gráficos y opciones financieras durante la facturación diaria.
          </p>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={config.showPopularProducts}
                onChange={() => handleToggle('showPopularProducts')}
                className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Ver Productos con Más Demanda (Alta Rotación)</span>
                <span className="text-slate-500 text-[10px] block mt-1">
                  Muestra la cuadrícula interactiva de productos populares debajo del buscador de código de barras para agregarlos con un toque.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={config.enableDiscountsAndCharges}
                onChange={() => handleToggle('enableDiscountsAndCharges')}
                className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Habilitar Descuentos y Cargos Extra</span>
                <span className="text-slate-500 text-[10px] block mt-1">
                  Permite aplicar deducciones (descuentos en $ o Bs) y recargos adicionales al total de la cuenta en la pantalla de cobro.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={config.hideProductPhotosAndEmojis || false}
                onChange={() => handleToggle('hideProductPhotosAndEmojis')}
                className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">Liberar Espacio y Optimizar Rendimiento (Sin Fotos/Emojis)</span>
                <span className="text-slate-500 text-[10px] block mt-1">
                  Oculta las fotos y emojis de los productos en el POS y en el Inventario para mejorar la velocidad de carga y ahorrar espacio vertical en la pantalla.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Panel 5: Clave de Autorización para Precio al Mayor */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 col-span-1 md:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Seguridad y Clave de Autorización para Precio al Mayor</span>
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Ventas Mayoristas POS
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Defina la contraseña o el código de barras del supervisor para autorizar la aplicación de Precio al Mayor en el terminal de venta POS.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clave de Supervisor para Precio al Mayor
              </label>
              <input
                type="text"
                value={config.wholesalePassword || '1234'}
                onChange={(e) => handleChangeText('wholesalePassword', e.target.value)}
                placeholder="Ej: 1234 o escanee un código de barras"
                className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Predeterminado: <strong className="font-mono text-slate-600">1234</strong>. Autoriza el descuento por bulto/mayorista.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clave Especial para Salidas de Caja Chica (Egresos)
              </label>
              <input
                type="text"
                value={config.outflowPassword || '1234'}
                onChange={(e) => handleChangeText('outflowPassword', e.target.value)}
                placeholder="Ej: 1234 o clave secreta del dueño"
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Predeterminado: <strong className="font-mono text-slate-600">1234</strong>. Clave requerida para que el dueño/administrador registre egresos de dinero.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clave Especial para Anular Ventas en Historial
              </label>
              <input
                type="text"
                value={config.voidSalePassword || '1234'}
                onChange={(e) => handleChangeText('voidSalePassword', e.target.value)}
                placeholder="Ej: 1234 o clave de seguridad"
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-600 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Predeterminado: <strong className="font-mono text-slate-600">1234</strong>. Clave requerida para autorizar la anulación de tickets en el historial de ventas.
              </p>
            </div>
          </div>
        </div>

      </div>
      </>
      )}

      {configTab === 'departments' && (
      /* PANEL: ORGANIZACIÓN DE DEPARTAMENTOS DE LAS FUNCIONES DE LA BARRA LATERAL */
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
            <span>Configurar Departamentos de Funciones (Barra Lateral)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Agrupe y ordene las funciones de la barra lateral izquierda por departamentos personalizados para simplificar la navegación del sistema.
          </p>
        </div>

        <div className="space-y-4">
          {(config.sidebarCategories || []).map((cat, index) => {
            const availableModules = [
              { id: 'dashboard', name: 'Torre de Control' },
              { id: 'pos', name: 'Terminal POS' },
              { id: 'combos', name: 'Combos & Promociones' },
              { id: 'shifts', name: 'Arqueo de Caja' },
              { id: 'kardex', name: 'Kardex de Inventario' },
              { id: 'audits', name: 'Auditorías de Inventario' },
              { id: 'sales', name: 'Ventas Recientes' },
              { id: 'cxc', name: 'Cuentas por Cobrar' },
              { id: 'cxp', name: 'Cuentas por Pagar' },
              { id: 'inventory', name: 'Inventario & Catálogo' },
              { id: 'alerts', name: 'Alertas Stock' },
              { id: 'rates', name: 'Historial de Tasas' },
              { id: 'clients', name: 'Clientes' },
              { id: 'config', name: 'Configuración' },
              { id: 'open_price', name: 'Precios Variables' },
              { id: 'concurrency', name: 'Test Concurrencia' },
              { id: 'architecture', name: 'Arquitectura & Tests' },
            ];

            return (
              <div key={cat.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Nombre del Departamento
                    </label>
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setConfig((prev) => {
                          const updatedCats = [...(prev.sidebarCategories || [])];
                          updatedCats[index] = { ...updatedCats[index], name: newName };
                          return { ...prev, sidebarCategories: updatedCats };
                        });
                        setIsSaved(false);
                      }}
                      className="w-full max-w-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-blue-600 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-950 dark:text-white focus:outline-none transition-all"
                      placeholder="Ej: Ventas, Administración, Depósito..."
                    />
                  </div>

                  <div className="sm:mt-5 flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        setConfig((prev) => {
                          const updatedCats = [...(prev.sidebarCategories || [])];
                          const temp = updatedCats[index];
                          updatedCats[index] = updatedCats[index - 1];
                          updatedCats[index - 1] = temp;
                          return { ...prev, sidebarCategories: updatedCats };
                        });
                        setIsSaved(false);
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                      title="Mover departamento arriba"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === (config.sidebarCategories || []).length - 1}
                      onClick={() => {
                        setConfig((prev) => {
                          const updatedCats = [...(prev.sidebarCategories || [])];
                          const temp = updatedCats[index];
                          updatedCats[index] = updatedCats[index + 1];
                          updatedCats[index + 1] = temp;
                          return { ...prev, sidebarCategories: updatedCats };
                        });
                        setIsSaved(false);
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                      title="Mover departamento abajo"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Está seguro de eliminar el departamento "${cat.name}"? Los módulos volverán a la sección general.`)) {
                          setConfig((prev) => {
                            const updatedCats = (prev.sidebarCategories || []).filter((c) => c.id !== cat.id);
                            return { ...prev, sidebarCategories: updatedCats };
                          });
                          setIsSaved(false);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold cursor-pointer transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">
                    Funciones Incluidas en este Departamento
                  </span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {availableModules.map((mod) => {
                      const isChecked = cat.itemIds.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                            isChecked
                              ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setConfig((prev) => {
                                const updatedCats = (prev.sidebarCategories || []).map((c) => {
                                  if (c.id === cat.id) {
                                    const nextItemIds = c.itemIds.includes(mod.id)
                                      ? c.itemIds.filter((id) => id !== mod.id)
                                      : [...c.itemIds, mod.id];
                                    return { ...c, itemIds: nextItemIds };
                                  }
                                  if (c.itemIds.includes(mod.id)) {
                                    return { ...c, itemIds: c.itemIds.filter((id) => id !== mod.id) };
                                  }
                                  return c;
                                });
                                return { ...prev, sidebarCategories: updatedCats };
                              });
                              setIsSaved(false);
                            }}
                            className="h-4 w-4 rounded-sm text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs truncate">{mod.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const newCat = {
              id: `cat-${Date.now()}`,
              name: 'Nuevo Departamento',
              itemIds: [],
            };
            setConfig((prev) => ({
              ...prev,
              sidebarCategories: [...(prev.sidebarCategories || []), newCat],
            }));
            setIsSaved(false);
          }}
          className="w-full py-3 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50/40 text-blue-600 hover:text-blue-700 font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2"
        >
          <span>+ Añadir Nuevo Departamento</span>
        </button>
      </div>
      )}

      {configTab === 'printers' && (
      /* PANEL 5: FULL PRINTER CONFIGURATION SECTION */
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <img src="/images/impresora.svg" alt="Impresora" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Configuración de Impresora POS (Bluetooth, USB, WiFi, Red y Epson)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Imprima automáticamente sin pasar por el diálogo de Windows Print mediante Bluetooth directo, Servidor Plugin, Epson ePOS o USB.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.printerEnabled}
              onChange={() => handleToggle('printerEnabled')}
              className="h-5 w-5 rounded-sm border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-blue-950">Habilitar Impresión Directa</span>
          </label>
        </div>

        {/* Printer Options Sub-Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Opción 1: Impresora Bluetooth */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Opción 1: Impresora Bluetooth
              </span>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                Web Bluetooth API
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Conecte impresoras térmicas portátiles o de escritorio vía Bluetooth para emitir tickets instantáneos desde cualquier dispositivo.
            </p>

            <div className="space-y-3 pt-1">
              {/* Active Bluetooth Status Display */}
              <div className="p-3.5 rounded-xl border bg-white border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${
                    config.printerConnectionType === 'BLUETOOTH' && config.printerEnabled && config.printerName
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400'
                  }`} />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {config.printerName || config.btDeviceName || 'Sin impresora Bluetooth seleccionada'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {config.printerConnectionType === 'BLUETOOTH' ? 'Modo Bluetooth Seleccionado' : 'Modo Bluetooth Inactivo'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setBtFeedback(null);
                    const { connectBluetoothPrinter } = await import('../utils/printerService');
                    const res = await connectBluetoothPrinter();
                    if (res.success) {
                      setConfig(getPOSConfig());
                      setBtFeedback({ type: 'success', msg: `¡Conectado exitosamente a ${res.deviceName}!` });
                    } else {
                      setBtFeedback({ type: 'error', msg: res.error || 'Error conectando Bluetooth' });
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer transition-colors shrink-0 shadow-2xs"
                >
                  Conectar BT
                </button>
              </div>

              {/* Inline Bluetooth Feedback Banner */}
              {btFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold space-y-2 ${
                  btFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${btFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
                    <span className="leading-relaxed">{btFeedback.msg}</span>
                  </div>
                  {btFeedback.type === 'error' && (btFeedback.msg.includes('iframe') || btFeedback.msg.includes('pestaña') || btFeedback.msg.includes('seguridad')) && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition-colors cursor-pointer mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir App en Nueva Pestaña para Bluetooth</span>
                    </a>
                  )}
                </div>
              )}

              {/* Ancho de papel */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ancho del Papel Térmico
                </label>
                <select
                  value={config.printerPaperWidth}
                  onChange={(e) => handleChangeText('printerPaperWidth', e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="58mm">58mm (2 pulgadas - Impresoras Portátiles)</option>
                  <option value="80mm">80mm (3 pulgadas - Impresoras Estándar)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={config.printerAutoPrint}
                  onChange={() => handleToggle('printerAutoPrint')}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-semibold">Imprimir ticket automáticamente al finalizar la venta</span>
              </label>

              {/* Test Button */}
              <button
                type="button"
                onClick={async () => {
                  const { testPrint } = await import('../utils/printerService');
                  const res = await testPrint();
                  alert(res.message);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-2"
              >
                <span>Probar Impresión Bluetooth</span>
              </button>
            </div>
          </div>

          {/* Opción 2: Impresora Térmica Epson / USB / WiFi / Red / Servidor Plugin */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-800" />
                Opción 2: Impresora Térmica Epson / USB / WiFi / Red / Plugin
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Configure impresoras conectadas por cable USB, red local IP (WiFi/Ethernet) o mediante un servicio plugin de impresión local.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Controlador de Impresora
                </label>
                <select
                  value={config.printerConnectionType}
                  onChange={(e) => handleChangeText('printerConnectionType', e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none transition-all cursor-pointer"
                >
                  <option value="PLUGIN_HTTP">Servidor / Plugin Local (HTTP Parzibyte / Node Bridge)</option>
                  <option value="EPSON_EPOS">Epson ePOS SDK / Impresora en Red IP (WiFi / Ethernet)</option>
                  <option value="WEB_USB">Conexión Directa USB (WebUSB)</option>
                  <option value="BLUETOOTH">Bluetooth Inalámbrico</option>
                  <option value="SYSTEM_PRINT">Nativo del Sistema (Diálogo Estándar de Windows Print)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de la Impresora
                </label>
                <input
                  type="text"
                  value={config.printerName || ''}
                  onChange={(e) => handleChangeText('printerName', e.target.value)}
                  placeholder="Ej: PT210, EPSON_TM_T20, Impresora_Caja"
                  className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                />
              </div>

              {config.printerConnectionType === 'PLUGIN_HTTP' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    URL del Servidor / Plugin Local
                  </label>
                  <input
                    type="text"
                    value={config.printerPluginUrl || ''}
                    onChange={(e) => handleChangeText('printerPluginUrl', e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                  />
                </div>
              )}

              {config.printerConnectionType === 'EPSON_EPOS' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Dirección IP
                    </label>
                    <input
                      type="text"
                      value={config.printerEpsonIp || ''}
                      onChange={(e) => handleChangeText('printerEpsonIp', e.target.value)}
                      placeholder="192.168.1.100"
                      className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Puerto
                    </label>
                    <input
                      type="text"
                      value={config.printerEpsonPort || ''}
                      onChange={(e) => handleChangeText('printerEpsonPort', e.target.value)}
                      placeholder="8008"
                      className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.printerAutoCut}
                    onChange={() => handleToggle('printerAutoCut')}
                    className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-semibold">Corte automático de papel</span>
                </label>
              </div>

              {/* Test Print Button for Option 2 */}
              <button
                type="button"
                onClick={async () => {
                  const { testPrint } = await import('../utils/printerService');
                  const res = await testPrint();
                  alert(res.message);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-2"
              >
                <span>Probar Impresión de Red / USB / Plugin</span>
              </button>

            </div>
          </div>

        </div>
      </div>
      )}

      {configTab === 'cloud' && (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 animate-fade-in">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Sincronización en la Nube (Base44)</h3>
            <p className="text-xs text-slate-500">Conecte su sistema POS local con la plataforma Base44 para visualización remota y respaldos.</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900 block">Activar Sincronización Automática</span>
              <p className="text-[11px] text-slate-500 leading-tight">Envía ventas, inventario y movimientos a la nube en tiempo real.</p>
            </div>
            <button
              type="button"
              onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                cloudSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  cloudSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  ID de Aplicación (App ID)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={cloudAppId}
                    onChange={(e) => setCloudAppId(e.target.value)}
                    placeholder="Ej: 6abd5958ae4f1448d05815ea"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Token de Acceso Personal (Access Token)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={cloudToken}
                    onChange={(e) => setCloudToken(e.target.value)}
                    placeholder="Bearer token para autorización..."
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 leading-relaxed">
                <span className="font-bold block mb-1">Información de Seguridad:</span>
                Sus credenciales de API se almacenan de forma segura en el servidor local. 
                Asegúrese de que la App de destino tenga los esquemas de entidades correspondientes (Product, Sale, etc.) configurados.
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={isCloudSaving}
                onClick={handleSaveCloudSync}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCloudSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Conectar y Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}
