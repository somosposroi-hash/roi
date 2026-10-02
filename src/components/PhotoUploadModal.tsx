import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon, Trash2, Search, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { getProductEmoji } from '../utils/product-meta';
import { GoogleImageSearchModal } from './GoogleImageSearchModal';

interface PhotoUploadModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onPhotoSaved: (updatedProduct: Product) => void;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  product,
  isOpen,
  onClose,
  onPhotoSaved,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGoogleSearchOpen, setIsGoogleSearchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setPreviewUrl(product.imageUrl || null);
      setError(null);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor seleccione un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen es demasiado grande. El límite máximo es de 5 MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.onerror = () => {
      setError('Error al leer el archivo de imagen.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: previewUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onPhotoSaved(data.data);
        onClose();
      } else {
        setError(data.error?.message || 'Error al guardar la imagen');
      }
    } catch {
      setError('Error de comunicación con el servidor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Foto del Producto</h3>
                <p className="text-xs text-slate-500 font-mono">Código: {product.barcode}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product Details Header */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
            <h4 className="font-semibold text-slate-800 text-sm truncate">{product.name}</h4>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
              <span>Precio: <strong className="text-slate-700">${product.price.toFixed(2)}</strong></span>
              <span>•</span>
              <span>Stock: <strong className="text-slate-700">{product.stock} {product.unit}</strong></span>
            </div>
          </div>

          {/* Google Image Search 10 Photos Button */}
          <button
            type="button"
            onClick={() => setIsGoogleSearchOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>🔍 Buscar 10 Fotos en Google Imágenes</span>
          </button>

          {/* Drag & Drop Zone or Current Preview */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-blue-500 bg-slate-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {previewUrl ? (
              <div className="space-y-3">
                <div className="relative mx-auto w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                  <img
                    src={previewUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Haga clic o arrastre para reemplazar la foto
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-1">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-2xl">
                  {getProductEmoji(product)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    Subir archivo desde PC
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Arrastre una imagen aquí o haga clic
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {previewUrl ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto();
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Quitar Foto
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar Foto
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Google Image Search 10 Photos Modal */}
      <GoogleImageSearchModal
        isOpen={isGoogleSearchOpen}
        onClose={() => setIsGoogleSearchOpen(false)}
        productName={product.name}
        onSelectPhoto={(url) => {
          setPreviewUrl(url);
          setIsGoogleSearchOpen(false);
        }}
      />
    </>
  );
};

