const firebaseConfig = {
    apiKey: "AIzaSyCdT2nWv0fF6jZmDfslIUvRKFun18rStWs",
    authDomain: "tracking-654e3.firebaseapp.com",
    databaseURL: "https://tracking-654e3-default-rtdb.asia-southeast1.firebasedatabase.com",
    projectId: "tracking-654e3",
    storageBucket: "tracking-654e3.appspot.com",
    messagingSenderId: "61074342637",
    appId: "1:61074342637:web:ee566c965c595668b5c2e4",
    measurementId: "G-Q5ZXKE7PTL"
};

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
    vectorSource: null,
    popupOverlay: null
};

const elements = {
    loadingScreen: document.getElementById('loadingScreen'),
    errorScreen: document.getElementById('errorScreen'),
    dashboardScreen: document.getElementById('dashboardScreen'),
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

function initApp() {
    appState.isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (appState.isDarkMode) {
        document.body.classList.add('dark');
        if (elements.darkModeToggle) {
            elements.darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
        }
    }

    const timeoutId = setTimeout(() => {
        if (appState.loading) {
            appState.timeoutReached = true;
            showTimeoutState();
        }
    }, 15000);

    try {
        const firebaseApp = firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        clearTimeout(timeoutId);
        showDashboard();
        loadUsersDataRealtime(database);
        initMap();
        initCharts();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        clearTimeout(timeoutId);
        appState.loading = false;
        appState.error = 'Gagal menginisialisasi Firebase. Periksa koneksi internet Anda atau pastikan kode konfigurasi benar.';
        showErrorState(appState.error);
    }
}

function showLoadingState() {
    elements.loadingScreen.classList.remove('hidden');
    elements.errorScreen.classList.add('hidden');
    elements.dashboardScreen.classList.add('hidden');
}

function showErrorState(message) {
    appState.loading = false;
    appState.error = message;
    elements.loadingScreen.classList.add('hidden');
    elements.errorScreen.classList.remove('hidden');
    elements.dashboardScreen.classList.add('hidden');
    if (elements.errorMessage) elements.errorMessage.textContent = message;
}

function showDashboard() {
    elements.loadingScreen.classList.add('hidden');
    elements.errorScreen.classList.add('hidden');
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

function updateAdminUI() {
    elements.adminProfilePicture.innerHTML = `<i class="fas fa-user text-gray-500 text-sm"></i>`;
    elements.adminName.textContent = 'Admin';
}

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

if (elements.darkModeToggle) {
    elements.darkModeToggle.addEventListener('click', () => {
        appState.isDarkMode = !appState.isDarkMode;
        localStorage.setItem('darkMode', appState.isDarkMode);
        document.body.classList.toggle('dark');
        const icon = elements.darkModeToggle.querySelector('i');
        if (appState.isDarkMode) icon.classList.replace('fa-moon', 'fa-sun');
        else icon.classList.replace('fa-sun', 'fa-moon');
    });
}

if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', () => window.location.reload());

if (elements.exportBtn) {
    elements.exportBtn.addEventListener('click', () => {
        if (typeof Papa === "undefined") {
            showToast("PapaParse belum dimuat!");
            return;
        }
        const csv = Papa.unparse(appState.filteredUsers);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'users.csv';
        link.click();
        showToast('Data berhasil diexport');
    });
}

if (elements.searchInput) elements.searchInput.addEventListener('input', filterUsers);
if (elements.statusFilter) elements.statusFilter.addEventListener('change', filterUsers);

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
                        <img class="h-10 w-10 rounded-full" src="${user.photoURL || 'https://via.placeholder.com/150'}" alt="">
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${user.name || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="badge badge-${user.status === 'active' ? 'green' : 'red'}">${user.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.location ? `${user.location.latitude.toFixed(4)}, ${user.location.longitude.toFixed(4)}` : 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.lastUpdate ? new Date(user.lastUpdate).toLocaleString() : 'N/A'}</td>
        </tr>
    `).join('');
}

window.showUserModal = (userId) => {
    const user = appState.users.find(u => u.id === userId);
    if (user) {
        elements.modalUserName.textContent = user.name || 'N/A';
        elements.modalUserEmail.textContent = user.email || 'N/A';
        elements.modalUserStatus.textContent = `Status: ${user.status}`;
        elements.modalUserLocation.textContent = `Location: ${user.location ? `${user.location.latitude.toFixed(4)}, ${user.location.longitude.toFixed(4)}` : 'N/A'}`;
        elements.modalUserLastUpdate.textContent = `Last Update: ${user.lastUpdate ? new Date(user.lastUpdate).toLocaleString() : 'N/A'}`;
        elements.userModal.classList.remove('hidden');
    }
};

if (elements.closeModal) elements.closeModal.addEventListener('click', () => elements.userModal.classList.add('hidden'));

// ✅ Real-time load untuk users Google login
function loadUsersDataRealtime(database) {
    appState.usersRef = database.ref('users');

    appState.usersRef.on('value', snapshot => {
        const usersData = snapshot.val() || {};

        const allUsers = Object.entries(usersData).map(([id, user]) => ({
            id,
            name: user.name || user.displayName || 'N/A',
            email: user.email || 'N/A',
            photoURL: user.photoURL || 'https://via.placeholder.com/150',
            status: user.status || 'inactive',
            location: user.location || null,
            lastUpdate: user.lastUpdate || user.createdAt || null
        }));

        appState.users = allUsers;
        appState.filteredUsers = [...allUsers];
        updateStats();
        renderUserTable();
        updateUserMarkers();
        showToast('Data berhasil dimuat!');
    }, error => {
        console.error('Failed to load users:', error);
        showErrorState('Gagal memuat data pengguna.');
    });
}

function updateStats() {
    const total = appState.users.length;
    const active = appState.users.filter(u => u.status === 'active').length;
    const inactive = appState.users.length - active;

    elements.totalUsers.textContent = total;
    elements.activeUsers.textContent = active;
    elements.inactiveUsers.textContent = inactive;
}

function initMap() {
    const { Map, View } = ol;
    const { Tile, Vector } = ol.layer;
    const { OSM, Vector: VectorSource } = ol.source;
    const { fromLonLat } = ol.proj;
    const { Feature } = ol;
    const { Point } = ol.geom;
    const { Icon, Style } = ol.style;
    const Overlay = ol.Overlay;

    appState.vectorSource = new VectorSource();

    appState.map = new Map({
        target: 'map',
        layers: [
            new Tile({ source: new OSM() }),
            new Vector({ source: appState.vectorSource })
        ],
        view: new View({ center: fromLonLat([106.8456, -6.2088]), zoom: 6 })
    });

    appState.popupOverlay = new Overlay({
        element: elements.popupContainer,
        autoPan: true,
        autoPanAnimation: { duration: 250 }
    });
    appState.map.addOverlay(appState.popupOverlay);

    elements.popupCloser.onclick = () => {
        appState.popupOverlay.setPosition(undefined);
        elements.popupCloser.blur();
        return false;
    };

    appState.map.on('singleclick', (event) => {
        const feature = appState.map.forEachFeatureAtPixel(event.pixel, f => f);
        if (feature) {
            const user = feature.get('user');
            const coordinate = feature.getGeometry().getCoordinates();
            elements.popupContent.innerHTML = `
                <div>
                    <h4 class="font-bold">${user.name || 'N/A'}</h4>
                    <p class="text-xs text-gray-500">${user.email || 'N/A'}</p>
                    <p class="text-xs mt-1">Status: <span class="badge badge-${user.status === 'active' ? 'green' : 'red'}">${user.status}</span></p>
                    <p class="text-xs">Lat: ${user.location.latitude.toFixed(4)}, Lon: ${user.location.longitude.toFixed(4)}</p>
                </div>
            `;
            appState.popupOverlay.setPosition(coordinate);
        } else {
            appState.popupOverlay.setPosition(undefined);
            elements.popupCloser.blur();
        }
    });

    updateUserMarkers();
}

function updateUserMarkers() {
    const { Feature } = ol;
    const { Point } = ol.geom;
    const { Icon, Style } = ol.style;
    const { fromLonLat } = ol.proj;

    if (!appState.vectorSource) return;
    appState.vectorSource.clear();

    const features = appState.filteredUsers.filter(u => u.location).map(user => {
        const feature = new Feature({ geometry: new Point(fromLonLat([user.location.longitude, user.location.latitude])) });
        feature.set('user', user);
        feature.setStyle(new Style({
            image: new Icon({
                src: `http://maps.google.com/mapfiles/ms/icons/${user.status === 'active' ? 'green' : 'red'}-dot.png`,
                scale: 1
            })
        }));
        return feature;
    });

    appState.vectorSource.addFeatures(features);
}

