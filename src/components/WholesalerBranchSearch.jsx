import { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Search, Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { searchWholesalerFallback } from '@/lib/wholesalerDirectoryFallback';

/**
 * Searchable wholesaler + exact branch picker.
 * Preserves manual fallback fields when the directory has no match.
 */
export default function WholesalerBranchSearch({
  wholesaler,
  branch,
  manualWholesaler,
  manualBranch,
  onSelect,
  onManualChange,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showManual, setShowManual] = useState(Boolean(manualWholesaler || manualBranch));

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setResults([]);
      setSearched(false);
      return undefined;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await base44.functions.invoke('search-wholesaler-branches', {
          query: needle,
          limit: 12,
        });
        const live = response?.data?.results || response?.results || [];
        if (!cancelled) {
          setResults(live.length ? live : searchWholesalerFallback(needle, 12));
          setSearched(true);
        }
      } catch {
        if (!cancelled) {
          setResults(searchWholesalerFallback(needle, 12));
          setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const selectedLabel = useMemo(() => {
    if (wholesaler && branch) return `${wholesaler} – ${branch}`;
    return '';
  }, [wholesaler, branch]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="wholesaler-search">Preferred wholesaler and exact branch</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="wholesaler-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by wholesaler, branch, town or postcode"
            className="h-12 pl-10"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Example: Links Electrical – Shrewsbury, CEF – Shrewsbury, Edmundson Electrical – Telford.
        </p>
      </div>

      {selectedLabel ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-start gap-2">
          <Store className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div>
            <div className="font-medium">{selectedLabel}</div>
            <button
              type="button"
              className="mt-1 text-xs text-primary hover:underline"
              onClick={() => onSelect({ wholesaler: '', branch: '' })}
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching…
        </div>
      ) : null}

      {!loading && searched && results.length > 0 ? (
        <ul className="max-h-56 overflow-auto rounded-xl border border-border divide-y divide-border">
          {results.map((item) => (
            <li key={item.id || item.label}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors"
                onClick={() => {
                  onSelect({
                    wholesaler: item.wholesaler_name,
                    branch: item.branch_name,
                  });
                  setQuery('');
                  setResults([]);
                  setSearched(false);
                  setShowManual(false);
                }}
              >
                <div className="text-sm font-medium">{item.label}</div>
                {(item.town || item.postcode) ? (
                  <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[item.town, item.postcode].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && searched && results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          No matching branch found. Your other details are kept — enter the wholesaler and branch manually for FastAmps to review.
          <div className="mt-3">
            <Button type="button" variant="outline" className="h-10" onClick={() => setShowManual(true)}>
              Enter wholesaler manually
            </Button>
          </div>
        </div>
      ) : null}

      {(showManual || (!wholesaler && !branch)) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manual-wholesaler">Wholesaler company</Label>
            <Input
              id="manual-wholesaler"
              className="h-12"
              value={manualWholesaler || wholesaler || ''}
              onChange={(event) => onManualChange({
                manualWholesaler: event.target.value,
                manualBranch: manualBranch || branch || '',
              })}
              placeholder="e.g. YESSS Electrical"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-branch">Exact branch</Label>
            <Input
              id="manual-branch"
              className="h-12"
              value={manualBranch || branch || ''}
              onChange={(event) => onManualChange({
                manualWholesaler: manualWholesaler || wholesaler || '',
                manualBranch: event.target.value,
              })}
              placeholder="e.g. Birmingham"
            />
          </div>
        </div>
      )}
    </div>
  );
}
