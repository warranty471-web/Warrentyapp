import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables.")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const thresholds = [30, 7]
    let sentCount = 0
    const errors: string[] = []

    for (const days of thresholds) {
      // Calculate target date (YYYY-MM-DD)
      const targetDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
      console.log(`Checking warranties expiring on ${targetDate} (${days} days from now)`)

      // Query items with profile joined
      const { data: items, error: fetchError } = await supabase
        .from('items')
        .select('id, item_name, warranty_expiry_date, user_id, profiles(email_reminders_enabled), category')
        .eq('warranty_expiry_date', targetDate)

      if (fetchError) {
        console.error(`Error fetching items for ${days} days:`, fetchError)
        errors.push(`Fetch items error (${days}d): ${fetchError.message}`)
        continue
      }

      for (const item of items ?? []) {
        // Skip if reminders disabled for this user
        if (item.profiles?.email_reminders_enabled === false) {
          console.log(`Skipping item ${item.item_name} (${item.id}): user reminders disabled`)
          continue
        }

        const notificationType = `warranty_expiring_${days}d`

        // Check if already notified for this item + threshold
        const { data: existing, error: checkError } = await supabase
          .from('notifications_log')
          .select('id')
          .eq('item_id', item.id)
          .eq('type', notificationType)
          .maybeSingle()

        if (checkError) {
          console.error(`Error checking logs for item ${item.id}:`, checkError)
          errors.push(`Check log error for ${item.id}: ${checkError.message}`)
          continue
        }

        if (existing) {
          console.log(`Alert already sent previously for item: ${item.item_name} (${item.id}) at ${days} days`)
          continue
        }

        // Get user email using Admin API
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(item.user_id)
        if (userError || !userData?.user?.email) {
          console.error(`Could not fetch user email for user_id ${item.user_id}:`, userError)
          errors.push(`User query error for ${item.user_id}: ${userError?.message || 'Email empty'}`)
          continue
        }

        const userEmail = userData.user.email

        // Send email via Resend
        if (RESEND_API_KEY) {
          try {
            const subject = `Your ${item.item_name} warranty expires in ${days} days`
            const htmlContent = `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f1f5f9; border-radius: 20px; background-color: #ffffff; color: #0f172a;">
                <div style="background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%); padding: 20px; border-radius: 14px; text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">WarrantyKeep Alert</h1>
                </div>
                <h2 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-top: 0;">Your Coverage is Expiring</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  Hi there,
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                  This is a reminder that the warranty for your item <strong>${item.item_name}</strong> is expiring soon.
                </p>
                
                <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">ITEM NAME</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: right;">${item.item_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">CATEGORY</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: right;">${item.category || 'Asset'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">EXPIRY DATE</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #e11d48; text-align: right;">${item.warranty_expiry_date}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">DAYS LEFT</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #e11d48; text-align: right;">${days} Days</td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 24px 0 16px 0;">
                  <a href="${req.headers.get('origin') || 'https://your-app-url.com'}" style="background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%); color: #ffffff; padding: 10px 24px; border-radius: 10px; font-weight: bold; text-decoration: none; display: inline-block; font-size: 13px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.15);">
                    Open WarrantyKeep
                  </a>
                </div>

                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 10px; text-align: center; margin: 0;">
                  This is an automated notification from WarrantyKeep. You can configure email reminder settings inside your profile.
                </p>
              </div>`

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'WarrantyKeep <onboarding@resend.dev>',
                to: [userEmail],
                subject: subject,
                html: htmlContent
              })
            })

            if (emailRes.ok) {
              // Log notification in db
              const { error: logInsertError } = await supabase
                .from('notifications_log')
                .insert({
                  user_id: item.user_id,
                  item_id: item.id,
                  type: notificationType
                })

              if (logInsertError) {
                console.error(`Failed to insert notifications log:`, logInsertError)
                errors.push(`Insert log error: ${logInsertError.message}`)
              } else {
                sentCount++
                console.log(`Successfully notified ${userEmail} for item ${item.item_name} (${days}d)`)
              }
            } else {
              const resText = await emailRes.text()
              console.error(`Resend API rejection:`, resText)
              errors.push(`Resend API error for ${userEmail}: ${resText}`)
            }
          } catch (e: any) {
            console.error(`Error calling Resend API:`, e)
            errors.push(`Resend fetch error for ${userEmail}: ${e.message}`)
          }
        } else {
          console.warn("RESEND_API_KEY is not configured in Supabase secrets. Simulating notification log insert.")
          // Fallback simulation: Log to DB anyway so user sees in-app badge
          const { error: logInsertError } = await supabase
            .from('notifications_log')
            .insert({
              user_id: item.user_id,
              item_id: item.id,
              type: notificationType
            })
          if (!logInsertError) {
            sentCount++
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )

  } catch (err: any) {
    console.error("Critical function error:", err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})