function initCharts() {
    updateStatusChart();
    updateHourlyChart();
}

function updateStatusChart() {
    const activeCount = appState.users.filter(u => u.status === 'active').length;
    const inactiveCount = appState.users.length - activeCount;

    const canvas = document.getElementById('statusChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (appState.statusChart) {
        appState.statusChart.data.datasets[0].data = [activeCount, inactiveCount];
        appState.statusChart.update();
    } else {
        appState.statusChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Active', 'Inactive'],
                datasets: [{ data: [activeCount, inactiveCount], backgroundColor: ['#34D399', '#F87171'], hoverOffset: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

function updateHourlyChart() {
    const hourlyData = new Array(24).fill(0);
    appState.users.forEach(user => {
        if (user.lastUpdate) {
            const hour = new Date(user.lastUpdate).getHours();
            if (hour >= 0 && hour < 24) hourlyData[hour]++;
        }
    });

    const canvas = document.getElementById('hourlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (appState.hourlyChart) {
        appState.hourlyChart.data.datasets[0].data = hourlyData;
        appState.hourlyChart.update();
    } else {
        appState.hourlyChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: [...Array(24).keys()].map(h => `${h}:00`), datasets: [{ label: 'User Activity', data: hourlyData, backgroundColor: '#3B82F6' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
        });
    }
}

initApp();
