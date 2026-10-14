import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';

const serverTimePlugin = () => ({
  name: 'server-time-endpoint',
  configureServer(server) {
    server.middlewares.use('/api/server-time', (req, res) => {
      // Fetch accurate real-world server time via HTTP Date header from Google/Cloud
      let responded = false;
      const sendJson = (payload) => {
        if (responded || res.headersSent) return;
        responded = true;
        try {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(payload));
        } catch (e) {}
      };

      const fetchRequest = https.request('https://www.google.com', { method: 'HEAD', timeout: 3500 }, (googleRes) => {
        const serverDateStr = googleRes.headers.date;
        const serverTimestamp = serverDateStr ? new Date(serverDateStr).getTime() : Date.now();
        sendJson({
          serverTime: new Date(serverTimestamp).toISOString(),
          serverTimestamp,
          source: 'google_cloud_header'
        });
      });

      fetchRequest.on('error', () => {
        sendJson({
          serverTime: new Date().toISOString(),
          serverTimestamp: Date.now(),
          source: 'local_fallback'
        });
      });

      fetchRequest.on('timeout', () => {
        fetchRequest.destroy();
        sendJson({
          serverTime: new Date().toISOString(),
          serverTimestamp: Date.now(),
          source: 'local_fallback'
        });
      });

      fetchRequest.end();
    });
  }
});

export default defineConfig({
  plugins: [react(), serverTimePlugin()],
  server: {
    host: true,
    port: 3000,
    open: true
  }
});
