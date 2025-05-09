import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as frameService from '@/services/frameService';
import * as serviceService from '@/services/serviceService';
import * as lensService from '@/services/lensService';
import { Service } from '@/services/serviceService';

export interface FrameItem {
  frameId: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  price: number;
  qty: number;
  createdAt: string;
}

export interface LensType {
  id: string;
  name: string;
  type: "distance" | "reading" | "progressive" | "bifocal" | "sunglasses";
  price?: number;
}

export interface LensCoating {
  id: string;
  name: string;
  price: number;
  description?: string;
  category: "distance-reading" | "progressive" | "bifocal" | "sunglasses";
  isPhotochromic?: boolean;
  availableColors?: string[];
}

export interface LensThickness {
  id: string;
  name: string;
  price: number;
  description?: string;
  category: "distance-reading" | "progressive" | "bifocal";
}

export interface ContactLensItem {
  id: string;
  brand: string;
  type: string;
  bc: string;
  diameter: string;
  power: string;
  price: number;
  qty: number;
  color?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "exam" | "repair" | "other";
}

export interface LensPricingCombination {
  id: string;
  lensTypeId: string;
  coatingId: string;
  thicknessId: string;
  price: number;
}

interface InventoryState {
  frames: FrameItem[];
  isLoadingFrames: boolean;
  lensTypes: LensType[];
  isLoadingLensTypes: boolean;
  lensCoatings: LensCoating[];
  isLoadingLensCoatings: boolean;
  lensThicknesses: LensThickness[];
  isLoadingLensThicknesses: boolean;
  contactLenses: ContactLensItem[];
  services: ServiceItem[];
  lensPricingCombinations: LensPricingCombination[];
  isLoadingLensPricingCombinations: boolean;
  isLoadingServices: boolean;
  
  fetchFrames: () => Promise<void>;
  addFrame: (frame: Omit<FrameItem, "frameId" | "createdAt">) => Promise<string | null>;
  updateFrameQuantity: (frameId: string, newQty: number) => Promise<boolean>;
  searchFrames: (query: string) => Promise<FrameItem[]>;
  getFrameById: (id: string) => Promise<FrameItem | null>;
  bulkImportFrames: (frames: Array<Omit<FrameItem, "frameId" | "createdAt">>) => Promise<{ added: number; duplicates: number; errors: number }>;
  updateFrame: (frameId: string, updates: Partial<Omit<FrameItem, "frameId" | "createdAt">>) => Promise<boolean>;
  
  fetchLensTypes: () => Promise<void>;
  addLensType: (lens: Omit<LensType, "id">) => string;
  updateLensType: (id: string, lens: Partial<Omit<LensType, "id">>) => void;
  deleteLensType: (id: string) => void;
  
  fetchLensCoatings: () => Promise<void>;
  addLensCoating: (coating: Omit<LensCoating, "id">) => string;
  updateLensCoating: (id: string, coating: Partial<Omit<LensCoating, "id">>) => void;
  deleteLensCoating: (id: string) => void;
  getLensCoatingsByCategory: (category: LensCoating['category']) => LensCoating[];
  getAvailableCoatings: (lensTypeId: string, category: LensCoating['category']) => LensCoating[];
  
  fetchLensThicknesses: () => Promise<void>;
  addLensThickness: (thickness: Omit<LensThickness, "id">) => string;
  updateLensThickness: (id: string, thickness: Partial<Omit<LensThickness, "id">>) => void;
  deleteLensThickness: (id: string) => void;
  getLensThicknessesByCategory: (category: LensThickness['category']) => LensThickness[];
  getAvailableThicknesses: (lensTypeId: string, coatingId: string, category: LensThickness['category']) => LensThickness[];
  
  addContactLens: (lens: Omit<ContactLensItem, "id">) => string;
  updateContactLens: (id: string, lens: Partial<Omit<ContactLensItem, "id">>) => void;
  deleteContactLens: (id: string) => void;
  searchContactLenses: (query: string) => ContactLensItem[];
  
  addService: (service: Omit<ServiceItem, "id">) => Promise<string>;
  updateService: (id: string, service: Partial<Omit<ServiceItem, "id">>) => Promise<boolean>;
  deleteService: (id: string) => Promise<boolean>;
  getServiceById: (id: string) => Promise<ServiceItem | null>;
  getServicesByCategory: (category: ServiceItem['category']) => Promise<ServiceItem[]>;
  
  fetchLensPricingCombinations: () => Promise<void>;
  addLensPricingCombination: (combination: Omit<LensPricingCombination, "id">) => string;
  updateLensPricingCombination: (id: string, combination: Partial<Omit<LensPricingCombination, "id">>) => void;
  deleteLensPricingCombination: (id: string) => void;
  getLensPricingCombinations: () => LensPricingCombination[];
  getLensPricingByComponents: (lensTypeId: string, coatingId: string, thicknessId: string) => number | null;
  
