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
    setDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs,
    serverTimestamp,
    increment 
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

const OWNER_EMAILS = [
    "shohidhossain@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

let resellerList = [];
let lastVisibleDocument = null;
let isLoading = false;
let hasMoreData = true;
let currentSearchTerm = "";
let currentFilterStatus = "";
let selectedDeleteId = null;
let selectedVerifyItem = null;

const authLoader = document.getElementById("auth-loader");
const appContainer = document.getElementById("app-container");
const userEmailDisplay = document.getElementById("user-email-display");
const userBadge = document.getElementById("user-badge");
const logoutBtn = document.getElementById("logout-btn");
const resellerTbody = document.getElementById("reseller-tbody");
const mobileCardsContainer = document.getElementById("mobile-cards-container");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const emptyStateText = document.getElementById("empty-state-text");
const loadMoreWrap = document.getElementById("load-more-wrap");
const loadMoreBtn = document.getElementById("load-more-btn");
const searchInput = document.getElementById("search-input");
const filterStatusSelect = document.getElementById("filter-status");

const editModal = document.getElementById("edit-modal");
const deleteModal = document.getElementById("delete-modal");
const detailsModal = document.getElementById("details-modal");
const imagePreviewModal = document.getElementById("image-preview-modal");
const balanceModal = document.getElementById("balance-modal");
const verifyModal = document.getElementById("verify-modal");

const editResellerForm = document.getElementById("edit-reseller-form");
const balanceForm = document.getElementById("balance-form");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const confirmVerifyBtn = document.getElementById("confirm-verify-btn");

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function generateRandomTrxId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function getUniqueTrxId() {
    let trxId = generateRandomTrxId();
    let exists = true;
    while (exists) {
        const q = query(collection(db, "transection"));
        const snapshot = await getDocs(q);
        let found = false;
        snapshot.forEach(docSnap => {
            if (docSnap.data().transectionId === trxId) {
                found = true;
            }
        });
        if (found) {
            trxId = generateRandomTrxId();
        } else {
            exists = false;
        }
    }
    return trxId;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/admin/");
        return;
    }

    const emailLower = user.email ? user.email.toLowerCase().trim() : "";
    let isOwner = OWNER_EMAILS.some(email => email.toLowerCase() === emailLower);

    if (isOwner) {
        userBadge.textContent = "OWNER";
        initPanel(user);
        return;
    }

    try {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            if (adminData.active === true && adminData.uid === user.uid && adminData.email.toLowerCase() === emailLower) {
                userBadge.textContent = "ADMIN";
                initPanel(user);
                return;
            }
        }
        
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
    loadInitialResellers();
}

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/admin/");
    } catch (error) {
        showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
    }
});

async function loadInitialResellers() {
    try {
        isLoading = true;
        loadingState.classList.remove("hidden");
        emptyState.classList.add("hidden");
        resellerList = [];
        lastVisibleDocument = null;
        hasMoreData = true;

        const q = query(collection(db, "reseller"), orderBy("name", "asc"), limit(20));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            loadingState.classList.add("hidden");
            emptyState.classList.remove("hidden");
            loadMoreWrap.classList.add("hidden");
            return;
        }

        snapshot.forEach((docSnap) => {
            resellerList.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisibleDocument = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < 20) {
            hasMoreData = false;
            loadMoreWrap.classList.add("hidden");
        } else {
            loadMoreWrap.classList.remove("hidden");
        }

        loadingState.classList.add("hidden");
        renderResellers(resellerList);

    } catch (error) {
        console.error("Error loading resellers:", error);
        loadingState.classList.add("hidden");
        showToast("রিসেলারদের তথ্য লোড করা যায়নি।", "error");
    } finally {
        isLoading = false;
    }
}

