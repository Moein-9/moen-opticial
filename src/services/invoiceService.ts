// @ts-nocheck - TypeScript definitions for Supabase tables are incomplete

import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export interface InvoiceData {
  invoice_id: string;
  work_order_id?: string;
  patient_id?: string;
  patient_name: string;
  patient_phone?: string;
  
  invoice_type: 'glasses' | 'contacts' | 'exam' | 'repair';
  
  // Lens related fields
  lens_type?: string;
  lens_price?: number;
  
  coating?: string;
  coating_price?: number;
  coating_color?: string;
  
  thickness?: string;
  thickness_price?: number;
  
  // Frame related fields
  frame_brand?: string;
  frame_model?: string;
  frame_color?: string;
  frame_size?: string;
  frame_price?: number;
  
  // Contact lens items stored as JSON array
  contact_lens_items?: any;
  contact_lens_rx?: any;
  
  // Service information for eye exams and repairs
  service_name?: string;
  service_id?: string;
  service_description?: string;
  service_price?: number;
  
  // Repair specific fields
  repair_type?: string;
  repair_description?: string;
  repair_price?: number;
  
  // Payment information
  discount: number;
  deposit: number;
  total: number;
  remaining: number;
  
  payment_method: string;
  auth_number?: string;
  is_paid: boolean;
}

export interface WorkOrderData {
  work_order_id: string;
  patient_id?: string;
  invoice_id?: string;
  
  is_contact_lens: boolean;
  is_paid: boolean;
  
  lens_type?: any;
  contact_lenses?: any;
  contact_lens_rx?: any;
  rx?: any;
  
  coating_color?: string;
  discount?: number;
  
  status: string;
}

/**
 * Creates a new invoice in Supabase
 */
export const createInvoice = async (invoiceData: Omit<InvoiceData, 'id'>): Promise<string | null> => {
  try {
    const id = uuidv4();
    
    // Calculate remaining amount explicitly
    const total = Number(invoiceData.total) || 0;
    const deposit = Number(invoiceData.deposit) || 0;
    const remaining = Math.max(0, total - deposit);
    const isPaid = remaining === 0;

    // Process any payments data if available
    let payments = [];
    if (invoiceData.payments) {
      // Make sure we don't double-encode the payments array
      payments = Array.isArray(invoiceData.payments) ? invoiceData.payments : 
               (typeof invoiceData.payments === 'string' ? JSON.parse(invoiceData.payments) : []);
      
      // If we don't have any payments but have a deposit, create an initial payment
      if (payments.length === 0 && deposit > 0) {
        payments = [{
          date: new Date().toISOString(),
          amount: deposit,
          method: invoiceData.payment_method
        }];
      }
    } else if (deposit > 0) {
      // If no payments array but deposit exists, create an initial payment
      payments = [{
        date: new Date().toISOString(),
        amount: deposit,
        method: invoiceData.payment_method
      }];
    }
    
    console.log("Creating invoice with payments:", payments);
    
    // Convert JSON data to strings as needed
    const dataToInsert = {
      id,
      invoice_id: invoiceData.invoice_id,
      work_order_id: invoiceData.work_order_id,
      patient_id: invoiceData.patient_id,
      patient_name: invoiceData.patient_name,
      patient_phone: invoiceData.patient_phone,
      invoice_type: invoiceData.invoice_type,
      lens_type: invoiceData.lens_type,
      lens_price: invoiceData.lens_price,
      coating: invoiceData.coating,
      coating_price: invoiceData.coating_price,
      coating_color: invoiceData.coating_color,
      thickness: invoiceData.thickness,
      thickness_price: invoiceData.thickness_price,
      frame_brand: invoiceData.frame_brand,
      frame_model: invoiceData.frame_model,
      frame_color: invoiceData.frame_color,
      frame_size: invoiceData.frame_size,
      frame_price: invoiceData.frame_price,
      contact_lens_items: invoiceData.contact_lens_items,
      contact_lens_rx: invoiceData.contact_lens_rx,
      service_name: invoiceData.service_name,
      service_id: invoiceData.service_id,
      service_description: invoiceData.service_description,
      service_price: invoiceData.service_price,
      repair_type: invoiceData.repair_type,
      repair_description: invoiceData.repair_description,
      repair_price: invoiceData.repair_price,
      discount: invoiceData.discount,
      deposit: deposit,
      total: total,
      remaining: remaining,
      payment_method: invoiceData.payment_method,
      auth_number: invoiceData.auth_number,
      is_paid: isPaid,
      payments: payments.length > 0 ? payments : null  // Store as a proper array, not as a JSON string
    };

    // Using TypeScript assertion to handle type mismatch
    // @ts-ignore: We know invoices exists in Supabase but TypeScript doesn't
    const { error } = await supabase
      .from('invoices')
      .insert(dataToInsert);
      
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Invoice saved to database:', invoiceData.invoice_id);
    return invoiceData.invoice_id;
  } catch (error) {
    console.error('Error creating invoice:', error);
    toast.error('Failed to create invoice in database');
    return null;
  }
};

