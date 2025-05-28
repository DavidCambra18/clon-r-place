# rplace-clone

Un clon de la aplicación web [r/place](https://www.reddit.com/r/place/) construido con **Node.js**, **Express**, **Socket.IO** y **Redis**. Permite pintar píxeles en un lienzo de 1000×1000, hacer zoom y pan, usar distintos tamaños de pincel, y sincronizar en tiempo real los cambios entre múltiples clientes conectados a la misma base de datos Redis.

---

## Características

- **Lienzo 1000×1000 píxeles** con escalado _pixel-perfect_ (sin suavizado).
- **Selector de color** y **tamaño de pincel** (1–5 píxeles).
- **Zoom** con rueda de ratón, **pan** con botón derecho + arrastre.
- **Sincronización en tiempo real** usando Redis Pub/Sub y Socket.IO:
  - Todos los clientes ven los nuevos píxeles instantáneamente.
  - El estado completo del lienzo se carga al conectar.
- **Persistencia** de cada píxel en un hash Redis (`pixels`) bajo la clave `"x:y"` → `#hexcolor`.
- Manejo de errores de memoria de Redis (OOM) y mensajes al cliente.

---

## Requisitos

- [Node.js](https://nodejs.org/) ≥ 14   
- [npm](https://npmjs.com/)  
- Una instancia de Redis accesible (puede ser Redis Cloud, Docker, local, etc.)

---

## Instalación

1. Clona este repositorio:
   ```bash
   git clone https://github.com/DavidCambra18/rplace-clone.git
   cd rplace-clone
