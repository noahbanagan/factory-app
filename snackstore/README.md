# Omiyage PH storefront (front end)

Static front end for a Japanese-snack e-commerce store serving the Philippines. No build step, no backend yet.

Open `index.html` in a browser, or serve the folder (`npx serve snackstore`) so the pages can load each other.

## Pages
index · shop · product (reads the product id from the URL hash, e.g. `product.html#glico-pocky-chocolate`) · cart · about · contact · faq · shipping · blog · terms · privacy

## Files
- `assets/styles.css` design tokens (light and dark), layout, components
- `assets/products.js` catalogue (28 sample products, 8 categories), shipping regions and rates
- `assets/app.js` rendering, filters, search, cart (saved in localStorage), demo form handling
- `assets/art.js` procedural SVG packaging illustrations used as preview images (hero, product cards, journal covers)

## Placeholders to replace before launch
- Brand name "Omiyage PH", domain omiyage.ph, email and Viber number on the contact page
- DTI, BIR and FDA LTO numbers in the footer
- Product photos (procedural SVG packaging illustrations from art.js stand in for them)
- Sample reviews on the home page (swap for a verified reviews widget)
- Prices, stock and shipping rates in products.js
- Checkout: the button shows a note; payment gateway and orders come with the backend
