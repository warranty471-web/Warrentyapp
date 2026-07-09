import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

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

    // Calculate search date windows
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    
    // Dates for warranty checks (30 days and 7 days from now)
    const d30 = new Date(today)
    d30.setDate(d30.getDate() + 30)
    const date30Str = d30.toISOString().split('T')[0]

    const d7 = new Date(today)
    d7.setDate(d7.getDate() + 7)
    const date7Str = d7.toISOString().split('T')[0]

    console.log(`WarrantyKeep Cron Run: ${todayStr} UTC. Target 30d Exp: ${date30Str}, Target 7d Exp: ${date7Str}`)

    const results = {
      warrantiesChecked: 0,
      warrantiesAlerted: 0,
      servicesChecked: 0,
      servicesAlerted: 0,
      emailsSent: 0,
      errors: [] as string[]
    }

    // ----------------------------------------------------
    // STEP 1: Query Expiring Items (30 days or 7 days)
    // ----------------------------------------------------
    const { data: expiringItems, error: itemsErr } = await supabase
      .from('items')
      .select('*')
      .or(`warranty_expiry_date.eq.${date30Str},warranty_expiry_date.eq.${date7Str}`)

    if (itemsErr) throw itemsErr

    results.warrantiesChecked = expiringItems?.length || 0

    if (expiringItems && expiringItems.length > 0) {
      // Gather user profiles
      const userIds = [...new Set(expiringItems.map(item => item.user_id))]
      
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles_with_emails')
        .select('*')
        .in('id', userIds)

      if (profilesErr) throw profilesErr

      const profilesMap = new Map(profiles?.map(p => [p.id, p]))

      for (const item of expiringItems) {
        const profile = profilesMap.get(item.user_id)
        if (!profile) continue

        // Calculate days left
        const expiryDate = new Date(item.warranty_expiry_date)
        const diffTime = expiryDate.getTime() - today.getTime()
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Check for existing notifications log today to prevent duplicates
        const { data: existingLog, error: logCheckErr } = await supabase
          .from('notifications_log')
          .select('id')
          .eq('item_id', item.id)
          .eq('type', 'warranty_expiring')
          .gte('sent_at', today.toISOString())
          .maybeSingle()

        if (logCheckErr) {
          results.errors.push(`Error checking logs for item ${item.id}: ${logCheckErr.message}`)
          continue
        }

        if (existingLog) {
          console.log(`Alert already sent today for item: ${item.item_name} (${item.id})`)
          continue
        }

        // Insert notifications log
        const { error: insertLogErr } = await supabase
          .from('notifications_log')
          .insert({
            user_id: item.user_id,
            item_id: item.id,
            type: 'warranty_expiring'
          })

        if (insertLogErr) {
          results.errors.push(`Error inserting log for item ${item.id}: ${insertLogErr.message}`)
          continue
        }

        results.warrantiesAlerted++

        // Send Email via Resend if email_notifications is toggled ON
        if (profile.email_notifications && profile.email && RESEND_API_KEY) {
          try {
            const subject = `Your ${item.item_name} warranty expires soon`
            const htmlContent = `
              <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #f1f5f9; border-radius: 16px; background-color: #ffffff;">
                <div style="background-color: #7c3aed; padding: 16px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">WarrantyKeep Protection</h1>
                </div>
                <h2 style="color: #0f172a; margin-top: 0;">Hi ${profile.full_name || 'there'},</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  This is a friendly reminder that the warranty for your item <strong>${item.item_name}</strong> is set to expire in <strong>${daysLeft} days</strong> (on ${new Date(item.warranty_expiry_date).toLocaleDateString()}).
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Asset Name</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${item.item_name}</td>
                    </tr>
                    ${item.brand ? `<tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Brand</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${item.brand}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Purchase Date</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${new Date(item.purchase_date).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Expiry Date</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #7c3aed; text-align: right;">${new Date(item.warranty_expiry_date).toLocaleDateString()}</td>
                    </tr>
                  </table>
                </div>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  We recommend checking the item's condition. If anything is malfunctioned, you should file a claim with the seller or brand before coverage lapses.
                </p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
                  This is an automated notification from WarrantyKeep. You can configure notification settings inside the profile screen of your mobile app.
                </p>
              </div>
            `

            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
              },
              body: JSON.stringify({
                from: 'WarrantyKeep <onboarding@resend.dev>',
                to: [profile.email],
                subject: subject,
                html: htmlContent
              })
            })

            if (res.ok) {
              results.emailsSent++
            } else {
              const resErrText = await res.text()
              results.errors.push(`Resend API Error for user ${profile.email}: ${resErrText}`)
            }
          } catch (e: any) {
            results.errors.push(`Error sending email to ${profile.email}: ${e.message}`)
          }
        }
      }
    }

    // ----------------------------------------------------
    // STEP 2: Query Due Services (Exactly 7 days from now)
    // ----------------------------------------------------
    const { data: dueServices, error: serviceErr } = await supabase
      .from('service_schedules')
      .select(`
        *,
        items (
          item_name,
          category,
          user_id
        )
      `)
      .eq('next_service_date', date7Str)

    if (serviceErr) throw serviceErr

    results.servicesChecked = dueServices?.length || 0

    if (dueServices && dueServices.length > 0) {
      // Gather user profiles
      const userIds = [...new Set(dueServices.map(s => s.items?.user_id).filter(Boolean))] as string[]
      
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles_with_emails')
        .select('*')
        .in('id', userIds)

      if (profilesErr) throw profilesErr

      const profilesMap = new Map(profiles?.map(p => [p.id, p]))

      for (const service of dueServices) {
        const itemInfo = service.items
        if (!itemInfo) continue
        
        const profile = profilesMap.get(itemInfo.user_id)
        if (!profile) continue

        // Check for existing notifications log today to prevent duplicates
        const { data: existingLog, error: logCheckErr } = await supabase
          .from('notifications_log')
          .select('id')
          .eq('item_id', service.item_id)
          .eq('type', 'service_due')
          .gte('sent_at', today.toISOString())
          .maybeSingle()

        if (logCheckErr) {
          results.errors.push(`Error checking service logs for item ${service.item_id}: ${logCheckErr.message}`)
          continue
        }

        if (existingLog) {
          console.log(`Service Alert already sent today for item: ${itemInfo.item_name} (${service.item_id})`)
          continue
        }

        // Insert notification log
        const { error: insertLogErr } = await supabase
          .from('notifications_log')
          .insert({
            user_id: itemInfo.user_id,
            item_id: service.item_id,
            type: 'service_due'
          })

        if (insertLogErr) {
          results.errors.push(`Error inserting service log for item ${service.item_id}: ${insertLogErr.message}`)
          continue
        }

        results.servicesAlerted++

        // Send Email via Resend if email_notifications is toggled ON
        if (profile.email_notifications && profile.email && RESEND_API_KEY) {
          try {
            const subject = `Maintenance Due: ${service.service_type} for ${itemInfo.item_name}`
            const htmlContent = `
              <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #f1f5f9; border-radius: 16px; background-color: #ffffff;">
                <div style="background-color: #4f46e5; padding: 16px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">WarrantyKeep Service Alert</h1>
                </div>
                <h2 style="color: #0f172a; margin-top: 0;">Hi ${profile.full_name || 'there'},</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  This is a reminder that maintenance task <strong>${service.service_type}</strong> for your asset <strong>${itemInfo.item_name}</strong> is due in <strong>7 days</strong> (on ${new Date(service.next_service_date).toLocaleDateString()}).
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Asset Name</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${itemInfo.item_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Service Task</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${service.service_type}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Frequency</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">Every ${service.frequency_months} Months</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Service Due Date</td>
                      <td style="padding: 6px 0; font-weight: bold; color: #4f46e5; text-align: right;">${new Date(service.next_service_date).toLocaleDateString()}</td>
                    </tr>
                  </table>
                </div>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  Regular maintenance helps extend the lifespan of your vehicles, appliances, and electronics, and is often a requirement to keep active warranties valid!
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  Once complete, make sure to mark the service as done in the WarrantyKeep app to update the next scheduled date.
                </p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
                  This is an automated notification from WarrantyKeep. You can configure notification settings inside the profile screen of your mobile app.
                </p>
              </div>
            `

            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
              },
              body: JSON.stringify({
                from: 'WarrantyKeep <onboarding@resend.dev>',
                to: [profile.email],
                subject: subject,
                html: htmlContent
              })
            })

            if (res.ok) {
              results.emailsSent++
            } else {
              const resErrText = await res.text()
              results.errors.push(`Resend Service API Error for user ${profile.email}: ${resErrText}`)
            }
          } catch (e: any) {
            results.errors.push(`Error sending service email to ${profile.email}: ${e.message}`)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )

  } catch (err: any) {
    console.error("Critical edge function error:", err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})
