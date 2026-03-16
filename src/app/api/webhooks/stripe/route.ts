import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema/subscriptions";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

/**
 * Extract the Stripe subscription ID from an invoice.
 * Stripe v20+ moved invoice.subscription to invoice.parent.subscription_details.subscription.
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * Stripe webhook endpoint for subscription lifecycle events.
 *
 * This is a standalone endpoint separate from the Better Auth catch-all
 * (which handles its own subset of events via the @better-auth/stripe plugin).
 * This handler processes events the Better Auth plugin does NOT handle.
 *
 * Handles:
 * - checkout.session.completed -- logs for monitoring
 * - invoice.paid -- marks subscription as active
 * - invoice.payment_failed -- marks subscription as past_due
 * - customer.subscription.deleted -- marks subscription as canceled
 *
 * Returns 200 even on processing errors to prevent Stripe from retrying.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();

  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(
          "[webhook] Checkout completed:",
          session.id,
          "customer:",
          session.customer
        );
        // The @better-auth/stripe plugin handles subscription creation from checkout.
        // This handler logs the event for monitoring. Additional logic (e.g., sending
        // confirmation emails) can be added here.
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const paidSubId = getSubscriptionIdFromInvoice(invoice);
        console.log(
          "[webhook] Invoice paid:",
          invoice.id,
          "subscription:",
          paidSubId
        );
        // Update subscription status to active if it was in a different state
        if (paidSubId) {
          await db
            .update(subscription)
            .set({ status: "active" })
            .where(eq(subscription.stripeSubscriptionId, paidSubId));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const failedSubId = getSubscriptionIdFromInvoice(invoice);
        console.error(
          "[webhook] Payment failed:",
          invoice.id,
          "subscription:",
          failedSubId
        );
        if (failedSubId) {
          await db
            .update(subscription)
            .set({ status: "past_due" })
            .where(eq(subscription.stripeSubscriptionId, failedSubId));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("[webhook] Subscription deleted:", sub.id);
        await db
          .update(subscription)
          .set({ status: "canceled" })
          .where(eq(subscription.stripeSubscriptionId, sub.id));
        break;
      }

      default:
        console.log("[webhook] Unhandled event type:", event.type);
    }
  } catch (err) {
    console.error("[webhook] Error processing event:", event.type, err);
    // Return 200 to prevent Stripe from retrying -- log the error for investigation
    return NextResponse.json(
      { received: true, error: "Processing error" },
      { status: 200 }
    );
  }

  return NextResponse.json({ received: true });
}