/**
 * Creates a new work order in Supabase
 */
export const createWorkOrder = async (workOrderData: Omit<WorkOrderData, 'id'>): Promise<string | null> => {
  try {
    const id = uuidv4();
    
    // Prepare data for insertion
    const dataToInsert = {
      id,
      work_order_id: workOrderData.work_order_id,
      patient_id: workOrderData.patient_id,
      invoice_id: workOrderData.invoice_id,
      is_contact_lens: workOrderData.is_contact_lens,
      is_paid: workOrderData.is_paid,
      lens_type: workOrderData.lens_type,
      contact_lenses: workOrderData.contact_lenses,
      contact_lens_rx: workOrderData.contact_lens_rx,
      rx: workOrderData.rx,
      coating_color: workOrderData.coating_color,
      discount: workOrderData.discount,
      status: workOrderData.status
    };
    
    // Using TypeScript assertion to handle type mismatch
    // @ts-ignore: We know work_orders exists in Supabase but TypeScript doesn't
    const { error } = await supabase
      .from('work_orders')
      .insert(dataToInsert);
      
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Work order saved to database:', workOrderData.work_order_id);
    return workOrderData.work_order_id;
  } catch (error) {
    console.error('Error creating work order:', error);
    toast.error('Failed to create work order in database');
    return null;
  }
};

/**
 * Saves an invoice and work order to Supabase and the local store
 */
