"use server"

import { stripe } from "@/app/lib/stripe-server"
import { createServerClient } from "../lib/supabase"

// Create a checkout session for a match payment
export async function createCheckoutSession(matchId: string, userId: string, matchPlayerId: string) {
  try {
    // Get match and user details
    const supabase = createServerClient()
    if (!supabase) {
      throw new Error("Supabase server client could not be initialized")
    }

    // Get match details
    const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).single()

    if (matchError) throw new Error("Match not found")

    // Get user details
    const { data: user, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

    if (userError) throw new Error("User not found")

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Convert price from decimal pounds to pence and add 20p commission for Stripe
    // match.price is in decimal pounds (e.g., 7.50)
    const basePrice = Math.round(match.price * 100) // Convert to pence
    const stripePrice = basePrice + 20 // Add 20p commission

    // Create a Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Perşembe Halısaha - ${match.date}`,
              description: `Football pitch fee - ${match.date} ${match.time}`,
            },
            unit_amount: stripePrice,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/match/${matchId}?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/match/${matchId}?payment_canceled=true`,
      client_reference_id: matchId,
      customer_email: user.email || undefined,
      metadata: {
        matchId,
        userId,
        matchPlayerId,
        userName: user.name,
      },
    })

    return { sessionId: session.id, url: session.url }
  } catch (error) {
    console.error("Error creating checkout session:", error)
    throw error
  }
}

// Verify payment status from Stripe
export async function verifyPaymentStatus(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status === "paid") {
      // Update the payment status in the database
      const matchId = session.metadata?.matchId
      const matchPlayerId = session.metadata?.matchPlayerId

      if (matchId && matchPlayerId) {
        const supabase = createServerClient()
        if (supabase) {
          await supabase.from("match_players").update({ has_paid: true }).eq("id", matchPlayerId)
          return { success: true }
        }
      }
    }

    return { success: false }
  } catch (error) {
    console.error("Error verifying payment status:", error)
    return { success: false, error }
  }
}

// Confirm manual payment (for Revolut)
export async function confirmManualPayment(matchPlayerId: string) {
  try {
    // Get the supabase client
    const supabase = createServerClient()
    if (!supabase) {
      console.error("Supabase client could not be initialized")
      return { success: false, error: "Database connection failed" }
    }

    // Update the payment status directly in the database
    const { error } = await supabase.from("match_players").update({ has_paid: true }).eq("id", matchPlayerId)

    if (error) {
      console.error("Error updating payment status:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Error confirming manual payment:", error)
    return { success: false, error: String(error) }
  }
}
