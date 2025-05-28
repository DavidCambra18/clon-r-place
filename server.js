const express      = require('express');
const http         = require('http');
const { createClient } = require('redis');
const { Server }   = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

// URL de Redis Cloud (idéntica para todos)
const REDIS_URL =
  'redis://default:PXDrrL41saIPwp3LWywTSY9EokqyDjZm@redis-17908.c339.eu-west-3-1.ec2.redns.redis-cloud.com:17908';

// Cliente para comandos HSET / HGETALL
const redisClient = createClient({ url: REDIS_URL });
// Cliente para publicar
const pubClient   = createClient({ url: REDIS_URL });
// Cliente para suscribirse
const subClient   = createClient({ url: REDIS_URL });

(async () => {
  // Conectamos los tres clientes
  await Promise.all([
    redisClient.connect(),
    pubClient.connect(),
    subClient.connect()
  ]);
  console.log('✅ Conectados a Redis');

  // Nos suscribimos al canal 'pixel_channel'
  await subClient.subscribe('pixel_channel', message => {
    try {
      const { x, y, color } = JSON.parse(message);
      // Al recibir un mensaje de otro servidor, lo reemitimos a nuestros clientes
      io.emit('set_pixel', { x, y, color });
    } catch (err) {
      console.error('Error al parsear mensaje pub/sub:', err);
    }
  });
  console.log('🔔 Suscrito al canal pixel_channel');
})().catch(console.error);

// Servimos archivos estáticos
app.use(express.static('public'));

io.on('connection', socket => {
  console.log('🔌 Cliente conectado:', socket.id);

  // 1) Enviar estado inicial
  (async () => {
    const pixels = await redisClient.hGetAll('pixels');
    socket.emit('init_pixels', pixels);
  })();

  // 2) Cuando este cliente pinta, guardamos y publicamos
  socket.on('set_pixel', async ({ x, y, color }) => {
    const key = `${x}:${y}`;
    try {
      // Guardar en hash
      await redisClient.hSet('pixels', key, color);

      // Publicar en canal para que TODOS los servidores lo reciban
      const payload = JSON.stringify({ x, y, color });
      await pubClient.publish('pixel_channel', payload);

      // Y también reemitimos localmente (para no esperar al subClient)
      io.emit('set_pixel', { x, y, color });
    } catch (err) {
      console.error('Error en set_pixel:', err);
      if (err.message.includes('OOM command not allowed')) {
        socket.emit('error_message', 'Servidor sin memoria, usa un pincel más pequeño.');
      }
    }
  });

  socket.on('disconnect', () =>
    console.log('❌ Cliente desconectado:', socket.id)
  );
});

const PORT = process.env.PORT || 3000;
// Escuchar en todas las interfaces para que otros equipos en la LAN puedan conectarse
server.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 Server escuchando en http://localhost:${PORT}`)
);
