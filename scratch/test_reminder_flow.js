import { createClient } from '@supabase/supabase-js';
// Loaded without dotenv

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jxekfdvorfurbkkvuawb.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4ZWtmZHZvcmZ1cmJra3Z1YXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjcxMjEsImV4cCI6MjA5OTE0MzEyMX0.r6qelkVAGAm2VVcVxbQPYqievXwXMF8G5oymE4bbr1w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log("1. Authenticating with Resend verified email...");
    const email = 'warranty471@gmail.com';
    const password = 'TestPassword123!';

    let user;
    
    // Try signing up first
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: 'Resend Test User',
          phone: '+919999999999'
        }
      }
    });

    if (signUpErr) {
      if (signUpErr.message.includes('already registered') || signUpErr.code === 'email_exists') {
        console.log("User already exists, logging in instead...");
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInErr) throw signInErr;
        user = signInData.user;
      } else {
        throw signUpErr;
      }
    } else {
      user = signUpData.user;
    }
    
    console.log(`Authenticated user: ${user.email} (${user.id})`);

    // Verify if profile is created by trigger, if not insert it
    console.log("2. Checking profile existence...");
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      console.log("Profile not found by trigger, manual insert fallback...");
      const { error: profileInsertErr } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: 'Resend Test User',
          phone: '+919999999999',
          email_reminders_enabled: true
        });
      if (profileInsertErr) throw profileInsertErr;
    }

    // Expiry target: Today + 30 days.
    // Purchase date: 2025-08-08. Warranty period: 12 months.
    // Resulting Expiry Date: 2026-08-08.
    const targetPurchaseDate = '2025-08-08';
    const targetWarrantyMonths = 12;

    console.log("3. Inserting a test item (Smart TV) to trigger a new notification email...");
    const { data: newItem, error: insertErr } = await supabase
      .from('items')
      .insert({
        user_id: user.id,
        item_name: 'Smart TV (30d)',
        category: 'Electronics',
        brand: 'Sony',
        purchase_date: targetPurchaseDate,
        warranty_period_months: targetWarrantyMonths,
        purchase_price: 45000,
        seller_store: 'Sony Center',
        notes: 'Test item for Resend sandbox.'
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    console.log(`Created test item: "${newItem.item_name}" expiring on: ${newItem.warranty_expiry_date}`);

    console.log("4. Triggering Edge Function to send email...");
    const functionUrl = `${supabaseUrl}/functions/v1/send-warranty-reminders`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({})
    });

    const resultJson = await response.json();
    console.log("5. Edge Function Response:", JSON.stringify(resultJson, null, 2));

  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

run();
