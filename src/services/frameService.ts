import { supabase } from '@/integrations/supabase/client';
import { Frame, FrameInsert, FrameUpdate } from '@/integrations/supabase/schema';

// PostgREST caps any single request at ~1000 rows. We page through with .range()
// so the caller can handle arbitrarily large frame catalogs.
const PAGE_SIZE = 1000;

async function fetchAllFramesPaginated(
  applyFilters?: (q: any) => any
): Promise<Frame[]> {
  const all: Frame[] = [];
  let from = 0;
  // Safety cap: 10M rows / 1000 per page = 10,000 iterations. Fine.
  while (true) {
    let query: any = supabase.from('frames').select('*');
    if (applyFilters) query = applyFilters(query);
    query = query.order('brand', { ascending: true }).range(from, from + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching frames page:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as Frame[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * Fetches all frames from the database (paginated — no row cap).
 */
export async function getAllFrames(): Promise<Frame[]> {
  try {
    return await fetchAllFramesPaginated();
  } catch (error) {
    console.error('Unexpected error fetching frames:', error);
    return [];
  }
}

/**
 * Search frames by brand, model, color, or size (paginated — no row cap).
 */
export async function searchFrames(query: string): Promise<Frame[]> {
  if (!query || query.trim() === '') return getAllFrames();

  const searchTerm = `%${query.toLowerCase()}%`;

  try {
    return await fetchAllFramesPaginated((q) =>
      q.or(
        `brand.ilike.${searchTerm},model.ilike.${searchTerm},color.ilike.${searchTerm},size.ilike.${searchTerm}`
      )
    );
  } catch (error) {
    console.error('Unexpected error searching frames:', error);
    return [];
  }
}

/**
 * Add a new frame to the database
 */
export async function addFrame(frame: Omit<FrameInsert, 'frameId' | 'createdAt'>): Promise<string | null> {
  try {
    const frameId = `FR${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    const frameData: FrameInsert = {
      ...frame,
      frameId,
      createdAt
    };
    
    const { error } = await supabase
      .from('frames')
      .insert(frameData);

    if (error) {
      console.error('Error adding frame:', error);
      return null;
    }

    return frameId;
  } catch (error) {
    console.error('Unexpected error adding frame:', error);
    return null;
  }
}

/**
 * Update an existing frame
 */
export async function updateFrame(frameId: string, frameData: Partial<Omit<FrameUpdate, 'frameId'>>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('frames')
      .update(frameData)
      .eq('frameId', frameId);

    if (error) {
      console.error('Error updating frame:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error updating frame:', error);
    return false;
  }
}

/**
 * Delete a frame
 */
export async function deleteFrame(frameId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('frames')
      .delete()
      .eq('frameId', frameId);

    if (error) {
      console.error('Error deleting frame:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error deleting frame:', error);
    return false;
  }
}

/**
 * Get frame by ID
 */
export async function getFrameById(frameId: string): Promise<Frame | null> {
  try {
    const { data, error } = await supabase
      .from('frames')
      .select('*')
      .eq('frameId', frameId)
      .single();

    if (error) {
      console.error('Error fetching frame:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error fetching frame:', error);
    return null;
  }
}

/**
 * Bulk import frames
 */
export async function bulkImportFrames(frames: Array<Omit<FrameInsert, 'frameId' | 'createdAt'>>): Promise<{ added: number, duplicates: number, errors: number }> {
  let added = 0;
  let duplicates = 0;
  let errors = 0;
  
  try {
    // Page through all existing frames (PostgREST caps at 1000 per request)
    const existingFrames: Array<Pick<Frame, 'brand' | 'model' | 'color' | 'size'>> = [];
    let from = 0;
    while (true) {
      const { data, error: fetchError } = await supabase
        .from('frames')
        .select('brand, model, color, size')
        .range(from, from + PAGE_SIZE - 1);
      if (fetchError) {
        console.error('Error fetching existing frames:', fetchError);
        return { added: 0, duplicates: 0, errors: 1 };
      }
      if (!data || data.length === 0) break;
      existingFrames.push(...(data as any));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Create a map of existing frames for faster lookup
    const existingFrameMap = new Map();
    existingFrames.forEach(frame => {
      const key = `${frame.brand.toLowerCase()}-${frame.model.toLowerCase()}-${frame.color.toLowerCase()}-${frame.size.toLowerCase()}`;
      existingFrameMap.set(key, true);
    });
    
    // Process each frame
    for (const frame of frames) {
      // Check for duplicates
      const key = `${frame.brand.toLowerCase()}-${frame.model.toLowerCase()}-${frame.color.toLowerCase()}-${frame.size.toLowerCase()}`;
      
      if (existingFrameMap.has(key)) {
        duplicates++;
        continue;
      }
      
      // Add frame to database
      const frameId = `FR${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const createdAt = new Date().toISOString();
      
      const frameData: FrameInsert = {
        ...frame,
        frameId,
        createdAt
      };
      
      const { error } = await supabase
        .from('frames')
        .insert(frameData);
      
      if (error) {
        console.error('Error adding frame during bulk import:', error);
        errors++;
      } else {
        added++;
        // Update the map to prevent duplicates within the batch
        existingFrameMap.set(key, true);
      }
    }
    
    return { added, duplicates, errors };
  } catch (error) {
    console.error('Unexpected error during bulk import:', error);
    return { added, duplicates, errors: errors + 1 };
  }
}

/**
 * Update frame quantity (negative values allowed — e.g. oversold stock).
 */
export async function updateFrameQuantity(frameId: string, newQty: number): Promise<boolean> {
  return updateFrame(frameId, { qty: newQty });
}

/**
 * Decrement stock for the first frame matching brand/model/color/size.
 * Allows qty to go negative (oversold). Returns the frameId touched, or null if no match.
 */
export async function decrementFrameStock(params: {
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  size?: string | null;
  by?: number;
}): Promise<string | null> {
  const { brand, model, color, size } = params;
  const by = params.by ?? 1;
  if (!brand || !model) return null; // need at least brand+model to identify
  try {
    let q: any = supabase
      .from('frames')
      .select('frameId, qty')
      .eq('brand', brand)
      .eq('model', model);
    if (color) q = q.eq('color', color);
    if (size) q = q.eq('size', size);
    const { data, error } = await q.limit(1);
    if (error || !data || data.length === 0) {
      if (error) console.error('decrementFrameStock lookup error:', error);
      return null;
    }
    const row = data[0] as { frameId: string; qty: number };
    const newQty = (row.qty ?? 0) - by; // negative allowed
    const ok = await updateFrameQuantity(row.frameId, newQty);
    return ok ? row.frameId : null;
  } catch (e) {
    console.error('decrementFrameStock unexpected error:', e);
    return null;
  }
}
