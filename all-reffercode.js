import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, query, orderBy, limit, startAfter, 
    getDocs, doc, getDoc, updateDoc, deleteDoc, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyBRSt2aoSJ-lumYAWGAXE6ncui7__TqJ4E",
  authDomain: "sera-product.firebaseapp.com",
  projectId: "sera-product",
  storageBucket: "sera-product.firebasestorage.app",
  messagingSenderId: "516762224598",
  appId: "1:516762224598:web:b6a571f355a8a4a97c0677",
  measurementId: "G-RLMWH43FXX"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const OWNERS = [
    "shohidhossain@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

let lastVisibleDoc = null;
let isLoading = false;
let hasMore = true;
let currentSearchTerm = "";
let referralCacheList = [];
const resellerCache = new Map();
let deleteTargetId = null;

const referralGrid = document.getElementById("referralGrid");
const loadMoreWrapper = document.getElementById("loadMoreWrapper");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const searchInput = document.getElementById("searchInput");
const userInfoText = document.getElementById("userInfoText");

// Modals Elements
const editModal = document.getElementById("editModal");
const resellerModal = document.getElementById("resellerModal");
const deleteModal = document.getElementById("deleteModal");
const resellerModalBody = document.getElementById("resellerModalBody");

// Form Elements
const editDocId = document.getElementById("editDocId");
const editEmail = document.getElementById("editEmail");
const editUid = document.getElementById("editUid");
const editCreatedAt = document.getElementById("editCreatedAt");
const editCodeInput = document.getElementById("editCodeInput");

// Toast Notification
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Authentication Flow
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://admin.seraproduct.com";
        return;
    }

    const email = user.email;
    let isAuthorized = false;
    let roleName = "";

    if (OWNERS.includes(email)) {
        isAuthorized = true;
        roleName = "ওনার";
    } else {
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminSnap = await getDoc(adminDocRef);
            if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                if (adminData.active === true && adminData.email === email) {
                    isAuthorized = true;
                    roleName = "অ্যাডমিন";
                }
            }
        } catch (error) {
            console.error("Authorization check error:", error);
        }
    }

    if (!isAuthorized) {
        window.location.href = "https://admin.seraproduct.com";
        return;
    }

    userInfoText.innerText = `${roleName} : ${email}`;
    loadReferralCodes();
});

// Format Firestore Timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return "তারিখ পাওয়া যায়নি";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    }).format(date);
}

// Load Referral Codes
async function loadReferralCodes(isLoadMore = false) {
    if (isLoading || (!hasMore && isLoadMore)) return;
    isLoading = true;

    if (!isLoadMore) {
        referralGrid.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
        referralCacheList = [];
    }

    try {
        let q;
        if (currentSearchTerm) {
            q = query(
                collection(db, "referral_code"),
                where("code", "==", currentSearchTerm),
                limit(20)
            );
        } else {
            if (isLoadMore && lastVisibleDoc) {
                q = query(
                    collection(db, "referral_code"),
                    orderBy("createdAt", "desc"),
                    startAfter(lastVisibleDoc),
                    limit(20)
                );
            } else {
                q = query(
                    collection(db, "referral_code"),
                    orderBy("createdAt", "desc"),
                    limit(20)
                );
            }
        }

        const snapshot = await getDocs(q);
        
        if (!isLoadMore) {
            referralGrid.innerHTML = "";
        }

        if (snapshot.empty && !isLoadMore && !currentSearchTerm) {
            referralGrid.innerHTML = `<div class="empty-state">কোনো রেফারেল কোড পাওয়া যায়নি</div>`;
            loadMoreWrapper.style.display = "none";
            isLoading = false;
            return;
        }

        if (snapshot.empty && currentSearchTerm && !isLoadMore) {
            referralGrid.innerHTML = `<div class="empty-state">আপনার অনুসন্ধানের সাথে কোনো রেফারেল কোড পাওয়া যায়নি</div>`;
            loadMoreWrapper.style.display = "none";
            isLoading = false;
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < 20) {
            hasMore = false;
            loadMoreWrapper.style.display = "none";
        } else {
            hasMore = true;
            loadMoreWrapper.style.display = "block";
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const item = { id, ...data };
            referralCacheList.push(item);
            renderCard(item);
        });

    } catch (error) {
        console.error("Error loading referral codes:", error);
        showToast("ডাটা লোড করতে সমস্যা হয়েছে");
    } finally {
        isLoading = false;
    }
}

