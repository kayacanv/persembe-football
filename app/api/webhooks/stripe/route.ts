import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/app/lib/stripe-server"
import { createServerClient } from "@/app/lib/supabase"

// This is your Stripe webhook secret for testing your endpoint locally
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") as string

  let event

  try {
    if (!endpointSecret) {
      throw new Error("Stripe webhook secret is not set")
    }

    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object

      // Check if payment was successful
      if (session.payment_status === "paid") {
        const matchPlayerId = session.metadata?.matchPlayerId

        if (matchPlayerId) {
          // Update payment status in the database
          const supabase = createServerClient()
          await supabase.from("match_players").update({ has_paid: true }).eq("id", matchPlayerId)

          console.log(`Payment successful for match player ID: ${matchPlayerId}`)
        }
      }
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
