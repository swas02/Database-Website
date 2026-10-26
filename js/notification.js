import { showNotification } from "./notification-helper.js";

/* Site-wide notification banner.

   HOW TO EDIT (no coding needed): change the text between the quotes in NOTIFICATION below, then save.
   - enabled:     true shows the banner, false hides it on every page.
   - type:        "info" (blue), "warning" (amber), "success" (green).
   - message:     the text shown. Keep it to one or two sentences.
   - link:        optional. Set text and url to add a link after the message, or set link to null for none.
   - dismissible: true adds a close (x) button; closing it hides it only until the page is reloaded.
*/
const NOTIFICATION = {
  enabled: true,
  type: "warning",
  message: "Under development: some features may be incomplete or contain mistakes.",
  link: null, // e.g. { text: "Report an issue", url: "https://github.com/..." }
  dismissible: false,
};

showNotification(NOTIFICATION);
