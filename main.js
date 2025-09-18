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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const adminProfilePicture = document.getElementById('adminProfilePicture');
const adminName = document.getElementById('adminName');
const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const inactiveUsers = document.getElementById('inactiveUsers');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const exportBtn = document.getElementById('exportBtn');
const userTableBody = document.getElementById('userTableBody');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const userModal = document.getElementById('userModal');
const closeModal = document.getElementById('closeModal');
const modalUserName = document.getElementById('modalUserName');
const modalUserEmail = document.getElementById('modalUserEmail');
const modalUserStatus = document.getElementById('modalUserStatus');
const modalUserLocation = document.getElementById('modalUserLocation');
const modalUserLastUpdate = document.getElementById('modalUserLastUpdate');

const popupContainer = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

// State
let currentUser = null;
let users = [];
let filteredUsers = [];
let map = null;
let statusChart = null;
let hourlyChart = null;
let isDarkMode = localStorage.getItem('darkMode') === 'true';
let usersRef = null;
let locationDataRef = null;
let vectorSource;
let popupOverlay;

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // Show loading screen initially
    loadingScreen.classList.remove('hidden');

    // Check dark mode preference
    if (isDarkMode) {
        document.body.classList.add('dark');
        if(darkModeToggle) darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    }
    
    // Set up Firebase auth listener
    // Ini adalah listener utama yang akan memicu logika setelah status auth diketahui
    auth.onAuthStateChanged(handleAuthStateChanged);
}

// Auth State Handler
function handleAuthStateChanged(user) {
    if (user) {
        // User is signed in. Now check if they are an admin.
        currentUser = user;
        database.ref(`admins/${user.uid}`).once('value')
            .then((snapshot) => {
                const isAdmin = snapshot.val();
                if (isAdmin === true) {
                    // User is an admin, show the dashboard
                    loadingScreen.classList.add('hidden');
                    loginScreen.classList.add('hidden');
                    dashboardScreen.classList.remove('hidden');
                    dashboardScreen.classList.add('fade-in');

                    if (!map) {
                        initMap();
                    }
                    loadUsersData();
                    setupDatabaseListeners();
                    updateAdminUI();
                } else {
                    // User is logged in but not an admin. Deny access.
                    showToast('Akses ditolak. Anda bukan admin.');
                    auth.signOut();
                }
            })
            .catch((error) => {
                // Error while checking admin status
                console.error('Error checking admin status:', error);
                showToast('Error: ' + error.message);
                auth.signOut();
            });
    } else {
        // User is signed out. Show the login screen.
        currentUser = null;
        loadingScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
        // Clean up database listeners if they exist
        if (usersRef) usersRef.off();
        if (locationDataRef) locationDataRef.off();
    }
}

// Update UI after successful admin login
function updateAdminUI() {
    if (currentUser.photoURL) {
        adminProfilePicture.innerHTML = `<img src="${currentUser.photoURL}" alt="Profile" class="w-8 h-8 rounded-full object-cover">`;
    } else {
        adminProfilePicture.innerHTML = `<i class="fas fa-user text-gray-500 text-sm"></i>`;
    }
    adminName.textContent = currentUser.displayName || 'Admin';
}

// Show/Hide Toast Notification
function showToast(message, duration = 3000) {
    if (toastMessage) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        toast.classList.remove('translate-y-full', 'opacity-0');
        setTimeout(() => hideToast(), duration);
    }
}

function hideToast() {
    if (toast) {
        toast.classList.remove('show');
        toast.classList.add('translate-y-full', 'opacity-0');
    }
}

// Dark Mode Toggle
if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('darkMode', isDarkMode);
        document.body.classList.toggle('dark');
        const icon = darkModeToggle.querySelector('i');
        if (isDarkMode) {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    });
}

// Login & Logout
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        loginBtn.disabled = true;
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await auth.signInWithPopup(provider);
        } catch (error) {
            console.error('Login error:', error);
            showToast('Login gagal: ' + error.message);
        } finally {
            loginBtn.innerHTML = '<i class="fab fa-google mr-2"></i>Login dengan Google';
            loginBtn.disabled = false;
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.signOut().then(() => showToast('Logout berhasil!')));
}

// Export to CSV
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const csv = Papa.unparse(filteredUsers);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'users.csv';
        link.click();
        showToast('Data berhasil diexport');
    });
}

// Filter & Render Table
if (searchInput) searchInput.addEventListener('input', filterUsers);
if (statusFilter) statusFilter.addEventListener('change', filterUsers);

