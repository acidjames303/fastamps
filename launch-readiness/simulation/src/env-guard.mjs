const mode = process.env.CONNECT_QA_MODE || 'dry-run';
const confirm = process.env.CONNECT_QA_CONFIRM || '';

export function getMode() {
  return mode;
}

export function assertSafeMode(action = 'run') {
  if (mode === 'dry-run' || mode === 'isolated') {
    return { mode, ok: true };
  }
  if (mode === 'production-authorised' && confirm === 'QA-LAUNCH-2026') {
    return { mode, ok: true };
  }
  console.error(
    JSON.stringify({
      ok: false,
      error: `Refusing ${action}: set CONNECT_QA_MODE=dry-run|isolated, or production-authorised with CONNECT_QA_CONFIRM=QA-LAUNCH-2026`,
      mode,
    }),
  );
  process.exit(2);
}

const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isMain || process.argv[1]?.endsWith('env-guard.mjs')) {
  console.log(JSON.stringify(assertSafeMode('guard'), null, 2));
}
