import QRCode from 'qrcode';

// This image is the user's finished graphic. Do not redraw typography, logo,
// rewards panels, colours, or other artwork. Only overlay QR, serial, and PIN.
// The reference source is exactly 1024 × 1536 px, including its white surround.
// The cropping rectangle excludes the presentation shadow/outer white margin.
export const FIXED_TEMPLATE_SIZE = Object.freeze({ width: 1024, height: 1536 });
const ARTWORK_CROP = Object.freeze({ x: 29, y: 36, width: 967, height: 1458 });
// The reference template has a grey 462 px placeholder outline at x=281..742,
// y=505..965. Paint over that entire outline with the QR's white quiet zone.
// The enlarged code is centred in its place and retains the required four-module
// quiet zone for reliable printing/scanning (no visible outline remains).
export const QR_BOX = Object.freeze({ x: 268, y: 491, size: 489 });
const SERIAL_MASK = Object.freeze({ x: 93, y: 1345, width: 465, height: 59 });
const PIN_MASK = Object.freeze({ x: 594, y: 1345, width: 376, height: 59 });
const COLOUR = '#081832';
// 400 dpi maintains sharp QR edges at 2×3 inches while reducing PNG work by 56%.
export const LABEL_PIXEL_SIZE = Object.freeze({width:800,height:1200});
let prepared = null;
async function loadPreparedBackground(url) {
  if (prepared?.url === url) return prepared.promise;
  const promise = (async () => {
    const image = await loadImage(url);
    verifyReferenceImage(image);
    const canvas = document.createElement('canvas');
    canvas.width = LABEL_PIXEL_SIZE.width;
    canvas.height = LABEL_PIXEL_SIZE.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The label background cannot be rendered.');
    ctx.imageSmoothingQuality = 'high';
    const {x,y,width,height} = ARTWORK_CROP;
    ctx.drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);
    return canvas;
  })();
  prepared = {url,promise};
  promise.catch(()=>{if(prepared?.promise===promise)prepared=null;});
  return promise;
}

export function verifyReferenceImage(image) {
  if (image.naturalWidth !== FIXED_TEMPLATE_SIZE.width
    || image.naturalHeight !== FIXED_TEMPLATE_SIZE.height) {
    throw new Error('Please upload the original 1024 × 1536 PNG with an empty QR area and placeholder serial/PIN, not a screenshot or resized image.');
  }
  return true;
}

function loadImage(url) {
  return new Promise((resolve,reject)=>{
    const image = new Image();
    // Base44's uploaded media is CDN hosted; CORS must be enabled for canvas exports.
    if (!url.startsWith('blob:') && !url.startsWith('data:')) image.crossOrigin='anonymous';
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('Could not load the saved warranty artwork. Check that the uploaded file is available.'));
    image.src=url;
  });
}

function fitText(ctx,text,maxWidth,initialSize,minSize) {
  let size=initialSize;
  while(size>minSize){
    ctx.font=`900 ${size}px Arial,Helvetica,sans-serif`;
    if(ctx.measureText(text).width<=maxWidth) break;
    size--;
  }
  ctx.font=`900 ${size}px Arial,Helvetica,sans-serif`;
  if(ctx.measureText(text).width>maxWidth) throw new Error('Serial number is too long to fit in the printed label.');
}

function drawUniqueQr(ctx,url) {
  const qr=QRCode.create(url,{errorCorrectionLevel:'H'});
  const modules=qr.modules.size;
  const margin=4;
  const n=modules+margin*2;
  const step=QR_BOX.size/n;
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#ffffff';
  // White background completely covers the original grey placeholder border.
  // Do not re-draw a border: the code sits directly on the white label artwork.
  ctx.fillRect(QR_BOX.x, QR_BOX.y, QR_BOX.size, QR_BOX.size);
  ctx.fillStyle='#071b31';
  for(let y=0;y<modules;y++)for(let x=0;x<modules;x++){
    if(qr.modules.get(y,x))ctx.fillRect(QR_BOX.x+(x+margin)*step,QR_BOX.y+(y+margin)*step,step+.03,step+.03);
  }
  ctx.imageSmoothingEnabled=true;
}

export async function createImageTemplateLabel({templateUrl,claimUrl,serialNumber,pinCode}) {
  if (!templateUrl) throw new Error('Please upload the approved fixed label artwork in Admin → QR batches first.');
  if (!claimUrl || !String(serialNumber||'').trim() || !/^\d{6}$/.test(String(pinCode))) {
    throw new Error('A charger-specific QR, serial number and six-digit PIN are required.');
  }
  const background = await loadPreparedBackground(templateUrl);
  const canvas=document.createElement('canvas');
  canvas.width=LABEL_PIXEL_SIZE.width;canvas.height=LABEL_PIXEL_SIZE.height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Unable to initialise print label canvas.');
  ctx.drawImage(background,0,0);
  const {x,y,width,height}=ARTWORK_CROP;
  const scaleX=canvas.width/width,scaleY=canvas.height/height;
  ctx.save();
  ctx.scale(scaleX,scaleY);
  ctx.translate(-x,-y);
  drawUniqueQr(ctx,claimUrl);

  // Only cover the two literal placeholders. 'SERIAL' and 'PIN' headings,
  // background artwork, reward text and the tiny disclaimer remain untouched.
  ctx.fillStyle='#fefefe';
  ctx.fillRect(SERIAL_MASK.x,SERIAL_MASK.y,SERIAL_MASK.width,SERIAL_MASK.height);
  ctx.fillRect(PIN_MASK.x,PIN_MASK.y,PIN_MASK.width,PIN_MASK.height);
  const serial=String(serialNumber).trim();
  ctx.textBaseline='alphabetic';
  ctx.fillStyle=COLOUR;
  ctx.textAlign='left';
  fitText(ctx,serial,450,42,18);
  ctx.fillText(serial,100,1392);
  ctx.textAlign='right';
  fitText(ctx,String(pinCode),345,42,26);
  ctx.fillText(String(pinCode),956,1392);
  ctx.restore();
  try {return canvas.toDataURL('image/png');}
  catch {throw new Error('The uploaded template host blocked print export. Re-upload the image using Base44 file storage.');}
}

export async function checkUploadedTemplate(file) {
  if(!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error('Choose the original PNG, JPG or WebP template image.');
  }
  const url=URL.createObjectURL(file);
  try {
    const img=await loadImage(url);
    verifyReferenceImage(img);
    // Reject the version with a pre-existing QR. The blank QR panel is required,
    // otherwise stale pixels could remain outside the generated QR.
    const sampling=document.createElement('canvas');
    sampling.width=1024;sampling.height=1536;
    const ctx=sampling.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0);
    const {data}=ctx.getImageData(330,550,360,360);
    let dark=0;
    for(let i=0;i<data.length;i+=4)if(data[i]<145 && data[i+1]<145 && data[i+2]<145)dark++;
    if(dark/(data.length/4)>.05) {
      throw new Error('This image still contains a QR code. Upload the version with the empty QR placeholder and SERIAL/PIN placeholders.');
    }
    return true;
  }finally {URL.revokeObjectURL(url);}
}
