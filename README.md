# mtolives-book-now
The mtolives-book-now widget is a lightweight, self-hosted Web Component (Custom Element + Shadow DOM) that renders a two-field date-range picker (Check-in / Check-out) and a BOOK NOW button. It navigates to the Cloudbeds booking engine with the selected dates passed as query parameters.

## Quick start

Drop the custom element on your page and include the script. The widget opens a two-field date-range picker and sends `checkin`/`checkout` (ISO `YYYY-MM-DD`) to your booking URL.

```html
<mtolives-book-now
  book-url="https://www.mtoliveshotel.com/book-now"
  show-months="2"
  display-format="d M Y"
  min-nights="1"
  max-nights="3"
  labels="show"
  label-checkin="Arrival"
  label-checkout="Departure"
  label-choose-start="Choose arrival"
  label-choose-end="Choose departure"
  placeholder-checkin="Select arrival date"
  placeholder-checkout="Select departure date"
  style="
    --fieldW: 260px;
    --rounded: 6px;
    --accent: #808000;    /* endpoints */
    --range:  #a0ae62;    /* in-range strip */
    --hover-day: #e5ecc4; /* subtle hover */
    --shadow: 0 10px 28px rgba(0,0,0,.18);
  ">
</mtolives-book-now>

<script src="./mtolives-book-now.js?v=0.4.6" defer></script>