export const saveOrder = async (formData: any): Promise<{invoiceId: string | null, workOrderId: string | null}> => {
  try {
    const invoiceId = `IN${Date.now()}`;
    const workOrderId = formData.invoiceType !== 'exam' ? `WO${Date.now()}` : undefined;
    
    // Calculate payment values explicitly since we don't rely on triggers anymore
    const total = Number(formData.total) || 0;
    const deposit = Number(formData.deposit) || 0;
    const remaining = Math.max(0, total - deposit);
    const isPaid = remaining === 0;
    
    // Convert form data to database structure
    const invoiceData: Omit<InvoiceData, 'id'> = {
      invoice_id: invoiceId,
      work_order_id: workOrderId,
      patient_id: formData.patientId || undefined,
      patient_name: formData.patientName,
      patient_phone: formData.patientPhone,
      
      invoice_type: formData.invoiceType,
      
      // Lens related fields
      lens_type: formData.lensType,
      lens_price: formData.lensPrice,
      
      coating: formData.coating,
      coating_price: formData.coatingPrice,
      coating_color: formData.coatingColor,
      
      thickness: formData.thickness,
      thickness_price: formData.thicknessPrice,
      
      // Frame related fields
      frame_brand: formData.frameBrand,
      frame_model: formData.frameModel,
      frame_color: formData.frameColor,
      frame_size: formData.frameSize,
      frame_price: formData.framePrice,
      
      // Contact lens items
      contact_lens_items: formData.contactLensItems ? JSON.stringify(formData.contactLensItems) : undefined,
      contact_lens_rx: formData.contactLensRx ? JSON.stringify(formData.contactLensRx) : undefined,
      
      // Service information
      service_name: formData.serviceName,
      service_id: formData.serviceId,
      service_description: formData.serviceDescription,
      service_price: formData.servicePrice,
      
      // Repair specific fields
      repair_type: formData.repairType,
      repair_description: formData.repairDescription,
      repair_price: formData.repairPrice,
      
      // Payment information
      discount: formData.discount || 0,
      deposit: deposit,
      total: total,
      remaining: remaining,
      
      payment_method: formData.paymentMethod,
      auth_number: formData.authNumber,
      is_paid: isPaid
    };
    
    // Create invoice first
    const createdInvoiceId = await createInvoice(invoiceData);
    
    // Only create work order for non-exam invoice types
    let createdWorkOrderId = null;
    if (formData.invoiceType !== 'exam') {
      const workOrderData: Omit<WorkOrderData, 'id'> = {
        work_order_id: workOrderId!,
        patient_id: formData.patientId || undefined,
        invoice_id: invoiceId,
        
        is_contact_lens: formData.invoiceType === 'contacts',
        is_paid: isPaid,
        
        lens_type: formData.invoiceType === 'glasses' ? JSON.stringify({
          name: formData.lensType,
          price: formData.lensPrice
        }) : undefined,
        
        contact_lenses: formData.contactLensItems ? JSON.stringify(formData.contactLensItems) : undefined,
        contact_lens_rx: formData.contactLensRx ? JSON.stringify(formData.contactLensRx) : undefined,
        rx: formData.rx ? JSON.stringify(formData.rx) : undefined,
        
        coating_color: formData.coatingColor,
        discount: formData.discount,
        
        status: 'pending'
      };
      
      createdWorkOrderId = await createWorkOrder(workOrderData);
    }
    
    return { 
      invoiceId: createdInvoiceId, 
      workOrderId: createdWorkOrderId 
    };
  } catch (error) {
    console.error('Error saving order:', error);
    toast.error('Failed to save order to database');
    return { invoiceId: null, workOrderId: null };
  }
};

/**
 * Get invoice by ID
 */
