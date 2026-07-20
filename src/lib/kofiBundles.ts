// Display list for "Buy Arise Points". The backend (src/data/kofiConfig.ts)
// grants AP based on the AMOUNT PAID, so these price/AP pairs must stay in sync
// with it. Base rate is 500 AP/£; bigger bundles add a bonus.
//
// `url`: point each bundle at a Ko-fi Shop item you create at that price
// (https://ko-fi.com/s/<code>). Until then they fall back to your main Ko-fi
// page — matching is note-based, so either works.

export interface KofiBundle {
  price: number;
  currency: string;
  ap: number;
  label: string;
  badge?: string;
  url: string;
}

export const KOFI_PAGE = "https://ko-fi.com/dathevinci";

export const KOFI_BUNDLES: KofiBundle[] = [
  { price: 2, currency: "GBP", ap: 1000, label: "Starter", url: KOFI_PAGE },
  { price: 5, currency: "GBP", ap: 3000, label: "Popular", badge: "+20% bonus", url: KOFI_PAGE },
  { price: 10, currency: "GBP", ap: 7000, label: "Best value", badge: "+40% bonus", url: KOFI_PAGE },
  { price: 20, currency: "GBP", ap: 16000, label: "Whale", badge: "+60% bonus", url: KOFI_PAGE },
];

export function currencySymbol(code: string): string {
  return code === "GBP" ? "£" : code === "EUR" ? "€" : code === "USD" ? "$" : `${code} `;
}
