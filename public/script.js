// public/script.js

// — Conexión Socket.IO —
// Usamos conexión relativa: se conectará al mismo origen desde el que cargaste la página
const socket = io();

// — Referencias al DOM —
const wrapper        = document.querySelector('.canvas-wrapper');
const canvas         = document.getElementById('pixelCanvas');
const ctx            = canvas.getContext('2d');
const colorPicker    = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');

// — Desactivar suavizado en el canvas para un escalado pixel-perfect —
ctx.imageSmoothingEnabled       = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled    = false;

// — Estado de zoom / pan / pintura —
let zoomLevel   = 1;
let isPanning   = false;
let panStart    = { x: 0, y: 0 };
let scrollStart = { left: 0, top: 0 };
let isPainting  = false;

// — Función para aplicar zoom redimensionando el canvas —
function updateZoom() {
  canvas.style.width  = `${canvas.width * zoomLevel}px`;
  canvas.style.height = `${canvas.height * zoomLevel}px`;
}
// Aplicamos el zoom inicial (1×)
updateZoom();

// — Socket.IO: renderizado inicial —
socket.on('init_pixels', pixels => {
  Object.entries(pixels).forEach(([key, color]) => {
    const [x, y] = key.split(':').map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
});

// — Socket.IO: cuando llegue un píxel nuevo de cualquier servidor/cliente —
socket.on('set_pixel', ({ x, y, color }) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
});

// — Socket.IO: si Redis rechaza por memoria —
socket.on('error_message', msg => alert(msg));

// — CONTROL DE RATÓN —

// Bloquear menú contextual para usar botón derecho como “pan”
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Rueda = zoom
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoomLevel = Math.max(0.2, Math.min(zoomLevel * factor, 10));
  updateZoom();
});

// Mousedown: iniciar pan (botón derecho) o pintar (botón izquierdo)
canvas.addEventListener('mousedown', e => {
  if (e.button === 2) {
    isPanning = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    scrollStart.left = wrapper.scrollLeft;
    scrollStart.top  = wrapper.scrollTop;
    wrapper.style.cursor = 'grab';
  } else if (e.button === 0) {
    isPainting = true;
    paintAtEvent(e);
  }
});

// Mousemove: realizar pan o pintura según el modo
canvas.addEventListener('mousemove', e => {
  if (isPanning) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    wrapper.scrollLeft = scrollStart.left - dx;
    wrapper.scrollTop  = scrollStart.top  - dy;
  } else if (isPainting) {
    paintAtEvent(e);
  }
});

// Mouseup: finalizar pan o pintura
window.addEventListener('mouseup', e => {
  if (e.button === 2 && isPanning) {
    isPanning = false;
    wrapper.style.cursor = 'default';
  }
  if (e.button === 0 && isPainting) {
    isPainting = false;
  }
});

// — Función para pintar un bloque (brush) y emitir cada píxel —
function paintAtEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x    = Math.floor((e.clientX - rect.left) / zoomLevel);
  const y    = Math.floor((e.clientY - rect.top)  / zoomLevel);

  // Leer y limitar el tamaño de pincel entre 1 y 5
  let brushSize = parseInt(brushSizeInput.value, 10) || 1;
  brushSize = Math.min(Math.max(brushSize, 1), 5);
  const half = Math.floor(brushSize / 2);
  const color = colorPicker.value;

  // Pintamos un bloque de brushSize×brushSize píxeles centrado en (x,y)
  for (let dy = 0; dy < brushSize; dy++) {
    for (let dx = 0; dx < brushSize; dx++) {
      const px = x + dx - half;
      const py = y + dy - half;
      // Saltar fuera de los límites
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) 
        continue;

      // Dibujo local
      ctx.fillStyle = color;
      ctx.fillRect(px, py, 1, 1);

      // Emitir al servidor para que guarde en Redis y lo publique en pub/sub
      socket.emit('set_pixel', { x: px, y: py, color });
    }
  }
}