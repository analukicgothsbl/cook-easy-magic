import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('Unauthorized access attempt to reset-credit-bonus')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting daily credit bonus reset...')

    // Step 1: Find all users where credit_bonus.usage is not 0
    const { data: usersToReset, error: selectError } = await supabase
      .from('credit_bonus')
      .select('user_id')
      .neq('usage', 0)

    if (selectError) {
      console.error('Error selecting users to reset:', selectError)
      throw selectError
    }

    if (!usersToReset || usersToReset.length === 0) {
      console.log('No users need credit bonus reset')
      return new Response(
        JSON.stringify({ message: 'No users needed reset', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userIds = usersToReset.map(u => u.user_id)
    console.log(`Found ${userIds.length} users to reset`)

    // Step 2: Reset credit_bonus.usage to 0 for these users
    const { error: updateBonusError } = await supabase
      .from('credit_bonus')
      .update({ usage: 0, updated_at: new Date().toISOString() })
      .in('user_id', userIds)

    if (updateBonusError) {
      console.error('Error updating credit_bonus:', updateBonusError)
      throw updateBonusError
    }

    console.log(`Reset credit_bonus.usage to 0 for ${userIds.length} users`)

    // Step 3: Reset credit_wallet.daily_remaining to 1 for these same users
    const { error: updateWalletError } = await supabase
      .from('credit_wallet')
      .update({ daily_remaining: 1, updated_at: new Date().toISOString() })
      .in('user_id', userIds)

    if (updateWalletError) {
      console.error('Error updating credit_wallet:', updateWalletError)
      throw updateWalletError
    }

    console.log(`Reset credit_wallet.daily_remaining to 1 for ${userIds.length} users`)

    return new Response(
      JSON.stringify({ 
        message: 'Daily credit bonus reset completed', 
        usersReset: userIds.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in reset-credit-bonus:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