export const getInvoiceById = async (invoiceId: string) => {
  try {
    console.log(`Fetching invoice by ID: ${invoiceId}`);
    
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();
      
    if (error) {
      console.error(`Error fetching invoice ${invoiceId}:`, error);
      throw error;
    }
    
    console.log(`Retrieved invoice ${invoiceId}:`, {
      deposit: data.deposit,
      total: data.total,
      remaining: data.remaining,
      is_paid: data.is_paid
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return null;
  }
};

/**
 * Get work order by ID
 */
export const getWorkOrderById = async (workOrderId: string) => {
  try {
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('work_order_id', workOrderId)
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching work order:', error);
    return null;
  }
};

/**
 * Get all unpaid invoices
 */
export const getUnpaidInvoices = async () => {
  try {
    console.log("Fetching unpaid invoices from Supabase");
    
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('is_paid', false)
      .gt('remaining', 0) // Only get invoices with remaining balance greater than 0
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("Supabase error fetching unpaid invoices:", error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} unpaid invoices`);
    
    // Parse JSON strings into objects with better error handling
    return data.map(invoice => {
      try {
        // Safely parse JSON fields
        // @ts-ignore: Supabase field typing is incomplete
        const contactLensItems = invoice.contact_lens_items ? 
          // @ts-ignore: Supabase field typing is incomplete
          typeof invoice.contact_lens_items === 'string' ? 
            // @ts-ignore: Supabase field typing is incomplete
            JSON.parse(invoice.contact_lens_items) : invoice.contact_lens_items 
          : undefined;
            
        // @ts-ignore: Supabase field typing is incomplete
        const contactLensRx = invoice.contact_lens_rx ? 
          // @ts-ignore: Supabase field typing is incomplete
          typeof invoice.contact_lens_rx === 'string' ? 
            // @ts-ignore: Supabase field typing is incomplete
            JSON.parse(invoice.contact_lens_rx) : invoice.contact_lens_rx 
          : undefined;
            
        // @ts-ignore: Supabase field typing is incomplete
        const payments = invoice.payments ? 
          // @ts-ignore: Supabase field typing is incomplete
          typeof invoice.payments === 'string' ? 
            // @ts-ignore: Supabase field typing is incomplete
            JSON.parse(invoice.payments) : invoice.payments 
          : [];
          
        return {
          ...invoice,
          contact_lens_items: contactLensItems,
          contact_lens_rx: contactLensRx,
          payments: payments
        };
      } catch (parseError) {
        // @ts-ignore: Supabase field typing is incomplete
        console.error('Error parsing JSON fields for invoice:', invoice.invoice_id, parseError);
        // Return invoice with unparsed fields to avoid breaking the entire list
        return {
          ...invoice,
          contact_lens_items: undefined,
          contact_lens_rx: undefined,
          payments: []
        };
      }
    });
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    toast.error('Failed to fetch unpaid invoices');
    return [];
  }
};

/**
 * Add a payment to an invoice
 */
export const addPaymentToInvoice = async (invoiceId: string, payment: { amount: number, method: string, authNumber?: string }) => {
  try {
    // First get the current invoice
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching invoice:', fetchError);
      throw fetchError;
    }
    if (!invoice) {
      console.error('Invoice not found');
      throw new Error('Invoice not found');
    }
    
    // Create payment object with date
    const newPayment = {
      ...payment,
      date: new Date().toISOString()
    };
    
    // Parse existing payments or create empty array
    let currentPayments = [];
    try {
      // @ts-ignore: Supabase field typing is incomplete
      if (invoice.payments) {
        // @ts-ignore: Supabase field typing is incomplete
        currentPayments = typeof invoice.payments === 'string' 
          // @ts-ignore: Supabase field typing is incomplete
          ? JSON.parse(invoice.payments) 
          // @ts-ignore: Supabase field typing is incomplete
          : (Array.isArray(invoice.payments) ? invoice.payments : []);
      }
    } catch (e) {
      console.error('Error parsing payments:', e);
      // If parsing fails, just use an empty array
      currentPayments = [];
    }
    
    // Add the new payment to the array of existing payments
    const updatedPayments = [...currentPayments, newPayment];
    
    // Calculate new deposit and remaining amounts
    // @ts-ignore: Supabase field typing is incomplete
    const currentDeposit = Number(invoice.deposit) || 0;
    // @ts-ignore: Supabase field typing is incomplete
    const currentTotal = Number(invoice.total) || 0;
    const newDeposit = currentDeposit + payment.amount;
    
    // Calculate the new remaining amount - ensure it can't go below zero
    const newRemaining = Math.max(0, currentTotal - newDeposit);
    
    // Only set isPaid to true if the remaining amount is EXACTLY 0
    // This ensures partial payments don't mark the invoice as paid
    const isPaid = newRemaining === 0;
    
    console.log('Updating invoice payment:', {
      invoiceId,
      currentDeposit,
      newDeposit,
      currentTotal,
      newRemaining,
      isPaid,
      paymentsCount: updatedPayments.length
    });
    
    // Update the invoice - manually calculating all required fields
    // since we've dropped the trigger function
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        payments: updatedPayments,  // Store as a proper array, not as a JSON string
        deposit: newDeposit,
        remaining: newRemaining,
        is_paid: isPaid,
        updated_at: new Date().toISOString()
      })
      .eq('invoice_id', invoiceId);
      
    if (updateError) {
      console.error('Error updating invoice:', updateError);
      throw updateError;
    }
    
    // If this is associated with a work order, update its paid status too
    // ONLY if the invoice is fully paid
    // @ts-ignore: Supabase field typing is incomplete
    if (invoice.work_order_id && isPaid) {
      // @ts-ignore: Supabase TypeScript definitions are incomplete
      const { error: workOrderError } = await supabase
        .from('work_orders')
        .update({
          is_paid: isPaid,
          updated_at: new Date().toISOString()
        })
        // @ts-ignore: Supabase field typing is incomplete
        .eq('work_order_id', invoice.work_order_id);
        
      if (workOrderError) {
        console.error('Error updating work order:', workOrderError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error adding payment to invoice:', error);
    toast.error('Failed to add payment to invoice');
    return false;
  }
};

/**
 * Update invoice payment status
 */
export const updateInvoicePaymentStatus = async (invoiceId: string, isPaid: boolean) => {
  try {
    // @ts-ignore: We know invoices exists in Supabase but TypeScript doesn't
    const { error } = await supabase
      .from('invoices')
      .update({
        is_paid: isPaid,
        remaining: isPaid ? 0 : undefined
      })
      .eq('invoice_id', invoiceId);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error updating invoice payment status:', error);
    toast.error('Failed to update invoice payment status');
    return false;
  }
};

/**
 * Add multiple payments to an invoice at once
 */
export const addMultiplePaymentsToInvoice = async (
  invoiceId: string, 
  payments: Array<{ amount: number, method: string, authNumber?: string }>
) => {
  try {
    // Skip if no payments
    if (!payments.length) {
      return false;
    }

    // First get the current invoice
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching invoice:', fetchError);
      throw fetchError;
    }
    if (!invoice) {
      console.error('Invoice not found');
      throw new Error('Invoice not found');
    }
    
    // Parse existing payments or create empty array
    let currentPayments = [];
    try {
      // @ts-ignore: Supabase field typing is incomplete
      if (invoice.payments) {
        // @ts-ignore: Supabase field typing is incomplete
        currentPayments = typeof invoice.payments === 'string' 
          // @ts-ignore: Supabase field typing is incomplete
          ? JSON.parse(invoice.payments) 
          // @ts-ignore: Supabase field typing is incomplete
          : (Array.isArray(invoice.payments) ? invoice.payments : []);
      }
    } catch (e) {
      console.error('Error parsing payments:', e);
      // If parsing fails, just use an empty array
      currentPayments = [];
    }
    
    // Create new payment objects with dates
    const newPayments = payments.map(payment => ({
      ...payment,
      date: new Date().toISOString()
    }));
    
    // Calculate total payment amount
    const totalPaymentAmount = newPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Add all new payments to the array of existing payments
    const updatedPayments = [...currentPayments, ...newPayments];
    
    // Calculate new deposit amount
    // @ts-ignore: Supabase field typing is incomplete
    const currentDeposit = Number(invoice.deposit) || 0;
    // @ts-ignore: Supabase field typing is incomplete
    const currentTotal = Number(invoice.total) || 0;
    const newDeposit = currentDeposit + totalPaymentAmount;
    
    // Calculate remaining amount - explicitly handle it since we dropped the trigger
    const newRemaining = Math.max(0, currentTotal - newDeposit);
    const isPaid = newRemaining === 0;
    
    console.log('Updating invoice with multiple payments:', {
      invoiceId,
      currentDeposit,
      newDeposit,
      totalPaymentAmount,
      currentTotal,
      newRemaining,
      isPaid,
      paymentsCount: updatedPayments.length
    });
    
    // Update invoice with manually calculated values - no reliance on database triggers
    // @ts-ignore: Supabase TypeScript definitions are incomplete
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        deposit: newDeposit,
        remaining: newRemaining,
        is_paid: isPaid,
        payments: updatedPayments,  // Store as a proper array, not as a JSON string
        updated_at: new Date().toISOString()
      })
      .eq('invoice_id', invoiceId);
      
    if (updateError) {
      console.error('Error updating invoice deposit and payments:', updateError);
      throw updateError;
    }
    
    // Update work order if needed
    // @ts-ignore: Supabase field typing is incomplete
    if (isPaid && invoice.work_order_id) {
      // @ts-ignore: Supabase TypeScript definitions are incomplete
      const { error: workOrderError } = await supabase
        .from('work_orders')
        .update({
          is_paid: true,
          updated_at: new Date().toISOString()
        })
        // @ts-ignore: Supabase field typing is incomplete
        .eq('work_order_id', invoice.work_order_id);
        
      if (workOrderError) {
        console.error('Error updating work order payment status:', workOrderError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error adding multiple payments to invoice:', error);
    toast.error('Failed to add payments to invoice');
    return false;
  }
}; 