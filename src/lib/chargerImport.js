import { csvField, distributionFromRow, matchDistribution } from './distributionCsv';

// Normalise CSV values without converting six-digit PINs to numbers.
export function makeChargerImportRows(rows, branchDirectory) {
  return rows.map((row) => {
    const distribution = matchDistribution(distributionFromRow(row), branchDirectory);
    return {
      serial_number: csvField(row, 'serial_number', 'serial', 'serial_no').toUpperCase(),
      pin_code: csvField(row, 'pin_code', 'pin', 'charger_pin'),
      product_model: csvField(row, 'product_model', 'model') || 'Alpha 7',
      ...distribution,
    };
  });
}

export function downloadImportIssues(issues, filename='FastAmps-CSV-errors.csv') {
  const headers=['CSV Row','Field','Value','Reason'];
  const items=[headers,...issues.map(issue=>[issue.row,issue.field,issue.value,issue.message])];
  const csv=items.map(cells=>cells.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