  cleanupSamplePhotochromicCoatings: () => void;
  resetLensPricing: () => void;
  
  fetchServices: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      frames: [],
      isLoadingFrames: false,
      lensTypes: [],
      isLoadingLensTypes: false,
      lensCoatings: [],
      isLoadingLensCoatings: false,
      lensThicknesses: [],
      isLoadingLensThicknesses: false,
      contactLenses: [],
      services: [],
      isLoadingServices: false,
      lensPricingCombinations: [],
      isLoadingLensPricingCombinations: false,
      
      fetchFrames: async () => {
        set({ isLoadingFrames: true });
        try {
          // Use the paginated version to get all frames
          const frames = await frameService.getAllFramesPaginated();
          set({ frames, isLoadingFrames: false });
        } catch (error) {
          console.error("Error fetching frames:", error);
          set({ isLoadingFrames: false });
        }
      },
      
      addFrame: async (frame) => {
        const frameId = await frameService.addFrame(frame);
        
        if (frameId) {
          // Add to local state if successfully added to Supabase
          const newFrame: FrameItem = {
            ...frame,
            frameId,
            createdAt: new Date().toISOString()
          };
          
          set((state) => ({
            frames: [...state.frames, newFrame]
          }));
        }
        
        return frameId;
      },
      
      bulkImportFrames: async (frames) => {
        const result = await frameService.bulkImportFrames(frames);
        
        // Refresh the frames list after import
        await get().fetchFrames();
        
        return result;
      },
      
      updateFrameQuantity: async (frameId, newQty) => {
        const success = await frameService.updateFrameQuantity(frameId, newQty);
        
        if (success) {
          set((state) => ({
            frames: state.frames.map(frame => 
              frame.frameId === frameId 
                ? { ...frame, qty: newQty } 
                : frame
            )
          }));
        }
        
        return success;
      },
      
      searchFrames: async (query) => {
        // If empty query, return all loaded frames
        if (!query.trim()) return get().frames;
        
        // Get all results from Supabase with pagination
        return await frameService.paginatedSearchFrames(query);
      },
      
      getFrameById: async (id) => {
        return await frameService.getFrameById(id);
      },
      
      updateFrame: async (frameId, updates) => {
        const success = await frameService.updateFrame(frameId, updates);
        
        if (success) {
          set((state) => ({
            frames: state.frames.map(frame => 
              frame.frameId === frameId 
                ? { ...frame, ...updates } 
                : frame
            )
          }));
        }
        
        return success;
      },
      
      fetchLensTypes: async () => {
        set({ isLoadingLensTypes: true });
        try {
          const lensTypes = await lensService.getAllLensTypes();
          set({ lensTypes, isLoadingLensTypes: false });
        } catch (error) {
          console.error("Error fetching lens types:", error);
          set({ isLoadingLensTypes: false });
        }
      },
      
      addLensType: (lens) => {
        const id = `lens${Date.now()}`;
        
        set((state) => ({
          lensTypes: [...state.lensTypes, { ...lens, id }]
        }));
        
        return id;
      },
      
      updateLensType: (id, lens) => {
        set((state) => ({
          lensTypes: state.lensTypes.map(type => 
            type.id === id ? { ...type, ...lens } : type
          )
        }));
      },
      
      deleteLensType: (id) => {
        set((state) => ({
          lensTypes: state.lensTypes.filter(type => type.id !== id)
        }));
      },
      
      fetchLensCoatings: async () => {
        set({ isLoadingLensCoatings: true });
        try {
          const lensCoatings = await lensService.getAllLensCoatings();
          set({ lensCoatings, isLoadingLensCoatings: false });
        } catch (error) {
          console.error("Error fetching lens coatings:", error);
          set({ isLoadingLensCoatings: false });
        }
      },
      
      addLensCoating: (coating) => {
        const id = `coat${Date.now()}`;
        
        set((state) => ({
          lensCoatings: [...state.lensCoatings, { ...coating, id }]
        }));
        
        return id;
      },
      
      updateLensCoating: (id, coating) => {
        set((state) => ({
          lensCoatings: state.lensCoatings.map(item => 
            item.id === id ? { ...item, ...coating } : item
          )
        }));
      },
      
      deleteLensCoating: (id) => {
        set((state) => ({
          lensCoatings: state.lensCoatings.filter(item => item.id !== id)
        }));
      },
      
      getLensCoatingsByCategory: (category) => {
        return get().lensCoatings.filter(coating => coating.category === category);
      },
      
