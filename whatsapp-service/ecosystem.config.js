module.exports = {
  apps: [
    {
      name: "whatsapp-engine",
      script: "./whatsapp-service-linux-arm64",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        PORT: "5001",
        SSL_CERT_FILE: "/data/data/com.termux/files/usr/etc/tls/cert.pem",
        SSL_CERT_DIR: "/data/data/com.termux/files/usr/etc/tls/certs"
      }
    },
    {
      name: "whatsapp-tunnel",
      script: "cloudflared",
      args: "tunnel --url http://127.0.0.1:5001",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        SSL_CERT_FILE: "/data/data/com.termux/files/usr/etc/tls/cert.pem",
        SSL_CERT_DIR: "/data/data/com.termux/files/usr/etc/tls/certs"
      }
    }
  ]
};