async function loadMoreResellers() {
    if (isLoading || !hasMoreData || currentSearchTerm !== "" || currentFilterStatus !== "") return;

    try {
        isLoading = true;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "আরও লোড হচ্ছে...";

        const q = query(
            collection(db, "reseller"), 
            orderBy("name", "asc"), 
            startAfter(lastVisibleDocument), 
            limit(20)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            hasMoreData = false;
            loadMoreWrap.classList.add("hidden");
            return;
        }

        snapshot.forEach((docSnap) => {
            resellerList.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisibleDocument = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < 20) {
            hasMoreData = false;
            loadMoreWrap.classList.add("hidden");
        }

        renderResellers(resellerList);

    } catch (error) {
        console.error("Error loading more resellers:", error);
        showToast("আরও তথ্য লোড করা যায়নি।", "error");
    } finally {
        isLoading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = "<span>আরও দেখুন</span>";
    }
}

loadMoreBtn.addEventListener("click", loadMoreResellers);

function renderResellers(listToRender) {
    resellerTbody.innerHTML = "";
    mobileCardsContainer.innerHTML = "";

    if (listToRender.length === 0) {
        emptyState.classList.remove("hidden");
        emptyStateText.textContent = "কোনো রিসেলার পাওয়া যায়নি";
        return;
    }

    emptyState.classList.add("hidden");

    listToRender.forEach((item) => {
        const isActive = item.active === true;
        const isVerified = item.verified === true;
        
        const statusHtml = `
            <span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'সক্রিয়' : 'বন্ধ'}</span>
            <span class="status-badge ${isVerified ? 'active' : 'inactive'}">${isVerified ? 'ভেরিফাইড' : 'আনভেরিফাইড'}</span>
        `;

        const whatsappNumber = item.whatsApp || item.phone || "";
        const cleanWhatsApp = whatsappNumber.replace(/[^0-9]/g, "");
        const whatsappLink = cleanWhatsApp ? `https://wa.me/${cleanWhatsApp}` : "#";

        const statusToggleText = isActive ? "অ্যাকাউন্ট বন্ধ করুন" : "অ্যাকাউন্ট চালু করুন";
        const verifyBtnHtml = !isVerified ? `<button class="action-btn verify-action" onclick="window.openVerifyModal('${item.id}')">ভেরিফাইড</button>` : '';

        // Desktop Table Row
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHTML(item.name)}</strong></td>
            <td>${escapeHTML(item.email)}</td>
            <td>
                ${escapeHTML(item.phone)}<br>
                ${cleanWhatsApp ? `<a href="${whatsappLink}" target="_blank" class="whatsapp-link">💬 WhatsApp</a>` : ''}
            </td>
            <td><strong>৳${item.balance || 0}</strong></td>
            <td>${statusHtml}</td>
            <td><code>${escapeHTML(item.transectionId || 'N/A')}</code></td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn details-action" onclick="window.openDetailsModal('${item.id}')">সবকিছু দেখুন</button>
                    ${verifyBtnHtml}
                    <button class="action-btn balance-action" onclick="window.openBalanceModal('${item.id}')">Balance Manage</button>
                    <button class="action-btn status-toggle-btn" onclick="window.toggleStatus('${item.id}', ${!isActive})">${statusToggleText}</button>
                    <button class="action-btn edit-action" onclick="window.openEditModal('${item.id}')">সম্পাদনা</button>
                    <button class="action-btn delete-action" onclick="window.openDeleteModal('${item.id}')">ডিলিট</button>
                </div>
            </td>
        `;
        resellerTbody.appendChild(tr);

        // Mobile Card View
        const card = document.createElement("div");
        card.className = "reseller-card";
        card.innerHTML = `
            <div class="reseller-card-row"><span class="reseller-card-label">নাম</span><span class="reseller-card-val">${escapeHTML(item.name)}</span></div>
            <div class="reseller-card-row"><span class="reseller-card-label">ইমেইল</span><span class="reseller-card-val">${escapeHTML(item.email)}</span></div>
            <div class="reseller-card-row"><span class="reseller-card-label">ফোন / WhatsApp</span><span class="reseller-card-val">${escapeHTML(item.phone)} ${cleanWhatsApp ? `<a href="${whatsappLink}" target="_blank">💬</a>` : ''}</span></div>
            <div class="reseller-card-row"><span class="reseller-card-label">ব্যালেন্স</span><span class="reseller-card-val">৳${item.balance || 0}</span></div>
            <div class="reseller-card-row"><span class="reseller-card-label">স্ট্যাটাস</span><span class="reseller-card-val">${statusHtml}</span></div>
            <div class="reseller-card-row"><span class="reseller-card-label">TrxID</span><span class="reseller-card-val"><code>${escapeHTML(item.transectionId || 'N/A')}</code></span></div>
            <div class="reseller-card-actions">
                <button class="action-btn details-action" onclick="window.openDetailsModal('${item.id}')">সবকিছু দেখুন</button>
                ${verifyBtnHtml}
                <button class="action-btn balance-action" onclick="window.openBalanceModal('${item.id}')">Balance Manage</button>
                <button class="action-btn status-toggle-btn" onclick="window.toggleStatus('${item.id}', ${!isActive})">${statusToggleText}</button>
                <button class="action-btn edit-action" onclick="window.openEditModal('${item.id}')">সম্পাদনা</button>
                <button class="action-btn delete-action" onclick="window.openDeleteModal('${item.id}')">ডিলিট</button>
            </div>
        `;
        mobileCardsContainer.appendChild(card);
    });
}

function filterAndRender() {
    let filtered = resellerList;

    if (currentFilterStatus) {
        if (currentFilterStatus === "active") filtered = filtered.filter(i => i.active === true);
        if (currentFilterStatus === "inactive") filtered = filtered.filter(i => i.active !== true);
        if (currentFilterStatus === "verified") filtered = filtered.filter(i => i.verified === true);
    }

    if (currentSearchTerm) {
        filtered = filtered.filter(item => 
            (item.name && item.name.toLowerCase().includes(currentSearchTerm)) ||
            (item.email && item.email.toLowerCase().includes(currentSearchTerm)) ||
            (item.phone && item.phone.toLowerCase().includes(currentSearchTerm)) ||
            (item.whatsApp && item.whatsApp.toLowerCase().includes(currentSearchTerm)) ||
            (item.sendMoneyNumber && item.sendMoneyNumber.includes(currentSearchTerm)) ||
            (item.transectionId && item.transectionId.toLowerCase().includes(currentSearchTerm))
        );
    }

    renderResellers(filtered);
}

searchInput.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    if (currentSearchTerm || currentFilterStatus) loadMoreWrap.classList.add("hidden");
    else if (hasMoreData) loadMoreWrap.classList.remove("hidden");
    filterAndRender();
});

filterStatusSelect.addEventListener("change", (e) => {
    currentFilterStatus = e.target.value;
    if (currentSearchTerm || currentFilterStatus) loadMoreWrap.classList.add("hidden");
    else if (hasMoreData) loadMoreWrap.classList.remove("hidden");
    filterAndRender();
});

// View All / Details Modal
window.openDetailsModal = function(id) {
    const item = resellerList.find(r => r.id === id);
    if (!item) return;

    const body = document.getElementById("details-modal-body");
    body.innerHTML = `
        <p><strong>নাম:</strong> ${escapeHTML(item.name)}</p>
        <p><strong>ইমেইল:</strong> ${escapeHTML(item.email)}</p>
        <p><strong>ফোন:</strong> ${escapeHTML(item.phone)}</p>
        <p><strong>WhatsApp:</strong> ${escapeHTML(item.whatsApp || 'নেই')} ${item.whatsApp ? `<a href="https://wa.me/${item.whatsApp.replace(/[^0-9]/g,'')}" target="_blank">চ্যাট করুন</a>` : ''}</p>
        <p><strong>সেন্ড মানি নম্বর:</strong> ${escapeHTML(item.sendMoneyNumber || 'নেই')}</p>
        <p><strong>ট্রানজেকশন আইডি:</strong> ${escapeHTML(item.transectionId || 'নেই')}</p>
        <p><strong>ব্যালেন্স:</strong> ৳${item.balance || 0}</p>
        <p><strong>UID:</strong> ${escapeHTML(item.uid || 'নেই')}</p>
        <p><strong>রেফারেল কোড:</strong> ${escapeHTML(item.refferalCode || 'নেই')}</p>
        <p><strong>রেফারেল ইউজার আইডি:</strong> ${escapeHTML(item.refferalUserId || 'নেই')}</p>
        <p><strong>সক্রিয় অবস্থা:</strong> ${item.active ? 'সক্রিয়' : 'বন্ধ'}</p>
        <p><strong>ভেরিফাইড অবস্থা:</strong> ${item.verified ? 'ভেরিফাইড' : 'আনভেরিফাইড'}</p>
        <div class="nid-preview-section">
            <p><strong>NID Front:</strong></p>
            ${item.nidFront ? `<img src="${item.nidFront}" class="nid-thumb" onclick="window.previewImage('${item.nidFront}')">` : 'ছবি নেই'}
            <p><strong>NID Back:</strong></p>
            ${item.nidBack ? `<img src="${item.nidBack}" class="nid-thumb" onclick="window.previewImage('${item.nidBack}')">` : 'ছবি নেই'}
        </div>
    `;
    detailsModal.classList.remove("hidden");
};

window.previewImage = function(url) {
    document.getElementById("preview-img-tag").src = url;
    imagePreviewModal.classList.remove("hidden");
};

window.toggleStatus = async function(id, newStatus) {
    try {
        const docRef = doc(db, "reseller", id);
        await updateDoc(docRef, { active: newStatus });
        const item = resellerList.find(r => r.id === id);
        if (item) item.active = newStatus;
        filterAndRender();
        showToast("স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে।");
    } catch (error) {
        showToast("স্ট্যাটাস পরিবর্তন করা যায়নি।", "error");
    }
};

// Verification Flow
window.openVerifyModal = function(id) {
    selectedVerifyItem = resellerList.find(r => r.id === id);
    if (!selectedVerifyItem) return;

    const modalText = document.getElementById("verify-modal-text");
    if (selectedVerifyItem.refferalUserId && selectedVerifyItem.refferalCode) {
        modalText.innerHTML = `এই অ্যাকাউন্টটি ভেরিফাই করলে রেফারার অ্যাকাউন্টে <b>৩০ টাকা</b> বোনাস যোগ হবে। আপনি কি নিশ্চিত?`;
    } else {
        modalText.innerHTML = `এই অ্যাকাউন্টটি সরাসরি ভেরিফাই করতে চান?`;
    }
    verifyModal.classList.remove("hidden");
};

confirmVerifyBtn.addEventListener("click", async () => {
    if (!selectedVerifyItem) return;

    try {
        const resellerRef = doc(db, "reseller", selectedVerifyItem.id);
        
        if (selectedVerifyItem.refferalUserId && selectedVerifyItem.refferalCode) {
            const bonusAmount = 30;
            const referrerDocRef = doc(db, "reseller", selectedVerifyItem.refferalUserId);
            const referrerSnap = await getDoc(referrerDocRef);

            if (referrerSnap.exists()) {
                const referrerData = referrerSnap.data();
                const oldBal = referrerData.balance || 0;
                const newBal = oldBal + bonusAmount;

                await updateDoc(referrerDocRef, { balance: newBal });

                const uniqueTrx = await getUniqueTrxId();
                await setDoc(doc(collection(db, "transection")), {
                    uid: selectedVerifyItem.refferalUserId,
                    oldBalance: oldBal,
                    balance: newBal,
                    name: "আপনার রেফার আইডি দিয়ে একাউন্ট করা হয়েছে",
                    note: "আপনার রেফার কোড ব্যবহার করে রিসেলার একাউন্ট তৈরি করার কারণে আপনি ৩০ টাকা পেয়েছেন!",
                    createdAt: serverTimestamp(),
                    transectionId: uniqueTrx
                });
            }
        }

        await updateDoc(resellerRef, { verified: true });
        showToast("অ্যাকাউন্ট সফলভাবে ভেরিফাইড করা হয়েছে।");
        verifyModal.classList.add("hidden");
        selectedVerifyItem = null;
        loadInitialResellers();
    } catch (error) {
        console.error("Verification error:", error);
        showToast("ভেরিফিকেশন সম্পন্ন করা যায়নি।", "error");
    }
});

// Balance Management Modal
window.openBalanceModal = function(id) {
    const item = resellerList.find(r => r.id === id);
    if (!item) return;

    document.getElementById("balance-reseller-id").value = item.id;
    document.getElementById("balance-amount").value = "";
    document.getElementById("balance-note").value = "";
    balanceModal.classList.remove("hidden");
};

balanceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const resellerId = document.getElementById("balance-reseller-id").value;
    const actionType = document.getElementById("balance-action-type").value;
    const amount = Number(document.getElementById("balance-amount").value);
    const note = document.getElementById("balance-note").value.trim();

    if (!amount || amount <=0) {
        showToast("সঠিক পরিমাণ লিখুন।", "error");
        return;
    }

    try {
        const docRef = doc(db, "reseller", resellerId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const oldBalance = data.balance || 0;
        let newBalance = oldBalance;

        if (actionType === "add") {
            newBalance = oldBalance + amount;
        } else {
            newBalance = oldBalance - amount;
            if (newBalance < 0) newBalance = 0;
        }

        await updateDoc(docRef, { balance: newBalance });

        const uniqueTrx = await getUniqueTrxId();
        await setDoc(doc(collection(db, "transection")), {
            uid: resellerId,
            oldBalance: oldBalance,
            balance: newBalance,
            name: actionType === "add" ? "ব্যালেন্স যুক্ত করা হয়েছে" : "ব্যালেন্স কমানো হয়েছে",
            note: note,
            createdAt: serverTimestamp(),
            transectionId: uniqueTrx
        });

        showToast("ব্যালেন্স সফলভাবে আপডেট করা হয়েছে।");
        balanceModal.classList.add("hidden");
        loadInitialResellers();
    } catch (error) {
        console.error("Balance update error:", error);
        showToast("ব্যালেন্স আপডেট করা যায়নি।", "error");
    }
});

window.openEditModal = function(id) {
    const item = resellerList.find(r => r.id === id);
    if (!item) return;

    document.getElementById("edit-original-id").value = item.id;
    document.getElementById("edit-name").value = item.name || "";
    document.getElementById("edit-phone").value = item.phone || "";
    document.getElementById("edit-whatsapp").value = item.whatsApp || "";

    editModal.classList.remove("hidden");
};

document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        document.getElementById(modalId).classList.add("hidden");
    });
});

editResellerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const originalId = document.getElementById("edit-original-id").value;
    
    const updatedData = {
        name: document.getElementById("edit-name").value.trim(),
        phone: document.getElementById("edit-phone").value.trim(),
        whatsApp: document.getElementById("edit-whatsapp").value.trim()
    };

    try {
        const docRef = doc(db, "reseller", originalId);
        await updateDoc(docRef, updatedData);
        showToast("তথ্য সফলভাবে আপডেট হয়েছে।");
        editModal.classList.add("hidden");
        loadInitialResellers();
    } catch (error) {
        showToast("তথ্য আপডেট করা যায়নি।", "error");
    }
});

window.openDeleteModal = function(id) {
    selectedDeleteId = id;
    deleteModal.classList.remove("hidden");
};

confirmDeleteBtn.addEventListener("click", async () => {
    if (!selectedDeleteId) return;
    try {
        await deleteDoc(doc(db, "reseller", selectedDeleteId));
        showToast("সফলভাবে মুছে ফেলা হয়েছে।");
        deleteModal.classList.add("hidden");
        selectedDeleteId = null;
        loadInitialResellers();
    } catch (error) {
        showToast("মুছে ফেলা যায়নি।", "error");
    }
});

function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}
