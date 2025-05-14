import { supabase } from '@/integrations/supabase/client';
import { Frame, FrameInsert, FrameUpdate } from '@/integrations/supabase/schema';

/**
 * Fetches all frames from the database
 */
export async function getAllFrames(): Promise<Frame[]> {
  try {
    const { data, error } = await supabase
      .from('frames')
      .select('*')
      .order('brand', { ascending: true });

    if (error) {
      console.error('Error fetching frames:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error fetching frames:', error);
    return [];
  }
}

/**
 * Search frames by brand, model, color, or size
 */
export async function searchFrames(query: string): Promise<Frame[]> {
  if (!query || query.trim() === '') return getAllFrames();

  const searchTerm = `%${query.toLowerCase()}%`;

  try {
    // Search frames by brand, model, color, or size using ilike for case-insensitive matching
    const { data, error } = await supabase
      .from('frames')
      .select('*')
      .or(`brand.ilike.${searchTerm},model.ilike.${searchTerm},color.ilike.${searchTerm},size.ilike.${searchTerm}`)
      .order('brand', { ascending: true });

    if (error) {
      console.error('Error searching frames:', error);
      return [];
    }

    return data || [];
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
    // Get all existing frames to check for duplicates
    const { data: existingFrames, error: fetchError } = await supabase
      .from('frames')
      .select('brand, model, color, size');
      
    if (fetchError) {
      console.error('Error fetching existing frames:', fetchError);
      return { added: 0, duplicates: 0, errors: 1 };
    }
    
    // Create a map of existing frames for faster lookup
    const existingFrameMap = new Map();
    (existingFrames || []).forEach(frame => {
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
 * Update frame quantity
 */
export async function updateFrameQuantity(frameId: string, newQty: number): Promise<boolean> {
  return updateFrame(frameId, { qty: newQty });
} 