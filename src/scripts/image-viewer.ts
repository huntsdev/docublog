import '../styles/image-viewer.css';

const icon = (paths: string) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const zoomIcon = icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4M7.5 10.5h6M10.5 7.5v6"/>');

let viewer: HTMLDialogElement | undefined;
let enlargedImage: HTMLImageElement;
let imageButton: HTMLButtonElement;
let caption: HTMLElement;
let status: HTMLElement;
let originalTrigger: HTMLElement | undefined;

function createViewer() {
  viewer = document.createElement('dialog');
  viewer.id = 'markdown-image-viewer';
  viewer.className = 'image-viewer';
  viewer.setAttribute('aria-label', 'Image viewer');
  viewer.innerHTML = `
    <button type="button" class="image-viewer-close" aria-label="Close image viewer" autofocus>${icon('<path d="m6 6 12 12M6 18 18 6"/>')}</button>
    <figure class="image-viewer-figure">
      <p class="image-viewer-status" role="status"></p>
      <button type="button" class="image-viewer-image-button" aria-label="Close enlarged image" hidden><img class="image-viewer-image" alt="" /></button>
      <figcaption class="image-viewer-caption" id="image-viewer-caption"></figcaption>
    </figure>`;
  enlargedImage = viewer.querySelector<HTMLImageElement>('.image-viewer-image')!;
  imageButton = viewer.querySelector<HTMLButtonElement>('.image-viewer-image-button')!;
  caption = viewer.querySelector<HTMLElement>('.image-viewer-caption')!;
  status = viewer.querySelector<HTMLElement>('.image-viewer-status')!;
  viewer.addEventListener('click', () => viewer?.close());
  viewer.addEventListener('close', () => {
    document.body.classList.remove('image-viewer-open');
    enlargedImage.onload = enlargedImage.onerror = null;
    enlargedImage.removeAttribute('src');
    originalTrigger?.isConnected && originalTrigger.focus({ preventScroll: true });
    originalTrigger = undefined;
  });
  document.body.append(viewer);
  return viewer;
}

function openImage(image: HTMLImageElement, trigger: HTMLElement, source?: string) {
  const dialog = viewer || createViewer();
  originalTrigger = trigger;
  enlargedImage.alt = image.alt;
  caption.textContent = image.alt;
  caption.hidden = !image.alt;
  if (image.alt) dialog.setAttribute('aria-describedby', caption.id);
  else dialog.removeAttribute('aria-describedby');
  imageButton.hidden = true;
  status.hidden = false;
  status.textContent = 'Loading image…';
  enlargedImage.onload = () => { status.hidden = true; imageButton.hidden = false; };
  enlargedImage.onerror = () => { status.textContent = 'This image could not be loaded.'; };
  enlargedImage.src = image.dataset.zoomSrc || source || image.currentSrc || image.src;
  document.body.classList.add('image-viewer-open');
  dialog.showModal();
}

function initializeImages() {
  document.querySelectorAll<HTMLImageElement>('.prose img').forEach(image => {
    if (image.closest('[data-image-zoom], [data-no-zoom], button')) return;
    const link = image.closest<HTMLAnchorElement>('a');
    // Preserve images that link to another page; direct image links open in the viewer.
    if (link && link.href !== image.src && !/\.(avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(link.href)) return;
    const trigger = link || document.createElement('button');
    if (trigger instanceof HTMLButtonElement) {
      trigger.type = 'button';
      image.before(trigger);
      trigger.append(image);
    }
    trigger.classList.add('markdown-image-trigger');
    trigger.dataset.imageZoom = '';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'markdown-image-viewer');
    trigger.setAttribute('aria-label', image.alt ? `Enlarge image: ${image.alt}` : 'Enlarge image');
    const hint = document.createElement('span');
    hint.className = 'image-zoom-hint';
    hint.innerHTML = zoomIcon;
    hint.setAttribute('aria-hidden', 'true');
    trigger.append(hint);
    trigger.addEventListener('click', event => {
      event.preventDefault();
      openImage(image, trigger, link?.href);
    });
  });
}

initializeImages();
document.addEventListener('astro:page-load', initializeImages);
document.addEventListener('astro:before-swap', () => { viewer?.close(); viewer = undefined; });
