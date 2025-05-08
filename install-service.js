const path = require('path');
const os = require('os');
const Service = require('node-windows').Service;

const userHome = os.homedir(); // Lấy đường dẫn thư mục user hiện tại

const svc = new Service({
  name: 'POS PrintAgent',
  description: 'Auto-start POS Print Agent',
  script: path.join(userHome, 'pos-printagent', 'index.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

svc.on('install', () => {
  svc.start();
});

svc.install();
