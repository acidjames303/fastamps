// Conservative CSV import and manually reviewed wholesaler matching.
// Preserve original source text; never fuzzy-guess a branch.
export const normaliseName = (value) => String(value || '')
  .normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

const normaliseHeader = (value) => normaliseName(value).replace(/\s+/g, '_');

export function parseChargerCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const matrix = [];
  let cells = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && !cell) quoted = true;
    else if (char === ',') { cells.push(cell.trim()); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      cells.push(cell.trim());
      if (cells.some(Boolean)) matrix.push(cells);
      cells = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field. Check the source file.');
  cells.push(cell.trim());
  if (cells.some(Boolean)) matrix.push(cells);
  if (matrix.length < 2) throw new Error('CSV needs a header row and at least one charger.');
  const headers = matrix[0].map(normaliseHeader);
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error('The CSV contains missing or duplicate column headers. Every column heading must be unique.');
  }
  if (matrix.length - 1 > 10000) {
    throw new Error('Maximum CSV size is 10,000 chargers per import. Split larger files into separate manufacturing batches.');
  }
  const irregular = matrix.findIndex((row, index) => index > 0 && row.length !== headers.length);
  if (irregular >= 0) throw new Error(`CSV row ${irregular + 1} has a different number of columns from its header. Fix the original file before importing.`);
  if (!headers.includes('serial_number') && !headers.includes('serial') && !headers.includes('serial_no')) {
    throw new Error('CSV must include a serial_number column.');
  }
  if (!headers.includes('pin_code') && !headers.includes('pin') && !headers.includes('charger_pin')) {
    throw new Error('CSV must include a pin_code column.');
  }
  return matrix.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export const csvField = (row, ...names) =>
  names.map((name) => String(row?.[name] || '').trim()).find(Boolean) || '';

export function distributionFromRow(row) {
  const explicitWholesaler = csvField(row, 'wholesaler', 'supplied_to_wholesaler', 'distributor');
  const explicitCustomer = csvField(row, 'customer', 'supplied_to_customer');
  const genericSuppliedTo = csvField(row, 'supplied_to', 'supplied_to_name', 'sold_to');
  const rawType = csvField(row, 'supplied_to_type', 'supply_type').toLowerCase();
  const type = explicitWholesaler ? 'wholesaler'
    : explicitCustomer ? 'customer'
    : !genericSuppliedTo ? 'not_provided'
    : rawType === 'wholesaler' || rawType === 'customer' ? rawType : 'unspecified';
  return {
    supplied_to_type: type,
    supplied_to_name_raw: explicitWholesaler || explicitCustomer || genericSuppliedTo,
    supplied_to_branch_raw: csvField(row, 'branch', 'branch_name', 'wholesaler_branch', 'supplied_to_branch'),
    source_batch_identifier: csvField(row, 'batch_identifier', 'batch_id', 'manufacturing_batch', 'source_batch_identifier'),
  };
}

export function matchDistribution(source, directory = []) {
  const result = { ...source, distribution_branch_id: '', distribution_wholesaler_name: '', distribution_branch_name: '' };
  if (!source.supplied_to_name_raw) return { ...result, distribution_match_status: 'not_provided' };
  if (source.supplied_to_type === 'customer') return { ...result, distribution_match_status: 'customer' };
  const company = normaliseName(source.supplied_to_name_raw);
  const branch = normaliseName(source.supplied_to_branch_raw);
  const combined = normaliseName([source.supplied_to_name_raw, source.supplied_to_branch_raw].filter(Boolean).join(' '));
  const matches = directory.filter((entry) => {
    const canonicalWholesaler = normaliseName(entry.wholesaler_name);
    const canonicalBranch = normaliseName(entry.branch_name);
    const canonicalFull = normaliseName(`${entry.wholesaler_name} ${entry.branch_name}`);
    const approvedAliases = Array.isArray(entry.approved_aliases) ? entry.approved_aliases : [];
    return (branch && company === canonicalWholesaler && branch === canonicalBranch)
      || (!branch && combined === canonicalFull)
      || approvedAliases.some((alias) =>
        normaliseName(alias) === combined
        || (branch && branch === canonicalBranch && normaliseName(alias) === company));
  });
  // Zero matches and ambiguous multiple matches BOTH require human review.
  if (matches.length !== 1) return { ...result, distribution_match_status: 'needs_review' };
  const entry = matches[0];
  return {
    ...result,
    distribution_branch_id: entry.id,
    distribution_wholesaler_name: entry.wholesaler_name,
    distribution_branch_name: entry.branch_name,
    distribution_match_status: 'matched',
  };
}

export function assessSupplyAgainstClaim(charger, claim) {
  if (!charger?.supplied_to_name_raw) return { status: 'unavailable', label: 'Supply destination not recorded' };
  if (charger.supplied_to_type === 'customer') return { status: 'customer', label: 'Supplied directly to customer (not a wholesaler comparison)' };
  if (!claim.wholesaler) return { status: 'unavailable', label: 'Installer purchase wholesaler not recorded' };
  if (!['matched', 'confirmed'].includes(charger.distribution_match_status)) {
    return { status: 'review', label: 'Supply branch is unverified; manual comparison needed' };
  }
  const sameWholesaler = normaliseName(charger.distribution_wholesaler_name) === normaliseName(claim.wholesaler);
  if (!sameWholesaler) return { status: 'review', label: 'Wholesaler differs: investigate before drawing conclusions' };
  if (!claim.wholesaler_branch || !charger.distribution_branch_name) {
    return { status: 'partial', label: 'Wholesaler matches; branch not confirmed' };
  }
  if (normaliseName(charger.distribution_branch_name) !== normaliseName(claim.wholesaler_branch)) {
    return { status: 'review', label: 'Branch differs: possible transfer or naming variation' };
  }
  return { status: 'matched', label: 'Supplied and installer-reported branches match' };
}