      getAvailableCoatings: (lensTypeId, category) => {
        const combinations = get().lensPricingCombinations;
        const allCoatingsByCategory = get().lensCoatings.filter(c => c.category === category);
        
        const lensType = get().lensTypes.find(lt => lt.id === lensTypeId);
        if (lensType && lensType.type === "sunglasses" && category === "sunglasses") {
          return allCoatingsByCategory;
        }
        
        const availableCoatingIds = [...new Set(
          combinations
            .filter(combo => combo.lensTypeId === lensTypeId)
            .map(combo => combo.coatingId)
        )];
        
        const availableCoatings = get().lensCoatings.filter(
          coating => availableCoatingIds.includes(coating.id) && coating.category === category
        );
        
        return availableCoatings.length > 0 ? availableCoatings : allCoatingsByCategory;
      },
      
      fetchLensThicknesses: async () => {
        set({ isLoadingLensThicknesses: true });
        try {
          const lensThicknesses = await lensService.getAllLensThicknesses();
          set({ lensThicknesses, isLoadingLensThicknesses: false });
        } catch (error) {
          console.error("Error fetching lens thicknesses:", error);
          set({ isLoadingLensThicknesses: false });
        }
      },
      
      addLensThickness: (thickness) => {
        const id = `thick${Date.now()}`;
        
        set((state) => ({
          lensThicknesses: [...state.lensThicknesses, { ...thickness, id }]
        }));
        
        return id;
      },
      
      updateLensThickness: (id, thickness) => {
        set((state) => ({
          lensThicknesses: state.lensThicknesses.map(item => 
            item.id === id ? { ...item, ...thickness } : item
          )
        }));
      },
      
      deleteLensThickness: (id) => {
        set((state) => ({
          lensThicknesses: state.lensThicknesses.filter(item => item.id !== id)
        }));
      },
      
      getLensThicknessesByCategory: (category) => {
        return get().lensThicknesses.filter(thickness => thickness.category === category);
      },
      
      getAvailableThicknesses: (lensTypeId, coatingId, category) => {
        const combinations = get().lensPricingCombinations;
        const allThicknessesByCategory = get().lensThicknesses.filter(t => t.category === category);
        
        const availableThicknessIds = [...new Set(
          combinations
            .filter(combo => combo.lensTypeId === lensTypeId && combo.coatingId === coatingId)
            .map(combo => combo.thicknessId)
        )];
        
        const availableThicknesses = get().lensThicknesses.filter(
          thickness => availableThicknessIds.includes(thickness.id) && thickness.category === category
        );
        
        return availableThicknesses.length > 0 ? availableThicknesses : allThicknessesByCategory;
      },
      
      addContactLens: (lens) => {
        const id = `cl${Date.now()}`;
        
        set((state) => ({
          contactLenses: [...state.contactLenses, { ...lens, id }]
        }));
        
        return id;
      },
      
      updateContactLens: (id, lens) => {
        set((state) => ({
          contactLenses: state.contactLenses.map(item => 
            item.id === id ? { ...item, ...lens } : item
          )
        }));
      },
      
      deleteContactLens: (id) => {
        set((state) => ({
          contactLenses: state.contactLenses.filter(item => item.id !== id)
        }));
      },
      
      searchContactLenses: (query) => {
        if (!query) return get().contactLenses;
        
        const q = query.toLowerCase();
        return get().contactLenses.filter(lens => 
          lens.brand.toLowerCase().includes(q) || 
          lens.type.toLowerCase().includes(q) || 
          lens.power.includes(q) || 
          lens.bc.includes(q) ||
          (lens.color && lens.color.toLowerCase().includes(q))
        );
      },
      
      addService: async (service) => {
        try {
          const serviceId = await serviceService.addService({
            name: service.name,
            description: service.description || null,
            price: service.price,
            category: service.category
          });
          
          // Add to local state after successful Supabase add
          const newService: ServiceItem = {
            ...service,
            id: serviceId
          };
          
          set((state) => ({
            services: [...state.services, newService]
          }));
          
          return serviceId;
        } catch (error) {
          console.error("Error adding service:", error);
          throw error;
        }
      },
      