// Render Card
function renderCard(item) {
    const card = document.createElement("div");
    card.className = "referral-card";
    card.id = `card-${item.id}`;

    const formattedDate = formatTimestamp(item.createdAt);

    card.innerHTML = `
        <div>
            <div class="card-info-item">
                <label>রেফারেল কোড</label>
                <span class="code-badge">${item.code || "N/A"}</span>
            </div>
            <div class="card-info-item">
                <label>ইমেল</label>
                <span>${item.email || "N/A"}</span>
            </div>
            <div class="card-info-item">
                <label>ইউআইডি</label>
                <span>${item.uid || "N/A"}</span>
            </div>
            <div class="card-info-item">
                <label>তৈরির সময়</label>
                <span>${formattedDate}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="btn-sm btn-primary-sm" onclick="openEditModal('${item.id}')">সম্পাদনা</button>
            <button class="btn-sm btn-danger-sm" onclick="openDeleteModal('${item.id}')">ডিলিট</button>
            <button class="btn-sm" onclick="fetchResellerInfo('${item.uid}')">রিসেলার-এর তথ্য দেখুন</button>
            <button class="btn-sm" onclick="copyJsonData('${item.id}')">JSON কপি</button>
        </div>
    `;
    referralGrid.appendChild(card);
}

// Search Handler with Debounce
let searchTimer;
searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentSearchTerm = e.target.value.trim();
        lastVisibleDoc = null;
        hasMore = true;
        loadReferralCodes();
    }, 400);
});

// Load More Click
loadMoreBtn.addEventListener("click", () => {
    loadReferralCodes(true);
});

// Edit Modal Logic
window.openEditModal = function(id) {
    const item = referralCacheList.find(i => i.id === id);
    if (!item) return;

    editDocId.value = item.id;
    editEmail.value = item.email || "";
    editUid.value = item.uid || "";
    editCreatedAt.value = formatTimestamp(item.createdAt);
    editCodeInput.value = item.code || "";

    editModal.style.display = "flex";
};

document.getElementById("closeEditModal").addEventListener("click", () => editModal.style.display = "none");
document.getElementById("cancelEditBtn").addEventListener("click", () => editModal.style.display = "none");

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const id = editDocId.value;
    const newCode = editCodeInput.value.trim();

    if (!newCode) {
        showToast("কোড খালি রাখা যাবে না");
        return;
    }

    const codeRegex = /^[A-Za-z0-9]+$/;
    if (!codeRegex.test(newCode)) {
        showToast("কোডে শুধুমাত্র ইংরেজি অক্ষর ও সংখ্যা ব্যবহার করা যাবে");
        return;
    }

    try {
        // Check duplicate code
        const q = query(collection(db, "referral_code"), where("code", "==", newCode), limit(1));
        const snap = await getDocs(q);
        
        let isDuplicate = false;
        snap.forEach(docSnap => {
            if (docSnap.id !== id) {
                isDuplicate = true;
            }
        });

        if (isDuplicate) {
            showToast("এই রেফারেল কোডটি ইতিমধ্যে ব্যবহার করা হয়েছে।");
            return;
        }

        const docRef = doc(db, "referral_code", id);
        await updateDoc(docRef, { code: newCode });

        // Update local state
        const item = referralCacheList.find(i => i.id === id);
        if (item) item.code = newCode;

        // Re-render card element
        const cardElem = document.getElementById(`card-${id}`);
        if (cardElem) {
            cardElem.querySelector(".code-badge").innerText = newCode;
        }

        editModal.style.display = "none";
        showToast("রেফারেল কোড সফলভাবে আপডেট হয়েছে");
    } catch (error) {
        console.error("Error updating code:", error);
        showToast("আপডেট করতে সমস্যা হয়েছে");
    }
});

