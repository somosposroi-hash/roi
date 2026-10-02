import fs from 'fs';
import path from 'path';

export interface ComboItemData {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  unit: string;
  unitsToDeduct: number;
  unitPrice?: number;
  imageUrl?: string | null;
}

export interface ComboData {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  type: 'FIXED' | 'SELECTABLE';
  price: number;
  category?: string;
  isActive: boolean;
  isAlwaysAvailable: boolean;
  availableDays?: number[];
  hasTimeRange?: boolean;
  startTime?: string;
  endTime?: string;
  hasDateRange?: boolean;
  startDate?: string;
  endDate?: string;
  items?: ComboItemData[];
  totalSelectableQuantity?: number;
  selectableProductIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class ComboService {
  private readonly filePath: string;
  private memoryCombos: ComboData[] = [];

  constructor() {
    this.filePath = path.join(process.cwd(), 'prisma', 'combos_store.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.memoryCombos = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('[ComboService] Error reading combos from disk:', e);
    }
    this.memoryCombos = [];
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryCombos, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[ComboService] Error saving combos to disk:', e);
    }
  }

  async getAllCombos(): Promise<ComboData[]> {
    return this.memoryCombos;
  }

  async getComboById(id: string): Promise<ComboData | null> {
    return this.memoryCombos.find(c => c.id === id) || null;
  }

  async upsertCombo(combo: ComboData): Promise<ComboData> {
    const index = this.memoryCombos.findIndex(c => c.id === combo.id);
    const now = new Date().toISOString();

    if (index >= 0) {
      this.memoryCombos[index] = {
        ...combo,
        updatedAt: now
      };
    } else {
      this.memoryCombos.unshift({
        ...combo,
        createdAt: combo.createdAt || now,
        updatedAt: now
      });
    }

    this.saveToDisk();
    return combo;
  }

  async deleteCombo(id: string): Promise<boolean> {
    const initialLen = this.memoryCombos.length;
    this.memoryCombos = this.memoryCombos.filter(c => c.id !== id);
    if (this.memoryCombos.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }
}