      updateService: async (id, updates) => {
        try {
          // Create a properly typed updates object
          const serviceUpdates: Partial<Omit<Service, 'id' | 'created_at' | 'updated_at'>> = {
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.description !== undefined && { description: updates.description || null }),
            ...(updates.price !== undefined && { price: updates.price }),
            ...(updates.category !== undefined && { category: updates.category })
          };
          
          const success = await serviceService.updateService(id, serviceUpdates);
          
          if (success) {
            set((state) => ({
              services: state.services.map(item => 
                item.id === id ? { ...item, ...updates } : item
              )
            }));
          }
          
          return success;
        } catch (error) {
          console.error(`Error updating service with ID ${id}:`, error);
          throw error;
        }
      },
      
      deleteService: async (id) => {
        try {
          const success = await serviceService.deleteService(id);
          
          if (success) {
            set((state) => ({
              services: state.services.filter(item => item.id !== id)
            }));
          }
          
          return success;
        } catch (error) {
          console.error(`Error deleting service with ID ${id}:`, error);
          throw error;
        }
      },
      
      getServiceById: async (id) => {
        try {
          const service = await serviceService.getServiceById(id);
          
          if (!service) {
            return null;
          }
          
          return {
            id: service.id,
            name: service.name,
            description: service.description || "",
            price: service.price,
            category: service.category
          };
        } catch (error) {
          console.error(`Error getting service with ID ${id}:`, error);
          throw error;
        }
      },
      
      getServicesByCategory: async (category) => {
        try {
          const services = await serviceService.getServicesByCategory(category);
          
          return services.map(service => ({
            id: service.id,
            name: service.name,
            description: service.description || "",
            price: service.price,
            category: service.category
          }));
        } catch (error) {
          console.error(`Error getting services with category ${category}:`, error);
          throw error;
        }
      },
      
      fetchLensPricingCombinations: async () => {
        set({ isLoadingLensPricingCombinations: true });
        try {
          const combinations = await lensService.getAllLensPricingCombinations();
          set({ lensPricingCombinations: combinations, isLoadingLensPricingCombinations: false });
        } catch (error) {
          console.error("Error fetching lens pricing combinations:", error);
          set({ isLoadingLensPricingCombinations: false });
        }
      },
      
      addLensPricingCombination: (combination) => {
        const id = `combo${Date.now()}`;
        
        set((state) => ({
          lensPricingCombinations: [...state.lensPricingCombinations, { ...combination, id }]
        }));
        
        return id;
      },
      
      updateLensPricingCombination: (id, combination) => {
        set((state) => ({
          lensPricingCombinations: state.lensPricingCombinations.map(item => 
            item.id === id ? { ...item, ...combination } : item
          )
        }));
      },
      
      deleteLensPricingCombination: (id) => {
        set((state) => ({
          lensPricingCombinations: state.lensPricingCombinations.filter(item => item.id !== id)
        }));
      },
      
      getLensPricingCombinations: () => {
        return get().lensPricingCombinations;
      },
      
      getLensPricingByComponents: (lensTypeId: string, coatingId: string, thicknessId: string) => {
        const combination = get().lensPricingCombinations.find(
          c => c.lensTypeId === lensTypeId && 
               c.coatingId === coatingId && 
               c.thicknessId === thicknessId
        );
        
        if (combination) {
          return combination.price;
        }
        
        return null;
      },
      
      cleanupSamplePhotochromicCoatings: () => {
        const state = get();
        
        const sampleCoatingIds = state.lensCoatings
          .filter(coating => coating.name === "Sample Photochromic" && coating.isPhotochromic)
          .map(coating => coating.id);
        
        if (sampleCoatingIds.length > 0) {
          const updatedCombinations = state.lensPricingCombinations.filter(
            combo => !sampleCoatingIds.includes(combo.coatingId)
          );
          
          const updatedCoatings = state.lensCoatings.filter(
            coating => !sampleCoatingIds.includes(coating.id)
          );
          
          set({
            lensCoatings: updatedCoatings,
            lensPricingCombinations: updatedCombinations
          });
        }
      },
      
      resetLensPricing: () => {
        // Now this will fetch fresh pricing data from the database
        get().fetchLensPricingCombinations();
      },
      
      fetchServices: async () => {
        set({ isLoadingServices: true });
        try {
          const services = await serviceService.getAllServices();
          set({ 
            services: services.map(service => ({
              id: service.id,
              name: service.name,
              description: service.description || "",
              price: service.price,
              category: service.category
            })), 
            isLoadingServices: false 
          });
        } catch (error) {
          console.error("Error fetching services:", error);
          set({ isLoadingServices: false });
        }
      },
    }),
    {
      name: 'inventory-store',
      version: 3,
      partialize: (state) => {
        // Don't persist loading states or data that will be loaded from Supabase
        const {
          frames, 
          isLoadingFrames, 
          services, 
          isLoadingServices,
          lensTypes,
          isLoadingLensTypes,
          lensCoatings,
          isLoadingLensCoatings,
          lensThicknesses,
          isLoadingLensThicknesses,
          lensPricingCombinations,
          isLoadingLensPricingCombinations,
          ...rest
        } = state;
        return rest;
      }
    }
  )
);

// Add an initializer function to load data when the app starts
export const initInventoryStore = async () => {
  const {
    fetchFrames,
    fetchServices,
    fetchLensTypes,
    fetchLensCoatings,
    fetchLensThicknesses,
    fetchLensPricingCombinations
  } = useInventoryStore.getState();

  // Load all required data in parallel
  await Promise.all([
    fetchFrames(),
    fetchServices(),
    fetchLensTypes(),
    fetchLensCoatings(),
    fetchLensThicknesses(),
    fetchLensPricingCombinations()
  ]);
};
