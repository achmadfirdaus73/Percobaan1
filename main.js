const firebaseConfig = {
            apiKey: "AIzaSyCdT2nWv0fF6jZmDfslIUvRKFun18rStWs",
            authDomain: "tracking-654e3.firebaseapp.com",
            databaseURL: "https://tracking-654e3-default-rtdb.asia-southeast1.firebasedatabase.com",
            projectId: "tracking-654e3",
            storageBucket: "tracking-654e3.firebasestorage.app",
            messagingSenderId: "61074342637",
            appId: "1:61074342637:web:ee566c965c595668b5c2e4",
            measurementId: "G-Q5ZXKE7PTL"
        };

        // State management
        let appState = {
            loading: true,
            error: null,
            timeoutReached: false,
            currentUser: null,
            users: [],
            filteredUsers: [],
            map: null,
            statusChart: null,
            hourlyChart: null,
            isDarkMode: false,
            usersRef: null,
            locationDataRef: null,
            vectorSource: null,
            popupOverlay: null
        };

        // DOM Elements
        const elements = {
            loadingScreen: document.getElementById('loadingScreen'),
            errorScreen: document.getElementById('errorScreen'),
            loginScreen: document.getElementById('loginScreen'),
            dashboardScreen: document.getElementById('dashboardScreen'),
            loginBtn: document.getElementById('loginBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            darkModeToggle: document.getElementById('darkModeToggle'),
            adminProfilePicture: document.getElementById('adminProfilePicture'),
            adminName: document.getElementById('adminName'),
            totalUsers: document.getElementById('totalUsers'),
            activeUsers: document.getElementById('activeUsers'),
            inactiveUsers: document.getElementById('inactiveUsers'),
            searchInput: document.getElementById('searchInput'),
            statusFilter: document.getElementById('statusFilter'),
            exportBtn: document.getElementById('exportBtn'),
            userTableBody: document.getElementById('userTableBody'),
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage'),
            userModal: document.getElementById('userModal'),
            closeModal: document.getElementById('closeModal'),
            modalUserName: document.getElementById('modalUserName'),
            modalUserEmail: document.getElementById('modalUserEmail'),
            modalUserStatus: document.getElementById('modalUserStatus'),
            modalUserLocation: document.getElementById('modalUserLocation'),
            modalUserLastUpdate: document.getElementById('modalUserLastUpdate'),
            popupContainer: document.getElementById('popup'),
            popupContent: document.getElementById('popup-content'),
            popupCloser: document.getElementById('popup-closer'),
            timeoutMessage: document.getElementById('timeoutMessage'),
            refreshBtn: document.getElementById('refreshBtn'),
            errorMessage: document.getElementById('errorMessage')
        };

        // Initialize app
        function initApp() {
            // Check dark mode preference
            appState.isDarkMode = localStorage.getItem('darkMode') === 'true';
            if (appState.isDarkMode) {
                document.body.classList.add('dark');
                if (elements.darkModeToggle) {
                    elements.darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
                }
            }

            // Set up timeout mechanism
            const timeoutId = setTimeout(() => {
                if (appState.loading) {
                    appState.timeoutReached = true;
                    showTimeoutState();
                }
            }, 15000); // 15 seconds timeout

            // Initialize Firebase with error handling
            try {
                const firebaseApp = firebase.initializeApp(firebaseConfig);
                const auth = firebase.auth();
                const database = firebase.database();

                // Set up auth state listener
                auth.onAuthStateChanged(async (user) => {
                    clearTimeout(timeoutId);
                    
                    if (user) {
                        try {
                            // Check if user is admin
                            const adminSnapshot = await database.ref(`admins/${user.uid}`).once('value');
                            const isAdmin = adminSnapshot.val();
                            
                            if (isAdmin === true) {
                                appState.currentUser = user;
                                appState.loading = false;
                                appState.error = null;
                                showDashboard();
                                loadUsersData(database);
                                updateAdminUI();
                            } else {
                                showToast('Akses ditolak. Anda bukan admin.');
                                await auth.signOut();
                                showErrorState('Akses ditolak. Anda bukan admin.');
                            }
                        } catch (error) {
                            console.error('Error checking admin status:', error);
                            showToast('Error: ' + error.message);
                            await auth.signOut();
                            showErrorState('Gagal memeriksa status admin: ' + error.message);
                        }
                    } else {
                        appState.currentUser = null;
                        appState.loading = false;
                        appState.error = null;
                        showLoginScreen();
                    }
                });
            } catch (error) {
                console.error('Firebase initialization error:', error);
                clearTimeout(timeoutId);
                appState.loading = false;
                appState.error = 'Gagal menginisialisasi Firebase. Periksa koneksi internet Anda.';
                showErrorState(appState.error);
            }
        }

        // State management functions
        function showLoadingState() {
            elements.loadingScreen.classList.remove('hidden');
            elements.errorScreen.classList.add('hidden');
            elements.loginScreen.classList.add('hidden');
            elements.dashboardScreen.classList.add('hidden');
        }

        function showErrorState(message) {
            appState.loading = false;
            appState.error = message;
            elements.loadingScreen.classList.add('hidden');
            elements.errorScreen.classList.remove('hidden');
            elements.loginScreen.classList.add('hidden');
            elements.dashboardScreen.classList.add('hidden');
            elements.errorMessage.textContent = message;
        }

        function showLoginScreen() {
            elements.loadingScreen.classList.add('hidden');
            elements.errorScreen.classList.add('hidden');
            elements.loginScreen.classList.remove('hidden');
            elements.dashboardScreen.classList.add('hidden');
        }

        function showDashboard() {
            elements.loadingScreen.classList.add('hidden');
            elements.errorScreen.classList.add('hidden');
            elements.loginScreen.classList.add('hidden');
            elements.dashboardScreen.classList.remove('hidden');
            elements.dashboardScreen.classList.add('fade-in');
        }

        function showTimeoutState() {
            appState.loading = false;
            appState.timeoutReached = true;
            elements.timeoutMessage.classList.remove('hidden');
            elements.refreshBtn.classList.remove('hidden');
            showToast('Loading terlalu lama. Silakan refresh halaman.');
        }

        // Update admin UI
        function updateAdminUI() {
            if (appState.currentUser.photoURL) {
                elements.adminProfilePicture.innerHTML = `<img src="${appState.currentUser.photoURL}" alt="Profile" class="w-8 h-8 rounded-full object-cover">`;
            } else {
                elements.adminProfilePicture.innerHTML = `<i class="fas fa-user text-gray-500 text-sm"></i>`;
            }
            elements.adminName.textContent = appState.currentUser.displayName || 'Admin';
        }

        // Toast notification
        function showToast(message, duration = 3000) {
            if (elements.toastMessage) {
                elements.toastMessage.textContent = message;
                elements.toast.classList.add('show');
                elements.toast.classList.remove('translate-y-full', 'opacity-0');
                setTimeout(() => hideToast(), duration);
            }
        }

        function hideToast() {
            if (elements.toast) {
                elements.toast.classList.remove('show');
                elements.toast.classList.add('translate-y-full', 'opacity-0');
            }
        }

        // Dark mode toggle
        if (elements.darkModeToggle) {
            elements.darkModeToggle.addEventListener('click', () => {
                appState.isDarkMode = !appState.isDarkMode;
                localStorage.setItem('darkMode', appState.isDarkMode);
                document.body.classList.toggle('dark');
                const icon = elements.darkModeToggle.querySelector('i');
                if (appState.isDarkMode) {
                    icon.classList.replace('fa-moon', 'fa-sun');
                } else {
                    icon.classList.replace('fa-sun', 'fa-moon');
                }
            });
        }

        // Login and logout
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', async () => {
                elements.loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
                elements.loginBtn.disabled = true;
                
                try {
                    const auth = firebase.auth();
                    const provider = new firebase.auth.GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: 'select_account' });
                    await auth.signInWithPopup(provider);
                } catch (error) {
                    console.error('Login error:', error);
                    showToast('Login gagal: ' + error.message);
                } finally {
                    elements.loginBtn.innerHTML = '<i class="fab fa-google mr-2"></i>Login dengan Google';
                    elements.loginBtn.disabled = false;
                }
            });
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', async () => {
                try {
                    const auth = firebase.auth();
                    await auth.signOut();
                    showToast('Logout berhasil!');
                } catch (error) {
                    console.error('Logout error:', error);
                    showToast('Logout gagal: ' + error.message);
                }
            });
        }

        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }

        // Export to CSV
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', () => {
                const csv = Papa.unparse(appState.filteredUsers);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'users.csv';
                link.click();
                showToast('Data berhasil diexport');
            });
        }

        // Filter and search
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', filterUsers);
        }
        
        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', filterUsers);
        }

        function filterUsers() {
            const searchTerm = elements.searchInput.value.toLowerCase();
            const statusValue = elements.statusFilter.value;
            
            appState.filteredUsers = appState.users.filter(user => {
                const name = user.name || '';
                const email = user.email || '';
                const matchesSearch = name.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm);
                const matchesStatus = statusValue === 'all' || user.status === statusValue;
                return matchesSearch && matchesStatus;
            });
            
            renderUserTable();
            updateUserMarkers();
        }

        // Render user table
        function renderUserTable() {
            if (!elements.userTableBody) return;
            
            if (appState.filteredUsers.length === 0) {
                elements.userTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No users found</td></tr>`;
                return;
            }
            
            elements.userTableBody.innerHTML = appState.filteredUsers.map(user => `
                <tr class="user-row" onclick="showUserModal('${user.id}')">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                ${user.photoURL ?
                                    `<img class="h-10 w-10 rounded-full" src="${user.photoURL}" alt="" />` :
                                    `<div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center"><i class="fas fa-user text-gray-500"></i></div>`
                                }
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">${user.name || 'Unknown'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${user.email || 'N/A'}</div></td>
                    <td class="px-6 py-4 whitespace-nowrap"><span class="badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}">${user.status || 'inactive'}</span></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.location ? `${user.location.lat?.toFixed(4)}, ${user.location.lng?.toFixed(4)}` : 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.location?.timestamp ? new Date(user.location.timestamp).toLocaleString() : 'Never'}</td>
                </tr>
            `).join('');
        }

        // User modal
        function showUserModal(userId) {
            const user = appState.users.find(u => u.id === userId);
            if (!user) return;
            
            elements.modalUserName.textContent = user.name || 'Unknown';
            elements.modalUserEmail.textContent = `Email: ${user.email || 'N/A'}`;
            elements.modalUserStatus.innerHTML = `Status: <span class="badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}">${user.status || 'inactive'}</span>`;
            elements.modalUserLocation.textContent = `Location: ${user.location ? `${user.location.lat?.toFixed(4)}, ${user.location.lng?.toFixed(4)}` : 'N/A'}`;
            elements.modalUserLastUpdate.textContent = `Last Update: ${user.location?.timestamp ? new Date(user.location.timestamp).toLocaleString() : 'Never'}`;
            elements.userModal.classList.remove('hidden');
        }

        if (elements.closeModal) {
            elements.closeModal.addEventListener('click', () => elements.userModal.classList.add('hidden'));
        }

        window.addEventListener('click', (event) => {
            if (event.target === elements.userModal) {
                elements.userModal.classList.add('hidden');
            }
        });

        // Map initialization
        function initMap() {
            try {
                appState.vectorSource = new ol.source.Vector();
                const vectorLayer = new ol.layer.Vector({
                    source: appState.vectorSource,
                    style: new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 7,
                            fill: new ol.style.Fill({ color: '#3B82F6' }),
                            stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 2 })
                        })
                    })
                });
                
                appState.popupOverlay = new ol.Overlay({
                    element: elements.popupContainer,
                    autoPan: { animation: { duration: 250 } }
                });
                
                if (elements.popupCloser) {
                    elements.popupCloser.onclick = () => {
                        appState.popupOverlay.setPosition(undefined);
                        elements.popupCloser.blur();
                        return false;
                    };
                }

                appState.map = new ol.Map({
                    target: 'map',
                    layers: [
                        new ol.layer.Tile({
                            source: new ol.source.OSM()
                        }),
                        vectorLayer
                    ],
                    overlays: [appState.popupOverlay],
                    view: new ol.View({
                        center: ol.proj.fromLonLat([106.8456, -6.2088]),
                        zoom: 10
                    })
                });
                
                appState.map.on('click', function(evt) {
                    const feature = appState.map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
                    if (feature) {
                        const coordinates = feature.getGeometry().getCoordinates();
                        appState.popupOverlay.setPosition(coordinates);
                        const userData = feature.get('userData');
                        elements.popupContent.innerHTML = `
                            <h3 class="font-bold text-base mb-1">${userData.name || 'Unknown'}</h3>
                            <p class="text-xs text-gray-600">${userData.email || 'N/A'}</p>
                            <p class="text-xs mt-2">Status: <span class="font-semibold ${userData.status === 'active' ? 'text-green-600' : 'text-red-600'}">${userData.status}</span></p>
                            <p class="text-xs">Update: ${new Date(userData.location.timestamp).toLocaleTimeString()}</p>
                        `;
                    } else {
                        appState.popupOverlay.setPosition(undefined);
                        if (elements.popupCloser) elements.popupCloser.blur();
                    }
                });
            } catch (error) {
                console.error('Map initialization error:', error);
                showToast('Gagal memuat peta');
            }
        }

        function updateUserMarkers() {
            if (!appState.map || !appState.vectorSource) return;
            
            appState.vectorSource.clear();
            const features = [];
            
            appState.filteredUsers.forEach(user => {
                if (user.location?.lat && user.location?.lng) {
                    const feature = new ol.Feature({
                        geometry: new ol.geom.Point(ol.proj.fromLonLat([user.location.lng, user.location.lat])),
                        userData: user
                    });
                    features.push(feature);
                }
            });
            
            features.forEach(feature => appState.vectorSource.addFeature(feature));
            
            if (features.length > 0) {
                appState.map.getView().fit(appState.vectorSource.getExtent(), { 
                    padding: [50, 50, 50, 50], 
                    duration: 500 
                });
            }
        }

        // Update statistics
        function updateStats() {
            if (elements.totalUsers) elements.totalUsers.textContent = appState.users.length;
            if (elements.activeUsers) elements.activeUsers.textContent = appState.users.filter(u => u.status === 'active').length;
            if (elements.inactiveUsers) elements.inactiveUsers.textContent = appState.users.filter(u => u.status === 'inactive').length;
        }

        // Update charts
        function updateCharts() {
            const activeCount = appState.users.filter(u => u.status === 'active').length;
            const inactiveCount = appState.users.filter(u => u.status === 'inactive').length;
            
            // Status chart
            if (appState.statusChart) appState.statusChart.destroy();
            const statusChartCtx = document.getElementById('statusChart');
            if (statusChartCtx) {
                appState.statusChart = new Chart(statusChartCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Active', 'Inactive'],
                        datasets: [{
                            data: [activeCount, inactiveCount],
                            backgroundColor: ['#10B981', '#EF4444'],
                            borderWidth: 0
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { 
                            legend: { 
                                position: 'bottom' 
                            } 
                        } 
                    }
                });
            }

            // Hourly activity chart
            const hourlyData = Array(24).fill(0);
            appState.users.forEach(user => {
                if (user.location?.timestamp) {
                    const hour = new Date(user.location.timestamp).getHours();
                    hourlyData[hour]++;
                }
            });
            
            if (appState.hourlyChart) appState.hourlyChart.destroy();
            const hourlyChartCtx = document.getElementById('hourlyChart');
            if (hourlyChartCtx) {
                appState.hourlyChart = new Chart(hourlyChartCtx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                        datasets: [{
                            label: 'User Activity',
                            data: hourlyData,
                            backgroundColor: '#3B82F6',
                            borderColor: '#2563EB',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { 
                            legend: { 
                                display: false 
                            } 
                        },
                        scales: { 
                            y: { 
                                beginAtZero: true, 
                                ticks: { 
                                    stepSize: 1 
                                } 
                            } 
                        }
                    }
                });
            }
        }

        // Load users data
        function loadUsersData(database) {
            appState.usersRef = database.ref('users');
            appState.locationDataRef = database.ref('location-data');

            // Load users
            appState.usersRef.on('value', (snapshot) => {
                const usersObj = snapshot.val();
                appState.users = [];
                
                if (usersObj) {
                    Object.keys(usersObj).forEach(userId => {
                        const user = usersObj[userId];
                        appState.users.push({ 
                            id: userId, 
                            ...user, 
                            status: 'inactive' 
                        });
                    });
                }
                
                // Load location data
                appState.locationDataRef.on('value', (locationSnapshot) => {
                    const locations = locationSnapshot.val() || {};
                    appState.users = appState.users.map(user => {
                        const location = locations[user.id];
                        return {
                            ...user,
                            location: location ? {
                                lat: location.lat,
                                lng: location.lng,
                                timestamp: location.timestamp
                            } : undefined,
                            status: location ? 'active' : 'inactive'
                        };
                    });
                    
                    appState.filteredUsers = [...appState.users];
                    renderUserTable();
                    updateStats();
                    updateCharts();
                    
                    if (!appState.map) {
                        initMap();
                    }
                    updateUserMarkers();
                });
            });
        }

        // Initialize app when DOM is ready
        document.addEventListener('DOMContentLoaded', initApp);
