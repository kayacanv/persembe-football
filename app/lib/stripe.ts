import { loadStripe } from "@stripe/stripe-js"
import { isBrowser } from "./utils/environment"

// Load Stripe on the client side
let stripePromise: ReturnType<typeof loadStripe> | null = null

export const getStripe = () => {
  if (!isBrowser) {
    return null
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (!publishableKey) {
    console.error("Stripe publishable key is missing")
    return null
  }

  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}
