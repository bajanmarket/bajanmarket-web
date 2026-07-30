/**
 * Client-safe mapping from notification events to WhatsApp template events.
 * Events absent from this map are never eligible for WhatsApp delivery.
 */
import type { WhatsAppEvent } from "@/lib/whatsapp-events.types";

export const WA_EVENT_MAP: Record<string, WhatsAppEvent | undefined> = {
  message: "message",
  booking_submitted: "booking_submitted",
  booking_confirmed: "booking_confirmed",
  booking_declined: "booking_declined",
  booking_reschedule_requested: "booking_reschedule_requested",
  booking_cancelled: "booking_cancelled",
  booking_reminder: "booking_reminder",
  // Not eligible: booking_changed, booking_completed, booking_disputed.
};

export const WA_EVENT_LABELS: Record<WhatsAppEvent, string> = {
  booking_submitted: "Booking submitted",
  booking_confirmed: "Booking confirmed",
  booking_declined: "Booking declined",
  booking_reschedule_requested: "Reschedule proposed",
  booking_cancelled: "Booking cancelled",
  booking_reminder: "Appointment reminder",
  message: "New booking-related message",
};