// Delete Logic
window.openDeleteModal = function(id) {
    deleteTargetId = id;
    deleteModal.style.display = "flex";
};

document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
    deleteTargetId = null;
    deleteModal.style.display = "none";
});

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
    if (!deleteTargetId) return;

    try {
        await deleteDoc(doc(db, "referral_code", deleteTargetId));
        
        // Remove from DOM
        const cardElem = document.getElementById(`card-${deleteTargetId}`);
        if (cardElem) cardElem.remove();

        // Remove from cache list
        referralCacheList = referralCacheList.filter(i => i.id !== deleteTargetId);

        deleteModal.style.display = "none";
        deleteTargetId = null;
        showToast("রেফারেল কোড মুছে ফেলা হয়েছে");
    } catch (error) {
        console.error("Error deleting doc:", error);
        showToast("মুছে ফেলতে সমস্যা হয়েছে");
    }
});

// Reseller Lazy Load & Cache
window.fetchResellerInfo = async function(uid) {
    if (!uid) {
        showToast("কোনো ইউআইডি পাওয়া যায়নি");
        return;
    }

    resellerModalBody.innerHTML = `<div style="text-align:center; padding: 20px;">রিসেলারের তথ্য লোড হচ্ছে...</div>`;
    resellerModal.style.display = "flex";

    if (resellerCache.has(uid)) {
        renderResellerData(resellerCache.get(uid));
        return;
    }

    try {
        const resellerRef = doc(db, "reseller", uid);
        const resellerSnap = await getDoc(resellerRef);

        if (!resellerSnap.exists()) {
            resellerModalBody.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">এই UID-এর কোনো রিসেলার তথ্য পাওয়া যায়নি।</div>`;
            return;
        }

        const data = resellerSnap.data();
        resellerCache.set(uid, data);
        renderResellerData(data);
        showToast("রিসেলারের তথ্য লোড হয়েছে");
    } catch (error) {
        console.error("Error fetching reseller:", error);
        resellerModalBody.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--danger);">ডাটা লোড করতে সমস্যা হয়েছে</div>`;
    }
};

function renderResellerData(data) {
    const activeStatus = data.active ? '<span class="status-badge status-active">চালু</span>' : '<span class="status-badge status-inactive">বন্ধ</span>';
    const verifiedStatus = data.verified ? '<span class="status-badge status-verified">যাচাইকৃত</span>' : '<span class="status-badge status-unverified">যাচাই করা হয়নি</span>';

    resellerModalBody.innerHTML = `
        <div class="card-info-item"><label>নাম</label><span>${data.name || "N/A"}</span></div>
        <div class="card-info-item"><label>ফোন</label><span>${data.phone || "N/A"}</span></div>
        <div class="card-info-item"><label>হোয়াটসঅ্যাপ</label><span>${data.whatsApp || "N/A"}</span></div>
        <div class="card-info-item"><label>ইমেল</label><span>${data.email || "N/A"}</span></div>
        <div class="card-info-item"><label>অ্যাকাউন্টের অবস্থা</label><span>${activeStatus}</span></div>
        <div class="card-info-item"><label>যাচাইকরণের অবস্থা</label><span>${verifiedStatus}</span></div>
    `;
}

document.getElementById("closeResellerModal").addEventListener("click", () => resellerModal.style.display = "none");
document.getElementById("closeResellerBtn").addEventListener("click", () => resellerModal.style.display = "none");

// JSON Copy
window.copyJsonData = function(id) {
    const item = referralCacheList.find(i => i.id === id);
    if (!item) return;

    const dataToCopy = {
        id: item.id,
        code: item.code,
        createdAt: item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : item.createdAt,
        email: item.email,
        uid: item.uid
    };

    const jsonString = JSON.stringify(dataToCopy, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonString).then(() => {
            showToast("তথ্য কপি হয়েছে");
        }).catch(() => {
            fallbackCopyText(jsonString);
        });
    } else {
        fallbackCopyText(jsonString);
    }
};

function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
        showToast("তথ্য কপি হয়েছে");
    } catch (err) {
        showToast("কপি করতে সমস্যা হয়েছে");
    }
    document.body.removeChild(textarea);
}
