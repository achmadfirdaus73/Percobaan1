    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
    import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
    import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

    // Config Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyCdT2nWv0fF6jZmDfslIUvRKFun18rStWs",
      authDomain: "tracking-654e3.firebaseapp.com",
      databaseURL: "https://tracking-654e3-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "tracking-654e3",
      storageBucket: "tracking-654e3.appspot.com",
      messagingSenderId: "61074342637",
      appId: "1:61074342637:web:ee566c965c595668b5c2e4"
    };

    // Init Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const rtdb = getDatabase(app);

    // DOM
    const loginSection = document.getElementById("loginSection");
    const dashboardSection = document.getElementById("dashboardSection");
    const loginForm = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    const totalUsers = document.getElementById("totalUsers");
    const activeUsers = document.getElementById("activeUsers");
    const inactiveUsers = document.getElementById("inactiveUsers");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const exportBtn = document.getElementById("exportBtn");
    const userTableBody = document.getElementById("userTableBody");
    const darkModeToggle = document.getElementById("darkModeToggle");

    let users = [];
    let filteredUsers = [];

    // Toast
    function showToast(msg, duration=3000){
      toastMessage.textContent = msg;
      toast.classList.remove("opacity-0","translate-y-full");
      setTimeout(()=>toast.classList.add("opacity-0","translate-y-full"), duration);
    }

    // Dark Mode
    if(localStorage.getItem("darkMode")==="true"){ document.body.classList.add("dark"); }
    darkModeToggle.addEventListener("click",()=>{
      document.body.classList.toggle("dark");
      localStorage.setItem("darkMode", document.body.classList.contains("dark"));
    });

    // Login
    loginForm.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      try{
        const cred = await signInWithEmailAndPassword(auth,email,password);
        const user = cred.user;

        // Cek di Firestore /admins
        const docRef = doc(db,"admins",user.uid);
        const snap = await getDoc(docRef);
        if(snap.exists()){
          loginSection.classList.add("hidden");
          dashboardSection.classList.remove("hidden");
          loadUsers();
          showToast("Login berhasil sebagai admin");
        } else {
          await signOut(auth);
          alert("Bukan akun admin!");
        }
      }catch(err){
        alert("Login gagal: "+err.message);
      }
    });

    // Logout
    logoutBtn.addEventListener("click", async ()=>{
      await signOut(auth);
      dashboardSection.classList.add("hidden");
      loginSection.classList.remove("hidden");
      showToast("Logout berhasil");
    });

    // Load users realtime dari RTDB
    function loadUsers(){
      onValue(ref(rtdb,"users"), snapshot=>{
        const data = snapshot.val()||{};
        users = Object.entries(data).map(([id,u])=>({
          id,
          name: u.name || u.displayName || "N/A",
          email: u.email || "N/A",
          photoURL: u.photoURL || "https://via.placeholder.com/100",
          status: u.status || "inactive",
          location: u.location ? {lat:u.location.lat, lng:u.location.lng} : null
        }));
        filteredUsers = [...users];
        updateStats();
        renderUsers();
        updateMarkers();
      });
    }

    function updateStats(){
      totalUsers.textContent = users.length;
      activeUsers.textContent = users.filter(u=>u.status==="active").length;
      inactiveUsers.textContent = users.filter(u=>u.status!=="active").length;
    }

    function renderUsers(){
      if(filteredUsers.length===0){
        userTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Tidak ada user</td></tr>`;
        return;
      }
      userTableBody.innerHTML = filteredUsers.map(u=>`
        <tr>
          <td class="border p-2"><img src="${u.photoURL}" class="w-10 h-10 rounded-full"></td>
          <td class="border p-2">${u.name}</td>
          <td class="border p-2">${u.email}</td>
          <td class="border p-2 ${u.status==='active'?'text-green-500':'text-red-500'}">${u.status}</td>
          <td class="border p-2">${u.location ? u.location.lat.toFixed(4)+", "+u.location.lng.toFixed(4) : "N/A"}</td>
        </tr>
      `).join("");
    }

    // Filter + Search
    searchInput.addEventListener("input", applyFilter);
    statusFilter.addEventListener("change", applyFilter);
    function applyFilter(){
      const term = searchInput.value.toLowerCase();
      const statusVal = statusFilter.value;
      filteredUsers = users.filter(u=>{
        const matchSearch = u.name.toLowerCase().includes(term)||u.email.toLowerCase().includes(term);
        const matchStatus = statusVal==="all"||u.status===statusVal;
        return matchSearch && matchStatus;
      });
      renderUsers();
      updateMarkers();
    }

    // Export CSV
    exportBtn.addEventListener("click",()=>{
      import("https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js").then(Papa=>{
        const csv = Papa.unparse(filteredUsers);
        const blob = new Blob([csv], {type:"text/csv"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href=url; a.download="users.csv"; a.click();
        showToast("CSV berhasil diexport");
      });
    });

    // OpenLayers Map
    const vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({ source: vectorSource });
    const map = new ol.Map({
      target:"map",
      layers:[
        new ol.layer.Tile({ source: new ol.source.OSM() }),
        vectorLayer
      ],
      view:new ol.View({ center: ol.proj.fromLonLat([106.8456,-6.2088]), zoom:5 })
    });

    function updateMarkers(){
      vectorSource.clear();
      filteredUsers.filter(u=>u.location).forEach(u=>{
        const feature = new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([u.location.lng, u.location.lat])),
          name: u.name,
          email: u.email,
          status: u.status
        });
        feature.setStyle(new ol.style.Style({
          image: new ol.style.Icon({
            src:`http://maps.google.com/mapfiles/ms/icons/${u.status==='active'?'green':'red'}-dot.png`,
            scale:1
          })
        }));
        vectorSource.addFeature(feature);
      });
    }

    setTimeout(()=>map.updateSize(), 500);
