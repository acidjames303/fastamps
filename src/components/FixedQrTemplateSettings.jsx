import { useEffect, useState } from 'react';
import { CheckCircle2, FileImage, Loader2, Printer, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkUploadedTemplate } from '@/lib/qrFixedTemplate';
import { getA4LabelPositions, A4_LABEL_LAYOUT } from '@/lib/qrPrintLayout';

function fieldsFor(record) {
  return {
    columns: record?.a4_columns ?? A4_LABEL_LAYOUT.columns,
    rows: record?.a4_rows ?? A4_LABEL_LAYOUT.rows,
    leftMm: record?.a4_left_mm ?? A4_LABEL_LAYOUT.leftMm,
    topMm: record?.a4_top_mm ?? A4_LABEL_LAYOUT.topMm,
    gapX: record?.a4_horizontal_gap_mm ?? A4_LABEL_LAYOUT.gapX,
    gapY: record?.a4_vertical_gap_mm ?? A4_LABEL_LAYOUT.gapY,
    averyCode: record?.avery_product_code ?? '',
  };
}

export default function FixedQrTemplateSettings({ settings, userEmail, onUpdated }) {
  const [selectedFile,setSelectedFile]=useState(null);
  const [loading,setLoading]=useState(false);
  const [showSheetOptions,setShowSheetOptions]=useState(false);
  const [sheet,setSheet]=useState(()=>fieldsFor(settings));

  useEffect(()=>setSheet(fieldsFor(settings)),[
    settings?.id,settings?.a4_columns,settings?.a4_rows,settings?.a4_left_mm,
    settings?.a4_top_mm,settings?.a4_horizontal_gap_mm,settings?.a4_vertical_gap_mm,
    settings?.avery_product_code,
  ]);

  const setField=(key,value)=>setSheet(old=>({...old,[key]:value}));

  const upload=async()=>{
    if(!selectedFile)return;
    setLoading(true);
    try {
      await checkUploadedTemplate(selectedFile);
      const {file_url}=await base44.integrations.Core.UploadFile({file:selectedFile});
      if(!file_url)throw new Error('Base44 did not provide the template file URL.');
      const now=new Date().toISOString();
      const attributes={
        template_name:selectedFile.name,
        image_url:file_url,
        uploaded_by:userEmail,
        uploaded_at:now,
        version:now,
        ...{
          a4_columns:Number(sheet.columns), a4_rows:Number(sheet.rows),
          a4_left_mm:Number(sheet.leftMm),a4_top_mm:Number(sheet.topMm),
          a4_horizontal_gap_mm:Number(sheet.gapX),a4_vertical_gap_mm:Number(sheet.gapY),
          avery_product_code:sheet.averyCode.trim(),
        },
      };
      if(settings?.id)await base44.entities.QrLabelTemplate.update(settings.id,attributes);
      else await base44.entities.QrLabelTemplate.create(attributes);
      setSelectedFile(null);
      await onUpdated();
      toast.success('Fixed artwork uploaded. All QR labels will keep this image and change only the QR, serial and PIN.');
    }catch(error){
      toast.error(error?.response?.data?.error||error.message||'Template upload failed.');
    }finally{setLoading(false);}
  };

  const saveSheet=async()=>{
    setLoading(true);
    try {
      getA4LabelPositions({
        columns:Number(sheet.columns),rows:Number(sheet.rows),
        leftMm:Number(sheet.leftMm),topMm:Number(sheet.topMm),
        gapX:Number(sheet.gapX),gapY:Number(sheet.gapY),
      });
      if (!settings?.id)throw new Error('Upload the fixed background artwork before saving Avery settings.');
      await base44.entities.QrLabelTemplate.update(settings.id,{
        a4_columns:Number(sheet.columns),a4_rows:Number(sheet.rows),
        a4_left_mm:Number(sheet.leftMm),a4_top_mm:Number(sheet.topMm),
        a4_horizontal_gap_mm:Number(sheet.gapX),a4_vertical_gap_mm:Number(sheet.gapY),
        avery_product_code:sheet.averyCode.trim(),
      });
      await onUpdated();
      toast.success('A4 label-paper positioning saved.');
    }catch(error){toast.error(error?.response?.data?.error||error.message||'Unable to save paper settings.');}
    finally{setLoading(false);}
  };

  return (
    <section className="rounded-2xl border border-border bg-muted/35 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-2">
        <FileImage className="mt-1 h-5 w-5 text-accent"/>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Fixed QR label artwork</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One image for every charger, exactly 2 × 3 inches. The original logo, words, colours and layout never get redrawn.
            Only the QR code, serial number and PIN are replaced.
          </p>
        </div>
        {settings?.image_url&&<span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4"/> Template active</span>}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        {settings?.image_url ? <img src={settings.image_url} alt="Current fixed warranty label artwork" className="h-auto w-28 shrink-0 rounded border border-border bg-white"/> :
          <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-background text-xs text-muted-foreground">No template uploaded</div>}
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {settings?.image_url
              ? <>Installed: <strong>{settings.template_name}</strong>. Uploading another background replaces the design for all future previews and printouts, not the saved charger records.</>
              : <>To install your approved picture exactly, upload the <strong>1024 × 1536 px original with an empty QR square and the SERIAL/PIN placeholders</strong>. Printing requires the approved image; the app will never substitute a recreated design.</>}
          </p>
          <label className="flex max-w-lg cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-3 text-sm">
            <Upload className="h-4 w-4 text-accent"/>
            <span className="min-w-0 truncate">{selectedFile?.name || 'Choose fixed template image (PNG recommended)'}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>setSelectedFile(e.target.files?.[0]||null)}/>
          </label>
          <Button type="button" size="sm" disabled={!selectedFile||loading} onClick={upload}>
            {loading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<FileImage className="mr-2 h-4 w-4"/>}
            {settings?.image_url?'Replace fixed artwork':'Install fixed artwork'}
          </Button>
          <p className="text-xs text-muted-foreground">No label-design studio. This is a one-time template upload. QR codes remain unique, linked to their manufacturer serial and six-digit PIN.</p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <Button type="button" size="sm" variant="outline" onClick={()=>setShowSheetOptions(x=>!x)}>
          <Printer className="mr-2 h-4 w-4"/>{showSheetOptions?'Hide':'Configure'} Avery A4 sheet alignment
        </Button>
        {showSheetOptions&&<div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">All labels are exactly 50.8 × 76.2 mm. Avery has multiple sheet layouts. Enter the dimensions from your specific pack; the defaults are a generic centred 3 × 3 A4 arrangement, not a verified Avery product template.</p>
          <label className="block max-w-xs text-xs font-medium">Avery product number (optional)
            <Input className="mt-1 bg-background" value={sheet.averyCode} onChange={e=>setField('averyCode',e.target.value)} placeholder="Enter the number on your Avery pack"/>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['columns','Columns',1],['rows','Rows',1],
              ['leftMm','Left margin (mm)',0.1],['topMm','Top margin (mm)',0.1],
              ['gapX','Column gap (mm)',0.1],['gapY','Row gap (mm)',0.1],
            ].map(([key,label,step])=>
              <label key={key} className="text-xs font-medium">{label}
                <Input type="number" min="0" max="297" step={step} value={sheet[key]}
                  className="mt-1 bg-background" onChange={e=>setField(key,e.target.value)}/>
              </label>)}
          </div>
          <Button type="button" onClick={saveSheet} disabled={loading||!settings?.id} size="sm">
            Save print positioning
          </Button>
          <p className="text-xs text-muted-foreground">Always print at 100% / Actual size and check a test sheet with a ruler before printing an entire batch.</p>
        </div>}
      </div>
    </section>
  );
}
