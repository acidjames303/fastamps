/** Curated UK electrical wholesaler branches for public pre-registration search
 * when the live directory is empty or the search function is unavailable.
 * These are demand-capture entries only — not programme activations.
 */
export const WHOLESALER_DIRECTORY_FALLBACK = [
  { id: 'fb-links-shrewsbury', wholesaler_name: 'Links Electrical', branch_name: 'Shrewsbury', town: 'Shrewsbury', postcode: 'SY1', programme_availability: 'planned' },
  { id: 'fb-links-supplies-shrewsbury', wholesaler_name: 'Links Electrical Supplies Ltd', branch_name: 'Shrewsbury', town: 'Shrewsbury', postcode: 'SY1', programme_availability: 'planned' },
  { id: 'fb-cef-shrewsbury', wholesaler_name: 'CEF', branch_name: 'Shrewsbury', town: 'Shrewsbury', postcode: 'SY1', programme_availability: 'not_available' },
  { id: 'fb-edmundson-telford', wholesaler_name: 'Edmundson Electrical', branch_name: 'Telford', town: 'Telford', postcode: 'TF3', programme_availability: 'not_available' },
  { id: 'fb-yesss-birmingham', wholesaler_name: 'YESSS Electrical', branch_name: 'Birmingham', town: 'Birmingham', postcode: 'B7', programme_availability: 'not_available' },
  { id: 'fb-cef-birmingham', wholesaler_name: 'CEF', branch_name: 'Birmingham', town: 'Birmingham', postcode: 'B7', programme_availability: 'not_available' },
  { id: 'fb-edmundson-shrewsbury', wholesaler_name: 'Edmundson Electrical', branch_name: 'Shrewsbury', town: 'Shrewsbury', postcode: 'SY1', programme_availability: 'not_available' },
  { id: 'fb-yesss-telford', wholesaler_name: 'YESSS Electrical', branch_name: 'Telford', town: 'Telford', postcode: 'TF3', programme_availability: 'not_available' },
  { id: 'fb-cef-manchester', wholesaler_name: 'CEF', branch_name: 'Manchester', town: 'Manchester', postcode: 'M17', programme_availability: 'not_available' },
  { id: 'fb-edmundson-manchester', wholesaler_name: 'Edmundson Electrical', branch_name: 'Manchester', town: 'Manchester', postcode: 'M17', programme_availability: 'not_available' },
].map((row) => ({
  ...row,
  label: `${row.wholesaler_name} – ${row.branch_name}`,
}));

export function searchWholesalerFallback(query, limit = 12) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  return WHOLESALER_DIRECTORY_FALLBACK
    .filter((row) =>
      [row.wholesaler_name, row.branch_name, row.town, row.postcode, row.label]
        .join(' ')
        .toLowerCase()
        .includes(needle))
    .slice(0, limit);
}