function filterUsers() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    filteredUsers = users.filter(user => {
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
    if (!userTableBody) return;
    if (filteredUsers.length === 0) {
        userTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No users found</td></tr>`;
        return;
    }
    userTableBody.innerHTML = filteredUsers.map(user => `
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

// Modal Logic
function showUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    modalUserName.textContent = user.name || 'Unknown';
    modalUserEmail.textContent = `Email: ${user.email || 'N/A'}`;
    modalUserStatus.innerHTML = `Status: <span class="badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}">${user.status || 'inactive'}</span>`;
    modalUserLocation.textContent = `Location: ${user.location ? `${user.location.lat?.toFixed(4)}, ${user.location.lng?.toFixed(4)}` : 'N/A'}`;
    modalUserLastUpdate.textContent = `Last Update: ${user.location?.timestamp ? new Date(user.location.timestamp).toLocaleString() : 'Never'}`;
    userModal.classList.remove('hidden');
}

if (closeModal) closeModal.addEventListener('click', () => userModal.classList.add('hidden'));
window.addEventListener('click', (event) => {
    if (event.target === userModal) userModal.classList.add('hidden');
});

// --- OpenLayers Map Implementation ---
function initMap() {
    vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#3B82F6' }),
                stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 2 })
            })
        })
    });
    
    popupOverlay = new ol.Overlay({
        element: popupContainer,
        autoPan: { animation: { duration: 250 } }
    });
    popupCloser.onclick = () => {
        popupOverlay.setPosition(undefined);
        popupCloser.blur();
        return false;
    };

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            vectorLayer
        ],
        overlays: [popupOverlay],
        view: new ol.View({
            center: ol.proj.fromLonLat([106.8456, -6.2088]),
            zoom: 10
        })
    });
    
    map.on('click', function(evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
        if (feature) {
            const coordinates = feature.getGeometry().getCoordinates();
            popupOverlay.setPosition(coordinates);
            const userData = feature.get('userData');
            popupContent.innerHTML = `
                <h3 class="font-bold text-base mb-1">${userData.name || 'Unknown'}</h3>
                <p class="text-xs text-gray-600">${userData.email || 'N/A'}</p>
                <p class="text-xs mt-2">Status: <span class="font-semibold ${userData.status === 'active' ? 'text-green-600' : 'text-red-600'}">${userData.status}</span></p>
                <p class="text-xs">Update: ${new Date(userData.location.timestamp).toLocaleTimeString()}</p>
            `;
        } else {
            popupOverlay.setPosition(undefined);
            popupCloser.blur();
        }
    });
}

function updateUserMarkers() {
    if (!map || !vectorSource) return;
    vectorSource.clear();
    const features = [];
    filteredUsers.forEach(user => {
        if (user.location?.lat && user.location?.lng) {
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([user.location.lng, user.location.lat])),
                userData: user
            });
            features.push(feature);
        }
    });
    if (features.length > 0) {
        map.getView().fit(vectorSource.getExtent(), { padding: [50, 50, 50, 50], duration: 500 });
    }
}

// Update Stats & Charts
function updateStats() {
    if (totalUsers) totalUsers.textContent = users.length;
    if (activeUsers) activeUsers.textContent = users.filter(u => u.status === 'active').length;
    if (inactiveUsers) inactiveUsers.textContent = users.filter(u => u.status === 'inactive').length;
}

function updateCharts() {
    const activeCount = users.filter(u => u.status === 'active').length;
    const inactiveCount = users.filter(u => u.status === 'inactive').length;
    if (statusChart) statusChart.destroy();
    const statusChartCtx = document.getElementById('statusChart');
    if (statusChartCtx) {
        statusChart = new Chart(statusChartCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Inactive'],
                datasets: [{
                    data: [activeCount, inactiveCount],
                    backgroundColor: ['#10B981', '#EF4444'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const hourlyData = Array(24).fill(0);
    users.forEach(user => {
        if (user.location?.timestamp) {
            const hour = new Date(user.location.timestamp).getHours();
            hourlyData[hour]++;
        }
    });
    if (hourlyChart) hourlyChart.destroy();
    const hourlyChartCtx = document.getElementById('hourlyChart');
    if (hourlyChartCtx) {
        hourlyChart = new Chart(hourlyChartCtx.getContext('2d'), {
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
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }
}

// Data fetching and listeners
function loadUsersData() {
    usersRef = database.ref('users');
    locationDataRef = database.ref('location-data');

    // Fetch initial user data
    usersRef.once('value', (snapshot) => {
        const usersObj = snapshot.val();
        users = [];
        for (const userId in usersObj) {
            const user = usersObj[userId];
            users.push({ id: userId, ...user });
        }
        
        // Fetch location data separately and merge
        locationDataRef.once('value', (locationSnapshot) => {
            const locations = locationSnapshot.val() || {};
            users.forEach(user => {
                user.location = locations[user.id] || null;
                user.status = user.location ? 'active' : 'inactive';
            });
            filteredUsers = [...users];
            renderUserTable();
            updateStats();
            updateCharts();
            updateUserMarkers();
        });
    });
}

function setupDatabaseListeners() {
    usersRef.on('child_changed', (snapshot) => {
        const updatedUser = snapshot.val();
        const userId = snapshot.key;
        const index = users.findIndex(u => u.id === userId);
        if (index !== -1) {
            users[index] = { ...users[index], ...updatedUser };
            filterUsers();
            updateStats();
            updateCharts();
        }
    });

    locationDataRef.on('child_changed', (snapshot) => {
        const locationData = snapshot.val();
        const userId = snapshot.key;
        const index = users.findIndex(u => u.id === userId);
        if (index !== -1) {
            users[index].location = locationData;
            users[index].status = locationData ? 'active' : 'inactive';
            filterUsers();
            updateStats();
            updateCharts();
        }
    });
}
