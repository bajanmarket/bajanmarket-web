/** Event keys that have an approved WhatsApp template. Client-safe types only. */
export type WhatsAppEvent =
  | "booking_submitted"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_reschedule_requested"
  | "booking_cancelled"
  | "booking_reminder"
  | "message";

/** Secret name holding each event's Meta-approved template name. */
export const TEMPLATE_ENV_NAMES: Record<WhatsAppEvent, string> = {
  booking_submitted: "WHATSAPP_TEMPLATE_BOOKING_RECEIVED",
  booking_confirmed: "WHATSAPP_TEMPLATE_BOOKING_CONFIRMED",
  booking_declined: "WHATSAPP_TEMPLATE_BOOKING_DECLINED",
  booking_reschedule_requested: "WHATSAPP_TEMPLATE_RESCHEDULE",
  booking_cancelled: "WHATSAPP_TEMPLATE_BOOKING_CANCELLED",
  booking_reminder: "WHATSAPP_TEMPLATE_REMINDER",
  message: "WHATSAPP_TEMPLATE_NEW_MESSAGE",
};
