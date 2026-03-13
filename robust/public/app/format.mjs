const formatters = new Map();

export function formatMoney(value, locale = undefined, currency = "USD") {
  const formatterKey = `${locale || "default"}:${currency}`;

  if (!formatters.has(formatterKey)) {
    formatters.set(formatterKey, new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }));
  }

  return formatters.get(formatterKey).format(value);
}
