import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Trash2, Check, AlertCircle, Save, X, BookOpen, Contact } from 'lucide-react';
import { Client } from '../types';
import { getClientsList, saveClientsList } from '../utils/configHelper';

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [docType, setDocType] = useState<Client['docType']>('V');
  const [docNumber, setDocNumber] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<string>('');
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setClients(getClientsList());
  }, []);

  const triggerNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const resetForm = () => {
    setName('');
    setDocType('V');
    setDocNumber('');
    setPhone('');
    setNotes('');
    setCreditLimit('');
    setPaymentDayOfMonth('');
    setEditingId(null);
    setFormError(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic Validations
    if (!name.trim()) {
      setFormError('El nombre del cliente es obligatorio');
      return;
    }
    if (!docNumber.trim()) {
      setFormError('El número de documento / RIF es obligatorio');
      return;
    }

    const cleanNumber = docNumber.trim().replace(/[^0-9-]/g, '');
    if (!cleanNumber) {
      setFormError('El número de documento no es válido');
      return;
    }

    // Check duplicate (ignore if editing same)
    const duplicate = clients.find(
      (c) => c.docType === docType && c.docNumber === cleanNumber && c.id !== editingId
    );
    if (duplicate) {
      setFormError(`Ya existe un cliente registrado con el RIF/Cédula ${docType}-${cleanNumber}`);
      return;
    }

    const parsedCreditLimit = creditLimit ? parseFloat(creditLimit) : undefined;
    const parsedPaymentDay = paymentDayOfMonth ? parseInt(paymentDayOfMonth, 10) : undefined;

    if (parsedCreditLimit !== undefined && (isNaN(parsedCreditLimit) || parsedCreditLimit < 0)) {
      setFormError('El límite de crédito debe ser un número positivo');
      return;
    }

    if (parsedPaymentDay !== undefined && (isNaN(parsedPaymentDay) || parsedPaymentDay < 1 || parsedPaymentDay > 31)) {
      setFormError('El día de pago mensual debe ser un número entre 1 y 31');
      return;
    }

    let updatedList: Client[] = [];
    if (editingId) {
      // Edit mode
      updatedList = clients.map((c) => {
        if (c.id === editingId) {
          return {
            ...c,
            name: name.trim(),
            docType,
            docNumber: cleanNumber,
            phone: phone.trim(),
            notes: notes.trim(),
            creditLimit: parsedCreditLimit,
            paymentDayOfMonth: parsedPaymentDay,
          };
        }
        return c;
      });
      triggerNotification('Cliente actualizado con éxito.');
    } else {
      // Add mode
      const newClient: Client = {
        id: crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random()}`,
        name: name.trim(),
        docType,
        docNumber: cleanNumber,
        phone: phone.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        creditLimit: parsedCreditLimit,
        paymentDayOfMonth: parsedPaymentDay,
      };
      updatedList = [newClient, ...clients];
      triggerNotification('Cliente registrado exitosamente.');
    }

    setClients(updatedList);
    saveClientsList(updatedList);
    handleCloseForm();
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setDocType(client.docType);
    setDocNumber(client.docNumber);
    setPhone(client.phone);
    setNotes(client.notes);
    setCreditLimit(client.creditLimit !== undefined ? client.creditLimit.toString() : '');
    setPaymentDayOfMonth(client.paymentDayOfMonth !== undefined ? client.paymentDayOfMonth.toString() : '');
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    const clientToDelete = clients.find(c => c.id === id);
    if (!clientToDelete) return;

    if (window.confirm(`¿Está seguro de eliminar al cliente "${clientToDelete.name}" del sistema?`)) {
      const updated = clients.filter((c) => c.id !== id);
      setClients(updated);
      saveClientsList(updated);
      triggerNotification('Cliente eliminado del sistema.');
    }
  };

  // Filter clients
  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.docNumber.includes(q) ||
      `${c.docType}-${c.docNumber}`.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const docTypeLabels: Record<Client['docType'], string> = {
    V: 'V - Natural Venezolano',
    E: 'E - Natural Extranjero',
    J: 'J - Jurídico',
    G: 'G - Gubernamental',
    P: 'P - Pasaporte',
    C: 'C - Comunidad sin pers. jurídica',
    S: 'V/E/J - Sucesión',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Contact className="w-5 h-5 text-blue-600" />
            <span>Directorio de Clientes / RIF Fiscales</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestione la base de datos de clientes para la auto-sugerencia y facturación rápida en la terminal POS.
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Cliente</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4.5 h-4.5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Slide-out/Inline Edit/Add Form Container */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>{editingId ? 'Editar Perfil del Cliente' : 'Registrar Nuevo Cliente en el Directorio'}</span>
            </h3>
            <button
              type="button"
              onClick={handleCloseForm}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Doc Type Selector */}
            <div className="md:col-span-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Identificación / Prefijo RIF *</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as Client['docType'])}
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none"
              >
                {Object.entries(docTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Doc Number */}
            <div className="md:col-span-8">
              <label className="text-xs font-bold text-slate-700 block mb-1">Número de Documento / Cédula / RIF (Sin prefijo) *</label>
              <input
                type="text"
                required
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Ej: 29910481 o J-50123456-0"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none"
              />
            </div>

            {/* Name */}
            <div className="md:col-span-8">
              <label className="text-xs font-bold text-slate-700 block mb-1">Nombre o Razón Social *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Carlos Mendoza o Inversiones Alfa C.A."
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div className="md:col-span-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">Número de Teléfono (Opcional)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 0414-1234567"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-12">
              <label className="text-xs font-bold text-slate-700 block mb-1">Dirección / Datos Adicionales (Opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Av. Francisco de Miranda, Edf. Parque, Chacao"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none"
              />
            </div>

            {/* Credit Limit & Monthly Payment Day */}
            <div className="md:col-span-6">
              <label className="text-xs font-bold text-slate-700 block mb-1">Límite de Crédito ($ USD - Opcional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Sin límite si se deja vacío"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Límite máximo de deuda acumulada que el deudor puede acumular.</p>
            </div>

            <div className="md:col-span-6">
              <label className="text-xs font-bold text-slate-700 block mb-1">Día de Pago Fijo Mensual (1-31 - Opcional)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={paymentDayOfMonth}
                onChange={(e) => setPaymentDayOfMonth(e.target.value)}
                placeholder="Ej: 15 (Día 15 de cada mes)"
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Día recurrente del mes en el que se espera que el deudor abone o liquide.</p>
            </div>

          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseForm}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Actualizar Cliente' : 'Registrar Cliente'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Main Directorio Grid & Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-4">
        
        {/* Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3.5 my-auto w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente por nombre, cédula, RIF o teléfono..."
              className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 focus:outline-none transition-all"
            />
          </div>
        </div>

        {filteredClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-5">Cliente / Razón Social</th>
                  <th className="py-3 px-5">RIF o Cédula</th>
                  <th className="py-3 px-5">Teléfono</th>
                  <th className="py-3 px-5">Límite Crédito</th>
                  <th className="py-3 px-5">Día de Pago</th>
                  <th className="py-3 px-5">Datos Adicionales / Notas</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5 font-bold text-slate-900">
                      {client.name}
                    </td>
                    <td className="py-3 px-5 font-mono font-bold text-blue-700 text-[11px]">
                      {client.docType}-{client.docNumber}
                    </td>
                    <td className="py-3 px-5 font-mono">
                      {client.phone || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-700">
                      {client.creditLimit !== undefined ? (
                        <span className="font-bold text-slate-900">${client.creditLimit.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400 italic">Ilimitado</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-slate-700 font-medium">
                      {client.paymentDayOfMonth !== undefined ? (
                        <span>Día {client.paymentDayOfMonth} de cada mes</span>
                      ) : (
                        <span className="text-slate-400 italic">Sin fecha</span>
                      )}
                    </td>
                    <td className="py-3 px-5 max-w-[220px] truncate text-slate-500" title={client.notes}>
                      {client.notes || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3 px-5 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEdit(client)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer"
                        title="Editar perfil"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(client.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No se encontraron clientes registrados</p>
            <p className="text-[10px] text-slate-400">
              {searchQuery ? 'Pruebe con otros términos de búsqueda.' : 'Haga clic en "Registrar Cliente" para agregar uno nuevo.'}
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
