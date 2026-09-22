// Firebase Modular SDK imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
    authDomain: "sera-product.firebaseapp.com",
    projectId: "sera-product",
    storageBucket: "sera-product.firebasestorage.app",
    messagingSenderId: "516762224598",
    appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
    measurementId: "G-RLMWH43FXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Owner Emails List
const OWNER_EMAILS = [
    "shohidhossain200@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

// State Variables
let allLoadedKeys = [];
let lastVisibleDoc = null;
let selectedDeleteId = null;

// DOM Elements
const authLoader = document.getElementById("auth-loader");
const appContainer = document.getElementById("app-container");
const userEmailDisplay = document.getElementById("user-email-display");
const userBadge = document.getElementById("user-badge");
const logoutBtn = document.getElementById("logout-btn");
const apiTableBody = document.getElementById("api-table-body");
const emptyState = document.getElementById("empty-state");
const loadMoreBtn = document.getElementById("load-more-btn");
const loadMoreText = document.getElementById("load-more-text");
const loadMoreSpinner = document.getElementById("load-more-spinner");
const totalKeyCount = document.getElementById("total-key-count");
const searchInput = document.getElementById("search-input");

// Modals & Forms
const createModal = document.getElementById("create-modal");
const editModal = document.getElementById("edit-modal");
const deleteModal = document.getElementById("delete-modal");
const openCreateModalBtn = document.getElementById("open-create-modal-btn");
const createApiForm = document.getElementById("create-api-form");
const editApiForm = document.getElementById("edit-api-form");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// Toast Notification Helper
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Authentication & Authorization Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/admin/");
        return;
    }

    const emailLower = user.email ? user.email.toLowerCase() : "";
    let isOwner = OWNER_EMAILS.includes(emailLower);

    if (isOwner) {
        userBadge.textContent = "OWNER";
        initPanel(user);
        return;
    }

    // Check if valid Admin via admins/{uid}
    try {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            if (adminData.active === true && adminData.uid === user.uid) {
                userBadge.textContent = "ADMIN";
                initPanel(user);
                return;
            }
        }
        
        // Unauthorized
        await signOut(auth);
        alert("আপনার এই প্যানেলে প্রবেশের অনুমতি নেই।");
        window.location.replace("/admin/");

    } catch (error) {
        console.error("Authorization check error:", error);
        await signOut(auth);
        window.location.replace("/admin/");
    }
});

function initPanel(user) {
    userEmailDisplay.textContent = user.email;
    authLoader.classList.add("hidden");
    appContainer.classList.remove("hidden");
    loadInitialKeys();
}

// Logout Handler
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/admin/");
    } catch (error) {
        showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
    }
});

// Load Initial 20 API Keys (Cursor Pagination)
async function loadInitialKeys() {
    try {
        apiTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">API কী লোড হচ্ছে...</td></tr>';
        
        const q = query(collection(db, "imgbb_api"), orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);

        allLoadedKeys = [];
        if (snapshot.empty) {
            lastVisibleDoc = null;
            renderKeys([]);
            loadMoreBtn.classList.add("hidden");
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach((docSnap) => {
            allLoadedKeys.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderKeys(allLoadedKeys);

        if (snapshot.docs.length < 20) {
            loadMoreBtn.classList.add("hidden");
        } else {
            loadMoreBtn.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error loading API keys:", error);
        showToast("কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।", "error");
        apiTableBody.innerHTML = '';
        emptyState.classList.remove("hidden");
    }
}

// Load More API Keys
loadMoreBtn.addEventListener("click", async () => {
    if (!lastVisibleDoc) return;

    loadMoreText.textContent = "আরও লোড হচ্ছে...";
    loadMoreSpinner.classList.remove("hidden");
    loadMoreBtn.setAttribute("disabled", "true");

    try {
        const q = query(
            collection(db, "imgbb_api"), 
            orderBy("createdAt", "desc"), 
            startAfter(lastVisibleDoc), 
            limit(20)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
            snapshot.forEach((docSnap) => {
                allLoadedKeys.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderKeys(allLoadedKeys);
        }

        if (snapshot.docs.length < 20) {
            loadMoreBtn.classList.add("hidden");
        }
    } catch (error) {
        console.error("Error loading more keys:", error);
        showToast("ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", "error");
    } finally {
        loadMoreText.textContent = "আরও দেখুন";
        loadMoreSpinner.classList.add("hidden");
        loadMoreBtn.removeAttribute("disabled");
    }
});

// Format Timestamp Helper
function formatTimestamp(ts) {
    if (!ts || !ts.toDate) return "প্রযোজ্য নয়";
    try {
        return ts.toDate().toLocaleString('bn-BD', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    } catch (e) {
        return "প্রযোজ্য নয়";
    }
}

// Render Keys Table
function renderKeys(keysToRender) {
    apiTableBody.innerHTML = "";
    totalKeyCount.textContent = keysToRender.length;

    if (keysToRender.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    keysToRender.forEach((item) => {
        const tr = document.createElement("tr");
        const statusBadge = item.active 
            ? '<span class="badge active">সক্রিয়</span>' 
            : '<span class="badge inactive">নিষ্ক্রিয়</span>';

        const maskedKey = "••••••••••••••••••";

        tr.innerHTML = `
            <td><strong>${escapeHTML(item.KeyName)}</strong></td>
            <td>
                <div class="api-key-cell">
                    <span id="key-text-${item.id}" class="api-key-text" data-actual="${escapeHTML(item.imgbbApi)}">${maskedKey}</span>
                    <button class="icon-btn eye-btn" title="দেখুন/লুকান" onclick="window.toggleKeyVisibility('${item.id}')">
                        <svg id="eye-svg-${item.id}" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    </button>
                </div>
            </td>
            <td>${statusBadge}</td>
            <td>${formatTimestamp(item.createdAt)}</td>
            <td>${formatTimestamp(item.updatedAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn copy-btn" title="JSON কপি করুন" onclick="window.copyDocumentJson('${item.id}')">
                        <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                    <button class="icon-btn edit-btn" title="সম্পাদনা" onclick="window.openEditModal('${item.id}')">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="icon-btn delete-btn" title="ডিলিট" onclick="window.openDeleteModal('${item.id}')">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </td>
        `;
        apiTableBody.appendChild(tr);
    });
}

// HTML Escaper
function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

// Toggle API Key Visibility (Mask / Unmask)
window.toggleKeyVisibility = function(id) {
    const textSpan = document.getElementById(`key-text-${id}`);
    const actualKey = textSpan.getAttribute("data-actual");
    const maskedKey = "••••••••••••••••••";
    
    if (textSpan.textContent === maskedKey) {
        textSpan.textContent = actualKey;
    } else {
        textSpan.textContent = maskedKey;
    }
};

// JSON Copy Function with HTTP Fallback Support
window.copyDocumentJson = function(id) {
    const item = allLoadedKeys.find(k => k.id === id);
    if (!item) {
        showToast("JSON কপি করা যায়নি।", "error");
        return;
    }

    // Strict Field Order: imgbbApi, KeyName, active, createdAt, updatedAt
    const jsonObject = {
        imgbbApi: item.imgbbApi,
        KeyName: item.KeyName,
        active: item.active,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    };

    const jsonString = JSON.stringify(jsonObject, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonString).then(() => {
            showToast("JSON সফলভাবে কপি হয়েছে।");
        }).catch(() => {
            fallbackCopyText(jsonString);
        });
    } else {
        fallbackCopyText(jsonString);
    }
};

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";  // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("JSON সফলভাবে কপি হয়েছে।");
        } else {
            showToast("JSON কপি করা যায়নি।", "error");
        }
    } catch (err) {
        showToast("JSON কপি করা যায়নি।", "error");
    }

    document.body.removeChild(textArea);
}

// Client-Side Search Filtering
searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
        renderKeys(allLoadedKeys);
        return;
    }

    const filtered = allLoadedKeys.filter(item => 
        (item.KeyName && item.KeyName.toLowerCase().includes(term)) ||
        (item.imgbbApi && item.imgbbApi.toLowerCase().includes(term))
    );

    renderKeys(filtered);
});

// Modal Management Controls
openCreateModalBtn.addEventListener("click", () => createModal.classList.remove("hidden"));

document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        document.getElementById(modalId).classList.add("hidden");
    });
});

