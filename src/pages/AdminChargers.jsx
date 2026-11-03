import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { AlertTriangle, FileUp, Loader2, Plus, QrCode, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SheetSelect from '@/components/ui/sheet-select';
import { createBrandedQrLabel, LABEL_WIDTH_MM, LABEL_HEIGHT_MM } from '@/lib/qrLabel';
import { getA4LabelPositions, getTopStick8735Positions } from '@/lib/qrPrintLayout';
import { rotateQrForStickerPrint } from '@/lib/rotateQrForStickerPrint';
import { savePdfDocument } from '@/lib/pdfDownload';
import { createClaimUrl, GENERIC_REGISTRATION_URL } from '@/lib/appUrl';
import QrSelectionBar from '@/components/QrSelectionBar';
import QrViewer from '@/components/QrViewer';
import DistributionManager from '@/components/DistributionManager';
import FixedQrTemplateSettings from '@/components/FixedQrTemplateSettings';
import UnclaimedChargerTracking from '@/components/UnclaimedChargerTracking';
import { parseChargerCsv, distributionFromRow } from '@/lib/distributionCsv';
import { makeChargerImportRows, downloadImportIssues } from '@/lib/chargerImport';
import { listAllChargers } from '@/lib/listAllChargers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PAGE_SIZE_DEFAULT = 10;

export default function AdminChargers() {
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const queryClient = useQueryClient();

  const [singleSerial, setSingleSerial] = useState('');
  const [singlePin, setSinglePin] = useState('');
  const [singleModel, setSingleModel] = useState('Alpha 7');
  const [rows, setRows] = useState([]);
  const [csvValidation, setCsvValidation] = useState({status:'idle',issues:[],checkedBatch:'',checkedCount:0});
  const [csvMode, setCsvMode] = useState('labels');
  const [showDistributionManager, setShowDistributionManager] = useState(false);
  const [batchReference, setBatchReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [genericQr, setGenericQr] = useState('');
  const [showCreateTools, setShowCreateTools] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [printPreset, setPrintPreset] = useState('topstick8735');

  // Viewer state (DB records only; QR images generated lazily per visible page)
  const [viewerChargers, setViewerChargers] = useState([]);
  const [viewerLabel, setViewerLabel] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [page, setPage] = useState(0);
  const [qrImages, setQrImages] = useState({});
  const qrImagesRef = useRef({});

  // Selection + actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [downloadingBatch, setDownloadingBatch] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [renamingBatch, setRenamingBatch] = useState(false);

  const { data: allChargers = [] } = useQuery({
    queryKey: ['admin-chargers'],
    enabled: identity?.user?.role === 'admin',
    queryFn: listAllChargers,
  });
  const { data: templateRecords = [], isPending: templatePending, isError: templateError } = useQuery({
    queryKey: ['qr-fixed-label-template'],
    enabled: identity?.user?.role === 'admin',
    queryFn: () => base44.entities.QrLabelTemplate.list('-created_date', 5),
  });
  const currentTemplate = templateRecords[0] || null;

  // A new fixed graphic must also invalidate all per-charger preview PNG caches.
  useEffect(() => {
    qrImagesRef.current = {};
    setQrImages({});
  }, [currentTemplate?.image_url, currentTemplate?.version]);

  const { data: branchDirectory = [] } = useQuery({
    queryKey: ['wholesaler-branch-directory'],
    enabled: identity?.user?.role === 'admin',
    queryFn: () => base44.entities.WholesalerBranch.list('-created_date', 500),
  });
  const chargers = useMemo(() => allChargers.filter((charger) => !charger.excluded_from_reporting), [allChargers]);
  const labelledChargers = useMemo(() => chargers.filter((c) => c.qr_generated !== false), [chargers]);

  const availableChargers = useMemo(
    () => labelledChargers.filter((c) => (c.claim_status || 'available') === 'available'),
    [labelledChargers],
  );
  const availableChargerIds = useMemo(() => availableChargers.map((c) => c.id), [availableChargers]);
  const batchOptions = useMemo(() => {
    const groups = new Map();
    for (const charger of labelledChargers) {
      const name = charger.batch_reference || 'No batch reference';
      const existing = groups.get(name) || { name, count: 0, latest: 0 };
      existing.count += 1;
      existing.latest = Math.max(existing.latest, new Date(charger.created_date || 0).getTime() || 0);
      groups.set(name, existing);
    }
    return [...groups.values()].sort((a, b) => b.latest - a.latest);
  }, [labelledChargers]);

  const filteredViewerChargers = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return viewerChargers.filter((charger) => {
      const status = charger.claim_status || 'available';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesSearch = !needle
        || String(charger.serial_number || '').toLowerCase().includes(needle)
        || String(charger.pin_code || '').toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [viewerChargers, searchQuery, statusFilter]);

  const size = pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredViewerChargers.length / size));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * size;
  const pageItems = filteredViewerChargers.slice(pageStart, pageStart + size);
  const pageAvailableIds = pageItems.filter((c) => (c.claim_status || 'available') === 'available').map((c) => c.id);

  const selectedAvailableIds = useMemo(
    () => selectedIds.filter((id) => availableChargerIds.includes(id)),
    [selectedIds, availableChargerIds],
  );
  const allAvailableSelected = availableChargerIds.length > 0 && availableChargerIds.every((id) => selectedIds.includes(id));
  const affectedBatchNames = useMemo(() => {
    const names = new Set();
    for (const c of chargers) {
      if (selectedIds.includes(c.id) && (c.claim_status || 'available') === 'available') {
        names.add(c.batch_reference || 'No batch reference');
      }
    }
 return [...names];
  }, [chargers, selectedIds]);

  useEffect(() => {
    QRCode.toDataURL(GENERIC_REGISTRATION_URL, {
      width: 720,
      margin: 2,
      color: { dark: '#071b31', light: '#ffffff' },
    }).then(setGenericQr).catch(() => setGenericQr(''));
  }, []);

  // Open the newest saved batch automatically on first load.
  useEffect(() => {
    if (selectedBatch || !batchOptions.length) return;
    const newestBatch = batchOptions[0].name;
    setSelectedBatch(newestBatch);
    setViewerLabel(newestBatch === 'Single charger test' ? 'Single chargers' : newestBatch);
    setViewerChargers(labelledChargers.filter((charger) => (charger.batch_reference || 'No batch reference') === newestBatch));
  }, [batchOptions, labelledChargers, selectedBatch]);

  // Reset paging when the open batch or page size changes
  useEffect(() => {
    setPage(0);
  }, [selectedBatch, pageSize, searchQuery, statusFilter]);

  // Reset active label when the open batch changes
  useEffect(() => {
    setActiveIndex(0);
  }, [viewerChargers, searchQuery, statusFilter]);

  // Lazy QR generation: only render the visible page's images
  useEffect(() => {
    if (!viewerChargers.length) return;
    let cancelled = false;
    (async () => {
      for (const charger of pageItems) {
        if (charger.qr_generated === false || qrImagesRef.current[charger.id]) continue;
        try {
          const claimUrl = createClaimUrl(charger.claim_token);
          const dataUrl = await createBrandedQrLabel({
            claimUrl,
            serialNumber: charger.serial_number,
            pinCode: charger.pin_code,
            productModel: charger.product_model,
            templateUrl: currentTemplate?.image_url || null,
          });
          if (cancelled) return;
          const nextCache = { ...qrImagesRef.current, [charger.id]: dataUrl };
          while (Object.keys(nextCache).length > 150) delete nextCache[Object.keys(nextCache)[0]];
          qrImagesRef.current = nextCache;
          setQrImages(nextCache);
        } catch {
          // ignore single-label failures
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerChargers, page, pageSize, currentTemplate?.image_url, currentTemplate?.version]);

  // Arrow-key navigation across the whole open batch
  useEffect(() => {
    if (viewerChargers.length <= 1) return;
    const handleKey = (event) => {
      const target = event.target;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const currentSize = pageSize === 'all' ? viewerChargers.length : pageSize;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex((index) => {
          const next = Math.min(viewerChargers.length - 1, index + 1);
          setPage(Math.floor(next / currentSize));
          return next;
        });
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex((index) => {
          const next = Math.max(0, index - 1);
          setPage(Math.floor(next / currentSize));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewerChargers.length, pageSize]);

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (identity?.user?.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-border bg-muted/60 p-8">
        <h1 className="text-xl font-semibold">FastAmps team access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account does not have permission to manage charger QR codes.</p>
      </div>
    );
  }

  const setCachedImage = (id, dataUrl) => {
    // Limit the preview cache so browsing large registers does not keep hundreds
    // of image data URLs in memory. Printed pages are never cached here.
    const cache = { ...qrImagesRef.current };
    delete cache[id];
    cache[id] = dataUrl;
    while (Object.keys(cache).length > 150) delete cache[Object.keys(cache)[0]];
    qrImagesRef.current = cache;
    setQrImages(cache);
  };

  const getOrGenerateImage = async (charger, { forPrint = false } = {}) => {
    if (charger.qr_generated === false) throw new Error('This charger was saved without activating its QR label. Activate it first.');
    if (templatePending || templateError || !currentTemplate?.image_url) {
      throw new Error('The approved fixed FastAmps PNG has not finished loading. Please refresh QR batches and try again.');
    }
    // Print files must NEVER reuse a previously cached preview or former layout.
    if (!forPrint && qrImagesRef.current[charger.id]) return qrImagesRef.current[charger.id];
    const claimUrl = createClaimUrl(charger.claim_token);
    const dataUrl = await createBrandedQrLabel({
      claimUrl,
      serialNumber: charger.serial_number,
      pinCode: charger.pin_code,
      productModel: charger.product_model,
      templateUrl: currentTemplate?.image_url || null,
    });
    // PDF exports generate fresh files and must not retain hundreds of large PNGs.
    if (!forPrint) setCachedImage(charger.id, dataUrl);
    return dataUrl;
  };

  const scrollToViewer = () => {
    window.setTimeout(() => {
      document.getElementById('qr-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const openBatch = (target, shouldScroll = true) => {
    const list = target === 'all'
      ? labelledChargers
      : labelledChargers.filter((c) => (c.batch_reference || 'No batch reference') === target);
    if (!list.length) {
      toast.error(target === 'all' ? 'No QR codes found.' : `No QR codes in “${target}”.`);
      return;
    }
    setSelectedBatch(target);
    setViewerChargers(list);
    setViewerLabel(target === 'all' ? 'All codes' : target === 'Single charger test' ? 'Single chargers' : target);
    setActiveIndex(0);
    setPage(0);
    if (shouldScroll) scrollToViewer();
  };


  const runCsvCheck = async (items, name) => {
    const batch = String(name || '').trim();
    setCsvValidation({ status: 'checking', issues: [], checkedBatch: batch, checkedCount: 0 });
    try {
      const response = await base44.functions.invoke('import-charger-batch', {
        action: 'validate', batch_reference: batch,
        rows: makeChargerImportRows(items, branchDirectory),
      });
      const data = response?.data || response;
      setCsvValidation({ status: data.valid ? 'valid' : 'invalid', issues: data.issues || [],
        checkedBatch: batch, checkedCount: data.register_checked || 0 });
      return Boolean(data.valid);
    } catch (err) {
      const data = err?.response?.data || {};
      setCsvValidation({status:'invalid',issues:data.issues || [],checkedBatch:batch,
        checkedCount:data.register_checked || 0});
      setError(data.error || err.message || 'The entire charger register could not be checked.');
      return false;
    }
  };

  const loadCsv = async (event) => {
    setError('');
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseChargerCsv(await file.text());
      const name = file.name.replace(/\.csv$/i, '');
      setRows(parsed);
      setBatchReference(name);
      await runCsvCheck(parsed, name);
    } catch (err) {
      setRows([]);
      setCsvValidation({status:'invalid',issues:[],checkedBatch:'',checkedCount:0});
      setError(err.message || 'Could not read the CSV.');
    } finally {
      event.target.value = '';
    }
  };

  const createSingle = async () => {
    setError('');
    if (!singleSerial.trim() || !/^\d{6}$/.test(singlePin.trim())) {
      setError('Enter a serial and six-digit PIN, preserving leading zeros.');
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke('import-charger-batch', {
        action: 'import', single: true, batch_reference: 'Single charger test',
        qr_generated: true, rows: [{serial_number:singleSerial.trim().toUpperCase(),
          pin_code:singlePin.trim(),product_model:singleModel.trim() || 'Alpha 7'}],
      });
      const data = response?.data || response;
      const charger = data.chargers?.[0];
      if (!data.success || !charger) throw new Error(data.error || 'Creation was not confirmed.');
      queryClient.setQueryData(['admin-chargers'], (current = []) => [charger,...current]);
      setViewerChargers([charger]);setViewerLabel('Single chargers');
      setActiveIndex(0);setPage(0);setSelectedIds([]);setSingleSerial('');setSinglePin('');
      await queryClient.invalidateQueries({queryKey:['admin-chargers']});
      scrollToViewer();
    } catch(err) {
      const data = err?.response?.data || {};
      setError((data.issues || []).map(issue=>issue.message).join(' ') ||
        data.error || err.message || 'Unable to create this charger.');
    } finally {setSaving(false);}
  };

  const createBatch = async () => {
    setError('');
    const batch = batchReference.trim();
    if (!rows.length) {setError('Choose a CSV first.');return;}
    if (csvValidation.status !== 'valid' || csvValidation.checkedBatch !== batch) {
      await runCsvCheck(rows,batch);
      return; // Import requires an explicitly visible passed pre-flight.
    }
    setSaving(true);
    try {
      setUploadProgress({current:0,total:rows.length});
      const response = await base44.functions.invoke('import-charger-batch', {
        action:'import', batch_reference:batch, qr_generated:csvMode === 'labels',
        rows:makeChargerImportRows(rows,branchDirectory),
      });
      const data = response?.data || response;
      if (!data.success || data.created_count !== rows.length)
        throw new Error(data.error || 'The database did not confirm the full batch.');
      const created = data.chargers || [];
      queryClient.setQueryData(['admin-chargers'], (current=[])=>[...created,...current]);
      setSelectedBatch(batch);
      if (csvMode === 'labels') {
        setViewerChargers(created);setViewerLabel(batch);setActiveIndex(0);setPage(0);
      }
      setRows([]);setBatchReference('');
      setCsvValidation({status:'idle',issues:[],checkedBatch:'',checkedCount:0});
      await queryClient.invalidateQueries({queryKey:['admin-chargers']});
      if (csvMode === 'records' || created.some(c=>c.distribution_match_status==='needs_review'))
        setShowDistributionManager(true);
      toast.success(`${created.length} chargers imported after full serial and PIN checks.`);
      if (csvMode === 'labels') scrollToViewer();
    } catch(err) {
      const data = err?.response?.data || {};
      setCsvValidation({status:'invalid',issues:data.issues || [],checkedBatch:batch,
        checkedCount:data.register_checked || 0});
      setError(data.error || err.message || 'Import stopped. Recheck and correct the CSV.');
    } finally {setSaving(false);setUploadProgress({current:0,total:0});}
  };

  const recordDownloads = async (chargerIds) => {
    if (!chargerIds.length) return;
    try {
      await base44.functions.invoke('mark-qr-downloads', { charger_ids: chargerIds });
      const downloadedAt = new Date().toISOString();
      setViewerChargers((current) => current.map((c) =>
        chargerIds.includes(c.id)
          ? { ...c, qr_download_count: Number(c.qr_download_count || 0) + 1, qr_last_downloaded_at: downloadedAt }
          : c,
      ));
      await queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
    } catch {
      toast.error('The label downloaded, but its download history could not be updated.');
    }
  };

  const downloadSingle = async (charger) => {
    try {
      const dataUrl = await getOrGenerateImage(charger, { forPrint: true });
      const pdf = new jsPDF({
        orientation: 'portrait', unit: 'mm',
        format: [LABEL_WIDTH_MM, LABEL_HEIGHT_MM], compress: true,
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, LABEL_WIDTH_MM, LABEL_HEIGHT_MM, undefined, 'FAST');
      await savePdfDocument(pdf, `FastAmps-${charger.serial_number}-warranty-label-2x3in.pdf`);
      void recordDownloads([charger.id]);
      toast.success(`Exact 2 × 3-inch label for ${charger.serial_number} downloaded`);
    } catch (err) {
      toast.error(err.message || 'The label could not be downloaded.');
    }
  };

  const buildPdf = async (list, fileLabel, fileBatchName) => {
    const printable = (list || []).filter((c) => c.qr_generated !== false && c.claim_token && (c.claim_status || 'available') === 'available');
    if (!printable.length || downloadingBatch) return;
    setDownloadingBatch(true);
    try {
      // Keep the existing portrait label untouched for previews and single-label exports.
      // TopStick turns the FINAL image sideways only at batch-print export time.
      // Legacy 9-up remains available as a separate print preset.
      const isTopStick = printPreset === 'topstick8735';
      const { positions, perPage } = isTopStick
        ? getTopStick8735Positions()
        : getA4LabelPositions(currentTemplate ? {
          columns: Number(currentTemplate.a4_columns ?? 3),
          rows: Number(currentTemplate.a4_rows ?? 3),
          leftMm: Number(currentTemplate.a4_left_mm ?? 22.8),
          topMm: Number(currentTemplate.a4_top_mm ?? 28.2),
          gapX: Number(currentTemplate.a4_horizontal_gap_mm ?? 6),
          gapY: Number(currentTemplate.a4_vertical_gap_mm ?? 6),
        } : {});
      const pdf = new jsPDF({
        orientation: 'portrait', unit: 'mm', format: 'a4', compress: true,
      });

      let placed = 0;
      setPdfProgress({ current: 0, total: printable.length });
      for (let offset = 0; offset < printable.length; offset += perPage) {
        const group = printable.slice(offset, offset + perPage);
        const datas = await Promise.all(group.map((charger) => getOrGenerateImage(charger, { forPrint: true })));
        const printImages = isTopStick
          ? await Promise.all(datas.map((dataUrl) => rotateQrForStickerPrint(dataUrl)))
          : datas;
        group.forEach((charger, index) => {
          const dataUrl = printImages[index];
          if (placed > 0 && placed % perPage === 0) pdf.addPage('a4', 'portrait');
          const pos = positions[placed % perPage];
          if (isTopStick) {
            pdf.addImage(dataUrl, 'PNG', pos.imageX, pos.imageY, pos.imageWidth, pos.imageHeight, undefined, 'FAST');
          } else {
            pdf.addImage(dataUrl, 'PNG', pos.x, pos.y, LABEL_WIDTH_MM, LABEL_HEIGHT_MM, undefined, 'FAST');
          }
          placed += 1;
          setPdfProgress({ current: placed, total: printable.length });
        });
      }

      const safeBatchName = (String(fileBatchName || '').trim() || 'QR-batch')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/^-+|-+$/g, '');
      await savePdfDocument(pdf, `FastAmps-${safeBatchName}-${fileLabel}${isTopStick ? '-TopStick-8735-18up' : '-legacy-9up'}.pdf`);
      void recordDownloads(printable.map((c) => c.id));
      toast.success(isTopStick
        ? `TopStick 8735 PDF downloaded: ${printable.length} unique rotated labels, up to 18 per A4 sheet. Print at Actual size (100%).`
        : `Legacy PDF downloaded: ${printable.length} unique 2 × 3-inch labels, up to ${perPage} per A4 sheet. Print at Actual size (100%).`);
    } catch (err) {
      toast.error(err.message || 'The batch print file could not be created.');
    } finally {
      setDownloadingBatch(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  const downloadTopStickAlignmentTest = async () => {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const { positions, widthMm, heightMm } = getTopStick8735Positions();
      pdf.setDrawColor(90, 90, 90);
      pdf.setLineWidth(0.15);
      positions.forEach((pos, index) => {
        pdf.rect(pos.x, pos.y, widthMm, heightMm);
        pdf.setFontSize(7);
        pdf.text(String(index + 1), pos.x + 2, pos.y + 4);
      });
      await savePdfDocument(pdf, 'FastAmps-TopStick-8735-18up-alignment-test.pdf');
      toast.success('TopStick alignment test downloaded. Print at 100% on plain A4 paper.');
    } catch (err) { toast.error(err.message || 'Unable to export the alignment test.'); }
  };

  const downloadBatchByName = (target) => {
    let list;
    if (target === 'all') list = availableChargers;
    else list = availableChargers.filter((c) => (c.batch_reference || '') === target);
    if (!list.length) {
      toast.error('No available QR codes to download.');
      return;
    }
    return buildPdf(list, 'print-labels', target === 'all' ? 'All-batches' : target);
  };

  const downloadSelected = () => {
    const list = availableChargers.filter((c) => selectedIds.includes(c.id));
    if (!list.length) {
      toast.error('Select at least one available QR code to download.');
      return;
    }
    return buildPdf(list, 'selected-print-labels', 'Selected-QR-labels');
  };

  const downloadGenericQr = () => {
    if (!genericQr) return;
    const link = document.createElement('a');
    link.href = genericQr;
    link.download = 'FastAmps-Connect-serial-and-PIN-registration-QR.png';
    link.click();
  };

  const goToQr = (index) => {
    const clamped = Math.max(0, Math.min(filteredViewerChargers.length - 1, index));
    setActiveIndex(clamped);
    setPage(Math.floor(clamped / size));
  };

  const toggleSelect = (chargerId) => {
    if (!availableChargerIds.includes(chargerId)) return;
    setSelectedIds((current) =>
      current.includes(chargerId) ? current.filter((id) => id !== chargerId) : [...current, chargerId],
    );
  };

  const selectCurrentPage = () => {
    setSelectedIds((current) => Array.from(new Set([...current, ...pageAvailableIds])));
  };

  const selectEntireBatch = () => {
    const batchIds = viewerChargers.filter((c) => (c.claim_status || 'available') === 'available').map((c) => c.id);
    setSelectedIds((current) => Array.from(new Set([...current, ...batchIds])));
  };

  const selectAllAvailable = () => {
    setSelectedIds((current) => Array.from(new Set([...current, ...availableChargerIds])));
  };

  const clearSelection = () => setSelectedIds([]);

  const renameBatch = async (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('Enter a new batch name.');
      return;
    }
    if (trimmed === oldName) return;
    if (trimmed === 'all' || trimmed === 'No batch reference') {
      toast.error('That name is reserved. Choose a different batch name.');
      return;
    }
    if (chargers.some((c) => (c.batch_reference || '') === trimmed)) {
      toast.error(`A batch named “${trimmed}” already exists. Choose a different name.`);
      return;
    }
    const batchChargers = chargers.filter((c) => (c.batch_reference || 'No batch reference') === oldName);
    if (!batchChargers.length) {
      toast.error('That batch could not be found.');
      return;
    }
    setRenamingBatch(true);
    try {
      await base44.entities.Charger.updateMany(
        { batch_reference: oldName },
        { $set: { batch_reference: trimmed } },
      );
      setViewerChargers((current) => current.map((c) =>
        (c.batch_reference || 'No batch reference') === oldName ? { ...c, batch_reference: trimmed } : c,
      ));
      setSelectedBatch(trimmed);
      setViewerLabel(trimmed === 'Single charger test' ? 'Single chargers' : trimmed);
      await queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
      toast.success(`Batch renamed to “${trimmed}”.`);
    } catch (err) {
      toast.error(err.message || 'The batch could not be renamed.');
    } finally {
      setRenamingBatch(false);
    }
  };

  const deleteSelectedChargers = async () => {
    const idsToDelete = selectedIds.filter((id) => availableChargerIds.includes(id));
    if (!idsToDelete.length || deletingSelected) return;
    setDeletingSelected(true);
    try {
      const result = await base44.functions.invoke('retire-chargers', {charger_ids:idsToDelete});
      const data = result?.data || result;
      if(!data.success || data.deleted !== idsToDelete.length)
        throw new Error(data.error || 'Not all charger records were retired. Refresh and check the library.');
      setViewerChargers((current) => current.filter((c) => !idsToDelete.includes(c.id)));
      setSelectedIds((current) => current.filter((id) => !idsToDelete.includes(id)));
      setConfirmBulkDelete(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
      toast.success(`${idsToDelete.length} QR records retired. Their PINs and serial numbers remain blocked from reuse.`);
    } catch (err) {
      toast.error(err.message || 'The selected QR records could not all be deleted.');
    } finally {
      setDeletingSelected(false);
    }
  };

  const validRows = rows;
  const rowsWithSupply = validRows.filter((row) => distributionFromRow(row).supplied_to_name_raw).length;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Charger PINs and QR codes</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Import charger serial numbers and PINs, with optional supply destinations. Save records immediately and choose whether to activate printable QR labels now or later. Earlier batches are preserved.</p>
      </div>

      <FixedQrTemplateSettings
        settings={currentTemplate}
        userEmail={identity.user.email}
        onUpdated={async () => {
          qrImagesRef.current = {};
          setQrImages({});
          await queryClient.invalidateQueries({ queryKey: ['qr-fixed-label-template'] });
        }}
      />

      <div className="flex justify-end">
        <Button type="button" onClick={() => setShowCreateTools((open) => !open)} className="bg-primary text-white">
          {showCreateTools ? <><X className="mr-2 h-4 w-4" />Close tools</> : <><Plus className="mr-2 h-4 w-4" />Add QR codes</>}
        </Button>
      </div>

      {showCreateTools && <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-3xl border border-accent/25 bg-accent/[0.06] p-5 text-center md:p-7">
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Generic registration QR</div>
          {genericQr ? (
            <img src={genericQr} alt="Generic FastAmps Connect registration QR code" className="mx-auto mt-4 w-full max-w-48 rounded-xl bg-white p-2" />
          ) : (
            <div className="mx-auto mt-4 flex h-48 max-w-48 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Generating QR...</div>
          )}
          <p className="mt-4 text-sm leading-6 text-foreground/70">Opens manual charger registration. The installer enters both the charger serial number and six-digit PIN.</p>
          <Button onClick={downloadGenericQr} disabled={!genericQr} variant="outline" className="mt-4 w-full border-accent/25 bg-background">
            Download generic QR
          </Button>
        </article>

        <article className="rounded-3xl border border-border bg-muted/60 p-5 md:p-7">
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Single charger</div>
          <h2 className="mt-2 text-xl font-semibold">Create one PIN and QR code</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Use this route when you do not have a CSV file or want to test one charger through the complete installer claim journey.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="single-serial">Serial number</label>
              <Input id="single-serial" value={singleSerial} onChange={(event) => setSingleSerial(event.target.value)}
                placeholder="e.g. 100002056" className="mt-2 h-12 bg-background border-border" />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="single-pin">Unique PIN</label>
              <Input id="single-pin" value={singlePin} onChange={(event) => setSinglePin(event.target.value)}
                placeholder="Enter the charger PIN" className="mt-2 h-12 bg-background border-border" />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium" htmlFor="single-model">Product model</label>
            <Input id="single-model" value={singleModel} onChange={(event) => setSingleModel(event.target.value)}
              placeholder="Alpha 7" className="mt-2 h-12 bg-background border-border" />
          </div>
          <Button onClick={createSingle} disabled={saving || !singleSerial.trim() || !singlePin.trim()} className="mt-5 h-12 w-full bg-primary text-white">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><QrCode className="mr-2 h-4 w-4" />Generate single QR code</>}
          </Button>

          <div className="my-7 border-t border-border" />

          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Charger-specific QR batch</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Upload a manufacturing CSV. The original two columns still work; you can optionally include supplied-to wholesaler/customer, branch and manufacturing batch details.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-sm font-medium" htmlFor="batch-reference">Batch reference</label>
              <Input id="batch-reference" value={batchReference} onChange={(event) => {setBatchReference(event.target.value);setCsvValidation(v=>({...v,status:'stale'}));}}
                placeholder="e.g. NOVEMBER-BETA-01" className="mt-2 h-12 bg-background border-border" />
            </div>
            <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/85">
              <FileUp className="mr-2 h-4 w-4" />Choose CSV
              <input type="file" accept=".csv,text/csv" onChange={loadCsv} className="sr-only" />
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground/80">Required: <code>serial_number</code>, <code>pin_code</code> (six digits). Optional: <code>product_model</code>, <code>supplied_to</code>, <code>supplied_to_type</code> (wholesaler/customer), <code>wholesaler</code>, <code>customer</code>, <code>branch</code>, <code>batch_identifier</code>. Original text is saved for auditing.</p>
          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-background p-4">
            <div className="text-sm font-semibold">What would you like to do?</div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="csv-mode" value="labels" checked={csvMode === 'labels'} onChange={() => setCsvMode('labels')} />
              Import and generate QR labels now
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="csv-mode" value="records" checked={csvMode === 'records'} onChange={() => setCsvMode('records')} />
              Save charger records only, print QR labels later
            </label>
          </div>

          {rows.length > 0 && (
            <div className="mt-5 rounded-2xl border border-border bg-black/[0.03] dark:bg-black/10 p-4">
              <div className="mb-4 space-y-2">
                <div className={`rounded-lg border px-3 py-2 text-sm ${csvValidation.status === 'valid'
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : csvValidation.status === 'invalid' ? 'border-red-500/40 bg-red-500/10'
                    : 'border-amber-500/40 bg-amber-500/10'}`}>
                  {csvValidation.status === 'valid'
                    ? `✓ ${rows.length.toLocaleString()} rows cleared. Cross-checked against ${csvValidation.checkedCount.toLocaleString()} saved charger records. No reused serials or PINs.`
                    : csvValidation.status === 'checking' ? 'Checking every serial and PIN against the complete FastAmps charger register…'
                    : csvValidation.status === 'invalid'
                      ? `Import blocked: ${csvValidation.issues.length} invalid or duplicated values found. Nothing was created.`
                      : 'CSV must be checked against the full register before import.'}
                </div>
                {csvValidation.issues.length > 0 && (
                  <div className="space-y-2">
                    <div className="max-h-44 overflow-auto rounded border border-border bg-background p-2 text-xs">
                      {csvValidation.issues.slice(0,40).map((issue,index)=><div key={index} className="border-b border-border/60 py-1">
                        Row {issue.row || 'batch'}: {issue.field} <strong>{issue.value}</strong> — {issue.message}
                      </div>)}
                      {csvValidation.issues.length > 40 && <p>More issues are available in the CSV report.</p>}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={()=>downloadImportIssues(csvValidation.issues)}>Download error report</Button>
                  </div>
                )}
                {csvValidation.status !== 'valid' && <Button type="button" size="sm" variant="outline"
                  disabled={csvValidation.status==='checking' || saving}
                  onClick={()=>runCsvCheck(rows,batchReference)}>Recheck full register</Button>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{validRows.length} charger{validRows.length === 1 ? '' : 's'} ready</div>
                  <div className="mt-1 text-xs text-muted-foreground/80">{rowsWithSupply} rows contain optional supply information. {csvMode === 'records' ? 'Charger records will be saved but QR labels will not yet be generated.' : 'Records and QR labels will be saved together.'}</div>
                </div>
                <Button onClick={createBatch} disabled={saving || csvValidation.status !== 'valid' || csvValidation.checkedBatch !== batchReference.trim() || !rows.length} className="bg-primary text-white">
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{uploadProgress.total ? `Saving ${uploadProgress.current} of ${uploadProgress.total}` : 'Saving…'}</> : csvMode === 'records' ? <><FileUp className="mr-2 h-4 w-4" />Save records only</> : <><QrCode className="mr-2 h-4 w-4" />Generate QR codes</>}
                </Button>
              </div>
            </div>
          )}
          {error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        </article>
      </section>}

      <UnclaimedChargerTracking chargers={chargers}
        onChanged={() => queryClient.invalidateQueries({queryKey:['admin-chargers']})}/>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => setShowDistributionManager((open) => !open)}>
          <FileUp className="mr-2 h-4 w-4" />{showDistributionManager ? 'Hide distribution tracking' : 'Distribution tracking (optional)'}
        </Button>
      </div>
      {showDistributionManager && (
        <DistributionManager
          chargers={chargers}
          onGenerated={(name, items) => {
            setSelectedBatch(name);
            setViewerLabel(name);
            setViewerChargers([...items, ...labelledChargers.filter((c) => (c.batch_reference || 'No batch reference') === name)]);
            setPage(0);
            scrollToViewer();
          }}
          onRecordChanged={(updated) => {
            if (updated) setViewerChargers((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
          }}
        />
      )}

      {labelledChargers.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">QR Code Library</h2>
            <p className="mt-2 text-sm text-muted-foreground">The approved label stays upright in the app and for individual downloads. Batch printing defaults to TopStick 8735: 18 sideways labels (63.5 × 46.6 mm) on A4. The original 9-up option remains available. Always print at <strong>100% / Actual size</strong> and check a test sheet.</p>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <SheetSelect
              className="min-w-[260px]"
              label="A4 batch print format"
              value={printPreset}
              onChange={setPrintPreset}
              options={[
                { value: 'topstick8735', label: 'TopStick 8735 — 18 sideways labels / A4' },
                { value: 'legacy9up', label: 'Original 9-up A4 layout (legacy)' },
              ]}
            />
            {printPreset === 'topstick8735' && (
              <Button type="button" variant="outline" size="sm" onClick={downloadTopStickAlignmentTest}>
                Download alignment test
              </Button>
            )}
            <p className="text-xs text-muted-foreground">This affects PDF batch downloads only. Preview and individual labels stay upright.</p>
          </div>

          {selectedIds.length > 0 && <QrSelectionBar
            selectedCount={selectedIds.length}
            hasOpenViewer={viewerChargers.length > 0}
            pageAvailableCount={pageAvailableIds.length}
            batchAvailableCount={viewerChargers.filter((c) => (c.claim_status || 'available') === 'available').length}
            allAvailableCount={availableChargerIds.length}
            allAvailableSelected={allAvailableSelected}
            onSelectPage={selectCurrentPage}
            onSelectBatch={selectEntireBatch}
            onSelectAll={selectAllAvailable}
            onClear={clearSelection}
            onDownloadSelected={downloadSelected}
            onDeleteSelected={() => setConfirmBulkDelete(true)}
            downloading={downloadingBatch}
            deleting={deletingSelected}
          />}

          {viewerChargers.length > 0 && (
            <QrViewer
              chargers={filteredViewerChargers}
              images={qrImages}
              activeIndex={activeIndex}
              onGoTo={goToQr}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              page={safePage}
              onPageChange={setPage}
              totalPages={totalPages}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onDownloadSingle={downloadSingle}
              onDownloadAll={() => buildPdf(filteredViewerChargers, 'print-labels', viewerLabel)}
              downloading={downloadingBatch}
              downloadProgress={pdfProgress}
              batchLabel={viewerLabel}
              selectedBatch={selectedBatch}
              batchOptions={batchOptions}
              totalLibraryCount={labelledChargers.length}
              onBatchChange={(value) => openBatch(value, false)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              onRenameBatch={renameBatch}
              renamingBatch={renamingBatch}
            />
          )}
        </section>
      )}

      <AlertDialog open={confirmBulkDelete} onOpenChange={(open) => { if (!deletingSelected) setConfirmBulkDelete(open); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Delete {selectedAvailableIds.length} selected QR record{selectedAvailableIds.length === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-foreground/70">
              <span className="block">This permanently removes the selected charger records from {affectedBatchNames.length === 1 ? 'the batch' : 'these batches'}: <span className="font-semibold text-foreground">{affectedBatchNames.join(', ')}</span>.</span>
              <span className="mt-2 block">Any printed QR codes linked to them will stop working and can no longer be used to register a warranty or claim an incentive.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel disabled={deletingSelected}>Cancel and keep records</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); deleteSelectedChargers(); }}
              disabled={deletingSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSelected
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
                : <><Trash2 className="mr-2 h-4 w-4" />Permanently delete selected</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}