// Create API Key Handler
createApiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const keyName = document.getElementById("create-keyname").value.trim();
    const apiKey = document.getElementById("create-apikey").value.trim();
    const active = document.getElementById("create-active").checked;

    if (!keyName || !apiKey) {
        showToast("API কী দিন এবং কী-এর নাম দিন", "error");
        return;
    }

    try {
        await addDoc(collection(db, "imgbb_api"), {
            imgbbApi: apiKey,
            KeyName: keyName,
            active: active,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        showToast("API কী সফলভাবে তৈরি হয়েছে।");
        createModal.classList.add("hidden");
        createApiForm.reset();
        loadInitialKeys();

    } catch (error) {
        console.error("Create error:", error);
        showToast("কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
});

// Global Edit Modal Trigger
window.openEditModal = function(id) {
    const item = allLoadedKeys.find(k => k.id === id);
    if (!item) return;

    document.getElementById("edit-doc-id").value = item.id;
    document.getElementById("edit-keyname").value = item.KeyName;
    document.getElementById("edit-apikey").value = item.imgbbApi;
    document.getElementById("edit-active").checked = item.active;

    editModal.classList.remove("hidden");
};

// Update API Key Handler
editApiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const docId = document.getElementById("edit-doc-id").value;
    const keyName = document.getElementById("edit-keyname").value.trim();
    const apiKey = document.getElementById("edit-apikey").value.trim();
    const active = document.getElementById("edit-active").checked;

    if (!keyName || !apiKey) {
        showToast("API কী দিন এবং কী-এর নাম দিন", "error");
        return;
    }

    try {
        const docRef = doc(db, "imgbb_api", docId);
        await updateDoc(docRef, {
            imgbbApi: apiKey,
            KeyName: keyName,
            active: active,
            updatedAt: serverTimestamp()
        });

        showToast("API কী সফলভাবে আপডেট হয়েছে।");
        editModal.classList.add("hidden");
        loadInitialKeys();

    } catch (error) {
        console.error("Update error:", error);
        showToast("কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
});

// Global Delete Modal Trigger
window.openDeleteModal = function(id) {
    selectedDeleteId = id;
    deleteModal.classList.remove("hidden");
};

// Confirm Delete Handler
confirmDeleteBtn.addEventListener("click", async () => {
    if (!selectedDeleteId) return;

    try {
        await deleteDoc(doc(db, "imgbb_api", selectedDeleteId));
        showToast("API কী সফলভাবে মুছে ফেলা হয়েছে।");
        deleteModal.classList.add("hidden");
        selectedDeleteId = null;
        loadInitialKeys();
    } catch (error) {
        console.error("Delete error:", error);
        showToast("কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
});
