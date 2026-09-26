import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, collection, doc, getDoc, getDocs, query, orderBy, limit, startAfter,
    where, updateDoc, runTransaction, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let lastVisible = null;
let currentSearchQuery = null;
let isFetching = false;
const PAGE_LIMIT = 20;

const STATUS_MAP = {
    "pending": { text: "অপেক্ষমাণ", class: "status-pending" },
    "confirm": { text: "অর্ডার কনফার্ম করা হয়েছে!", class: "status-confirm" },
    "processing": { text: "অর্ডার প্রক্রিয়াকরণ করা হচ্ছে!", class: "status-processing" },
    "packaging": { text: "প্যাকেজ করা হচ্ছে!", class: "status-packaging" },
    "delivery": { text: "সফলভাবে ডেলিভারি করা হয়েছে!", class: "status-delivery" },
    "return": { text: "রিটার্ন করা হয়েছে!", class: "status-return" },
    "cancel": { text: "অর্ডার ক্যানসেল করা হয়েছে!", class: "status-cancel" }
};

function getStatusInfo(statusKey) {
    return STATUS_MAP[statusKey] || { text: "অজানা অবস্থা", class: "status-unknown" };
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://admin.seraproduct.com";
        return;
    }
    const email = user.email;
    let isOwner = OWNER_EMAILS.includes(email);
    let isAdmin = false;
    if (!isOwner) {
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDoc = await getDoc(adminDocRef);
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                if (data.active === true && data.email === email) {
                    isAdmin = true;
                }
            }
        } catch (e) { console.error("Admin verification error:", e); }
    }
    if (!isOwner &&!isAdmin) {
        window.location.href = "https://admin.seraproduct.com";
        return;
    }
    const badgeEl = document.getElementById('userBadge');
    const emailEl = document.getElementById('userEmailDisplay');
    const logoutBtn = document.getElementById('btnLogout');
    if (isOwner) {
        badgeEl.textContent = "OWNER";
        badgeEl.className = "badge badge-owner";
    } else {
        badgeEl.textContent = "ADMIN";
        badgeEl.className = "badge badge-admin";
    }
    emailEl.textContent = email;
    logoutBtn.style.display = "flex";
    logoutBtn.onclick = () => signOut(auth).then(() => window.location.href = "https://admin.seraproduct.com");
    loadOrders();
});

function safeVal(val, fallback = '') {
    if (val === null || val === undefined) return fallback;
    return val;
}
function formatCurrency(amount) {
    const num = Number(amount);
    return isNaN(num)? '৳ ০' : `৳ ${num.toLocaleString('bn-BD')}`;
}
function formatTimestamp(ts) {
    if (!ts) return 'তারিখ উপলব্ধ নেই';
    try {
        const date = ts.toDate? ts.toDate() : new Date(ts);
        if (isNaN(date.getTime())) return String(ts);
        return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'long', timeStyle: 'short' }).format(date);
    } catch (e) { return String(ts); }
}

async function loadOrders(isLoadMore = false, searchQuery = null) {
    if (isFetching) return;
    isFetching = true;
    const grid = document.getElementById('ordersGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!isLoadMore) {
        grid.innerHTML = Array(4).fill(0).map(() => `<div class="skeleton-card"></div>`).join('');
        lastVisible = null;
    }
    try {
        let q;
        const ordersRef = collection(db, "reseller_orders");
        if (searchQuery) {
            if (searchQuery.length === 28) {
                q = query(ordersRef, where("uid", "==", searchQuery), orderBy("createdAt", "desc"), limit(PAGE_LIMIT));
            } else if (/^01[0-9]{9}$/.test(searchQuery)) {
                q = query(ordersRef, where("customerPhone", "==", searchQuery), orderBy("createdAt", "desc"), limit(PAGE_LIMIT));
            } else {
                q = query(ordersRef, where("__name__", "==", searchQuery), limit(1));
            }
        } else {
            if (lastVisible) {
                q = query(ordersRef, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(PAGE_LIMIT));
            } else {
                q = query(ordersRef, orderBy("createdAt", "desc"), limit(PAGE_LIMIT));
            }
        }
        const snapshot = await getDocs(q);
        if (!isLoadMore) { grid.innerHTML = ""; }
        if (snapshot.empty &&!isLoadMore) {
            grid.innerHTML = `<div class="state-container" style="grid-column: 1 / -1;"><p>কোনো অর্ডার পাওয়া যায়নি।</p></div>`;
            loadMoreBtn.style.display = "none";
            isFetching = false;
            return;
        }
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            renderOrderCard(orderId, order, grid);
        });
        if (snapshot.docs.length < PAGE_LIMIT) {
            loadMoreBtn.style.display = "none";
        } else {
            loadMoreBtn.style.display = "inline-flex";
        }
    } catch (err) {
        console.error("Error loading orders:", err);
        showToast("তথ্য লোড করতে সমস্যা হয়েছে।", "error");
    } finally { isFetching = false; }
}

function renderOrderCard(orderId, order, container) {
    const productName = safeVal(order.productName, "নামবিহীন প্রোডাক্ট");
    const productImage = safeVal(order.productImage, "https://via.placeholder.com/64");
    const statusKey = safeVal(order.orderStatus, "pending");
    const statusInfo = getStatusInfo(statusKey);
    const customerName = safeVal(order.customerName, "অজ্ঞাত কাস্টমার");
    const customerPhone = safeVal(order.customerPhone, "নম্বার নেই");
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
        <div class="card-top">
            <img src="${productImage}" alt="${productName}" class="product-thumb" onerror="this.src='https://via.placeholder.com/64'">
            <div class="product-meta">
                <span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>
                <div class="product-title" title="${productName}">${productName}</div>
            </div>
        </div>
        <div class="card-divider"></div>
        <div class="customer-info-preview">
            <div>কাস্টমার: <strong>${customerName}</strong></div>
            <div>ফোন: <strong>${customerPhone}</strong></div>
        </div>
        <div class="card-actions">
            <select class="status-select" data-id="${orderId}" ${statusKey === 'delivery' || statusKey === 'return'? 'disabled' : ''}>
                <option value="pending" ${statusKey === 'pending'? 'selected' : ''}>অপেক্ষমাণ</option>
                <option value="confirm" ${statusKey === 'confirm'? 'selected' : ''}>কনফার্ম</option>
                <option value="processing" ${statusKey === 'processing'? 'selected' : ''}>প্রক্রিয়াকরণ</option>
                <option value="packaging" ${statusKey === 'packaging'? 'selected' : ''}>প্যাকেজিং</option>
                <option value="delivery" ${statusKey === 'delivery'? 'selected' : ''}>ডেলিভারি সম্পন্ন</option>
                <option value="return" ${statusKey === 'return'? 'selected' : ''}>রিটার্ন</option>
                <option value="cancel" ${statusKey === 'cancel'? 'selected' : ''}>ক্যানসেল</option>
            </select>
            <button class="btn btn-secondary btn-sm full-info-btn" data-id="${orderId}">ফুল তথ্য</button>
        </div>
        ${statusKey === 'delivery' || statusKey === 'return'? '<div style="font-size: 0.75rem; color: var(--danger); text-align: center;">এই অর্ডারটি লক করা হয়েছে।</div>' : ''}
    `;
    const selectEl = card.querySelector('.status-select');
    selectEl.addEventListener('change', (e) => handleStatusChange(orderId, order, e.target.value, selectEl));
    const fullInfoBtn = card.querySelector('.full-info-btn');
    fullInfoBtn.addEventListener('click', () => openFullInfoModal(orderId, order));
    container.appendChild(card);
}

function openFullInfoModal(orderId, order) {
    const modal = document.getElementById('orderModal');
    const body = document.getElementById('modalBodyContent');
    const deliverySiteMap = { "inside_dhaka": "ঢাকার ভেতরে", "outside_dhaka": "ঢাকার বাইরে" };
    const deliverySiteText = deliverySiteMap[order.deliverySite] || safeVal(order.deliverySite, "সাধারণ ডেলিভারি");
    let variantsHtml = '';
    if (order.variants && typeof order.variants === 'object' &&!Array.isArray(order.variants)) {
        let variantRows = '';
        for (const [key, val] of Object.entries(order.variants)) {
            variantRows += `<div class="detail-row"><span>${key}:</span><span>${val}</span></div>`;
        }
        variantsHtml = `<div class="detail-group"><h4>নির্বাচিত ভ্যারিয়েন্ট</h4>${variantRows}</div>`;
    }
    let warrantyHtml = '';
    if (order.warranty && typeof order.warranty === 'string' && order.warranty.trim()!== '') {
        warrantyHtml = `<div class="detail-row"><span>ওয়ারেন্টি:</span><span>${order.warranty}</span></div>`;
    }
    let noteHtml = '';
    if (order.customerNote && typeof order.customerNote === 'string' && order.customerNote.trim()!== '') {
        noteHtml = `<div class="detail-group"><h4>কাস্টমারের নির্দেশনা</h4><p style="font-size: 0.9rem;">${order.customerNote}</p></div>`;
    }
    let deliveryChargeInfoHtml = '';
    const isAdvance = order.deliveryChargeStatus === true;
    deliveryChargeInfoHtml += `<div class="detail-row"><span>ডেলিভারি চার্জ স্ট্যাটাস:</span><span>${isAdvance? 'ডেলিভারি চার্জ অগ্রিম পাঠানো হয়েছে!' : 'ডেলিভারি চার্জ অগ্রিম নয়!'}</span></div>`;
    if (order.sendMoneyNumber) deliveryChargeInfoHtml += `<div class="detail-row"><span>টাকা পাঠানো নাম্বার:</span><span>${order.sendMoneyNumber}</span></div>`;
    if (order.transectionId) deliveryChargeInfoHtml += `<div class="detail-row"><span>ট্রানজেকশন আইডি:</span><span>${order.transectionId}</span></div>`;
    if (order.SendDeliveryCharge) deliveryChargeInfoHtml += `<div class="detail-row"><span>ডেলিভারি চার্জ পরিমাণ:</span><span>${formatCurrency(order.SendDeliveryCharge)}</span></div>`;
    body.innerHTML = `
        <div style="display: flex; gap: 16px; align-items: center;">
            <img src="${safeVal(order.productImage, '')}" alt="Product" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span class="status-badge ${getStatusInfo(order.orderStatus).class}">${getStatusInfo(order.orderStatus).text}</span>
                <h4 style="font-size: 1.05rem; font-weight: 600;">${safeVal(order.productName, 'প্রোডাক্ট')}</h4>
                <span style="font-size: 0.85rem; color: var(--text-muted);">অর্ডার আইডি: ${orderId}</span>
            </div>
        </div>
        <div class="highlight-box"><span>ডেলিভারির সময় কাস্টমারের কাছ থেকে নিবেন</span><strong>${formatCurrency(order.total)}</strong></div>
        <div class="detail-group"><h4>কাস্টমারের তথ্য</h4>
            <div class="detail-row"><span>নাম:</span><span>${safeVal(order.customerName)}</span></div>
            <div class="detail-row"><span>ফোন:</span><span>${safeVal(order.customerPhone)}</span></div>
            <div class="detail-row"><span>বিভাগ:</span><span>${safeVal(order.customerVibag)}</span></div>
            <div class="detail-row"><span>জেলা:</span><span>${safeVal(order.customerJela)}</span></div>
            <div class="detail-row"><span>উপজেলা/থানা:</span><span>${safeVal(order['upojela/thana'])}</span></div>
            <div class="detail-row"><span>ডেলিভারি ঠিকানা:</span><span>${deliverySiteText}</span></div>
        </div>
        ${variantsHtml}
        <div class="detail-group"><h4>অর্ডারের বিবরণ</h4>
            <div class="detail-row"><span>পরিমাণ:</span><span>${safeVal(order.quantity, 1)}</span></div>
            ${warrantyHtml}
            <div class="detail-row"><span>প্রোডাক্টের মূল দাম:</span><span>${formatCurrency(order.originalPrice)}</span></div>
            <div class="detail-row"><span>ফুল প্রোডাক্ট মূল্য:</span><span>${formatCurrency(order.fullProducePrice)}</span></div>
            <div class="detail-row"><span>রিসেলারের বিক্রয়মূল্য:</span><span>${formatCurrency(order.sellPrice)}</span></div>
            <div class="detail-row"><span>সাবটোটাল:</span><span>${formatCurrency(order.subtotal)}</span></div>
            <div class="detail-row"><span>ডেলিভারি চার্জ:</span><span>${formatCurrency(order.deliveryCharge)}</span></div>
            <div class="detail-row"><span>সর্বমোট:</span><span>${formatCurrency(order.total)}</span></div>
        </div>
        <div class="detail-group"><h4>ডেলিভারি চার্জ সংক্রান্ত তথ্য</h4>${deliveryChargeInfoHtml}</div>
        <div class="detail-group"><h4>রিসেলার ও অন্যান্য তথ্য</h4>
            <div class="detail-row"><span>রিসেলার ইমেইল:</span><span>${safeVal(order.email)}</span></div>
            <div class="detail-row"><span>রিসেলার ইউআইডি:</span><span style="word-break: break-all;">${safeVal(order.uid)}</span></div>
            <div class="detail-row"><span>অর্ডার সময়:</span><span>${formatTimestamp(order.createdAt)}</span></div>
        </div>
        ${noteHtml}
    `;
    modal.classList.add('active');
}

document.getElementById('modalCloseBtn').onclick = () => document.getElementById('orderModal').classList.remove('active');
document.getElementById('modalCloseActionBtn').onclick = () => document.getElementById('orderModal').classList.remove('active');

async function handleStatusChange(orderId, order, newStatus, selectElement) {
    const oldStatus = order.orderStatus;
    if (oldStatus === 'delivery' || oldStatus === 'return') {
        showToast("এই অর্ডারটি ইতিমধ্যে লক করা হয়েছে।", "error");
        selectElement.value = oldStatus;
        return;
    }
    if (newStatus === 'delivery') {
        openDeliveryConfirmationModal(orderId, order, selectElement);
    } else if (newStatus === 'return') {
        openReturnConfirmationModal(orderId, order, selectElement);
    } else {
        try {
            const orderRef = doc(db, "reseller_orders", orderId);
            await updateDoc(orderRef, { orderStatus: newStatus });
            order.orderStatus = newStatus;
            showToast("অর্ডারের স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে।");
        } catch (e) {
            console.error("Status update error:", e);
            showToast("অর্ডারের তথ্য আপডেট করা যায়নি।", "error");
            selectElement.value = oldStatus;
        }
    }
}

// FIXED CALCULATION HERE
async function openDeliveryConfirmationModal(orderId, order, selectElement) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmModalTitle');
    const body = document.getElementById('confirmModalBodyContent');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const actionBtn = document.getElementById('confirmModalActionBtn');
    title.textContent = "ডেলিভারি কনফার্মেশন ও ব্যালেন্স হিসাব";

    const fullProducePrice = Number(order.fullProducePrice) || 0;
    const sellPrice = Number(order.sellPrice) || 0;
    const result = sellPrice - fullProducePrice; // FIXED: এটাই প্রফিট
    const uid = order.uid;

    body.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px;">নিচের হিসাব অনুযায়ী রিসেলারের ব্যালেন্স আপডেট করা হবে:</p>
        <div class="detail-row"><span>প্রোডাক্টের মূল হিসাব:</span><span>${formatCurrency(fullProducePrice)}</span></div>
        <div class="detail-row"><span>রিসেলারের বিক্রয়মূল্য:</span><span>${formatCurrency(sellPrice)}</span></div>
        <div class="detail-row"><span>প্রফিট:</span><span style="font-weight: 700; color: ${result >= 0? 'var(--success)' : 'var(--danger)'};">${formatCurrency(result)}</span></div>
        <div style="margin-top: 16px; text-align: center; font-size: 0.85rem; color: var(--text-muted);">রিসেলারের বর্তমান ব্যালেন্স লোড হচ্ছে...</div>`;
    modal.classList.add('active');
    let currentBalance = 0;
    try {
        const resellerRef = doc(db, "reseller", uid);
        const resellerSnap = await getDoc(resellerRef);
        if (resellerSnap.exists()) { currentBalance = Number(resellerSnap.data().balance) || 0; }
    } catch (e) { console.error(e); }
    const newBalance = currentBalance + result;
    body.innerHTML = `
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px;">নিচের হিসাব অনুযায়ী রিসেলারের ব্যালেন্স আপডেট করা হবে:</p>
        <div class="detail-row"><span>প্রোডাক্টের মূল হিসাব:</span><span>${formatCurrency(fullProducePrice)}</span></div>
        <div class="detail-row"><span>রিসেলারের বিক্রয়মূল্য:</span><span>${formatCurrency(sellPrice)}</span></div>
        <div class="detail-row"><span>প্রফিট:</span><span style="font-weight: 700; color: ${result >= 0? 'var(--success)' : 'var(--danger)'};">${formatCurrency(result)}</span></div>
        <div class="detail-row"><span>বর্তমান ব্যালেন্স:</span><span>${formatCurrency(currentBalance)}</span></div>
        <div class="detail-row" style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; font-weight: 700;"><span>ডেলিভারির পর ব্যালেন্স:</span><span>${formatCurrency(newBalance)}</span></div>
    `;
    const closeModal = () => {
        modal.classList.remove('active');
        cancelBtn.onclick = null;
        actionBtn.onclick = null;
        document.getElementById('confirmModalCloseBtn').onclick = null;
    };
    cancelBtn.onclick = () => { selectElement.value = order.orderStatus; closeModal(); };
    document.getElementById('confirmModalCloseBtn').onclick = () => { selectElement.value = order.orderStatus; closeModal(); };
    actionBtn.onclick = async () => { closeModal(); await executeDeliveryTransaction(orderId, order, result, currentBalance, newBalance, selectElement); };
}

async function executeDeliveryTransaction(orderId, order, result, oldBalance, newBalance, selectElement) {
    try {
        showToast("ব্যালেন্স ও অর্ডার আপডেট করা হচ্ছে...");
        const uid = order.uid;
        const resellerRef = doc(db, "reseller", uid);
        const orderRef = doc(db, "reseller_orders", orderId);
        const transectionRef = doc(collection(db, "transection"));
        let transectionId = "";
        let isUnique = false;
        while (!isUnique) {
            transectionId = "SP-TXN-" + Math.floor(10000000 + Math.random() * 90000000);
            const q = query(collection(db, "transection"), where("transectionId", "==", transectionId), limit(1));
            const snap = await getDocs(q);
            if (snap.empty) isUnique = true;
        }
        let tranName = "ব্যালেন্স পরিবর্তন হয়নি";
        if (result > 0) tranName = "ব্যালেন্স যোগ হয়েছে";
        else if (result < 0) tranName = "ব্যালেন্স থেকে টাকা কমেছে";
        const noteText = `অর্ডার ডেলিভারি সম্পন্ন হওয়ায় রিসেলারের ব্যালেন্সে ${Math.abs(result)} টাকা ${result >= 0? 'যোগ করা হয়েছে' : 'সমন্বয় করা হয়েছে'}। (অর্ডার আইডি: ${orderId}, প্রোডাক্ট: ${safeVal(order.productName)})`;
        await runTransaction(db, async (transaction) => {
            const freshOrderSnap = await transaction.get(orderRef);
            if (!freshOrderSnap.exists()) throw new Error("অর্ডারটি পাওয়া যায়নি।");
            const freshOrderStatus = freshOrderSnap.data().orderStatus;
            if (freshOrderStatus === 'delivery' || freshOrderStatus === 'return') {
                throw new Error("এই অর্ডারটির আর্থিক কার্যক্রম ইতিমধ্যে সম্পন্ন হয়েছে।");
            }
            const freshResellerSnap = await transaction.get(resellerRef);
            let currentResellerBal = oldBalance;
            if (freshResellerSnap.exists()) { currentResellerBal = Number(freshResellerSnap.data().balance) || 0; }
            const computedNewBal = currentResellerBal + result;
            if (freshResellerSnap.exists()) { transaction.update(resellerRef, { balance: computedNewBal }); }
            else { transaction.set(resellerRef, { balance: computedNewBal }); }
            transaction.update(orderRef, { orderStatus: 'delivery' });
            transaction.set(transectionRef, {
                name: tranName,
                transectionId: transectionId,
                note: noteText,
                oldBalance: currentResellerBal,
                balance: computedNewBal,
                createdAt: serverTimestamp(),
                uid: uid
            });
        });
        order.orderStatus = 'delivery';
        showToast("ডেলিভারি সফলভাবে সম্পন্ন হয়েছে এবং ব্যালেন্স আপডেট হয়েছে।");
        selectElement.value = 'delivery';
        selectElement.disabled = true;
    } catch (e) {
        console.error(e);
        showToast(e.message || "ব্যালেন্স আপডেট করা যায়নি।", "error");
        selectElement.value = order.orderStatus;
    }
}

async function openReturnConfirmationModal(orderId, order, selectElement) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmModalTitle');
    const body = document.getElementById('confirmModalBodyContent');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const actionBtn = document.getElementById('confirmModalActionBtn');
    title.textContent = "রিটার্ন কনফার্মেশন ও ডেলিভারি চার্জ হিসাব";
    const deliveryCharge = Number(order.deliveryCharge) || 0;
    const deliveryChargeStatus = order.deliveryChargeStatus === true;
    const uid = order.uid;
    body.innerHTML = `<p style="font-size: 0.9rem;">রিটার্ন প্রক্রিয়ার হিসাব লোড হচ্ছে...</p>`;
    modal.classList.add('active');
    let currentBalance = 0;
    try {
        const resellerRef = doc(db, "reseller", uid);
        const resellerSnap = await getDoc(resellerRef);
        if (resellerSnap.exists()) { currentBalance = Number(resellerSnap.data().balance) || 0; }
    } catch (e) { console.error(e); }
    const newBalance = deliveryChargeStatus? currentBalance : (currentBalance - deliveryCharge);
    body.innerHTML = `
        <div class="detail-row"><span>বর্তমান ব্যালেন্স:</span><span>${formatCurrency(currentBalance)}</span></div>
        <div class="detail-row"><span>ডেলিভারি চার্জ:</span><span>${formatCurrency(deliveryCharge)}</span></div>
        <div class="detail-row"><span>অগ্রিম দেওয়া:</span><span>${deliveryChargeStatus? 'হ্যাঁ' : 'না'}</span></div>
        <div class="detail-row" style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; font-weight: 700;"><span>রিটার্নের পর ব্যালেন্স:</span><span>${formatCurrency(newBalance)}</span></div>
        ${deliveryChargeStatus? '<p style="font-size: 0.85rem; color: var(--success); margin-top: 8px;">অগ্রিম দেওয়া হয়েছে, তাই ব্যালেন্স কাটবে না।</p>' : ''}
    `;
    const closeModal = () => {
        modal.classList.remove('active');
        cancelBtn.onclick = null;
        actionBtn.onclick = null;
        document.getElementById('confirmModalCloseBtn').onclick = null;
    };
    cancelBtn.onclick = () => { selectElement.value = order.orderStatus; closeModal(); };
    document.getElementById('confirmModalCloseBtn').onclick = () => { selectElement.value = order.orderStatus; closeModal(); };
    actionBtn.onclick = async () => { closeModal(); await executeReturnTransaction(orderId, order, deliveryCharge, deliveryChargeStatus, currentBalance, newBalance, selectElement); };
}

async function executeReturnTransaction(orderId, order, deliveryCharge, deliveryChargeStatus, oldBalance, newBalance, selectElement) {
    try {
        showToast("রিটার্ন প্রসেস করা হচ্ছে...");
        const uid = order.uid;
        const resellerRef = doc(db, "reseller", uid);
        const orderRef = doc(db, "reseller_orders", orderId);
        const transectionRef = doc(collection(db, "transection"));
        let transectionId = "";
        let isUnique = false;
        while (!isUnique) {
            transectionId = "SP-TXN-" + Math.floor(10000000 + Math.random() * 90000000);
            const q = query(collection(db, "transection"), where("transectionId", "==", transectionId), limit(1));
            const snap = await getDocs(q);
            if (snap.empty) isUnique = true;
        }
        const tranName = deliveryChargeStatus? "রিটার্নের জন্য লেনদেন রেকর্ড তৈরি হয়েছে" : "ব্যালেন্স থেকে টাকা কাটা হয়েছে";
        const noteText = deliveryChargeStatus? `অর্ডার রিটার্ন হয়েছে। ডেলিভারি চার্জ আগে থেকেই প্রদান করা থাকায় রিসেলারের ব্যালেন্স থেকে কোনো টাকা কাটা হয়নি। (অর্ডার আইডি: ${orderId})` : `অর্ডার রিটার্ন হওয়ায় ডেলিভারি চার্জ বাবদ রিসেলারের ব্যালেন্স থেকে ${deliveryCharge} টাকা কাটা হয়েছে। (অর্ডার আইডি: ${orderId})`;
        await runTransaction(db, async (transaction) => {
            const freshOrderSnap = await transaction.get(orderRef);
            if (!freshOrderSnap.exists()) throw new Error("অর্ডারটি পাওয়া যায়নি।");
            const freshOrderStatus = freshOrderSnap.data().orderStatus;
            if (freshOrderStatus === 'delivery' || freshOrderStatus === 'return') { throw new Error("এই অর্ডারটির আর্থিক কার্যক্রম ইতিমধ্যে সম্পন্ন হয়েছে।"); }
            const freshResellerSnap = await transaction.get(resellerRef);
            let currentResellerBal = oldBalance;
            if (freshResellerSnap.exists()) { currentResellerBal = Number(freshResellerSnap.data().balance) || 0; }
            const computedNewBal = deliveryChargeStatus? currentResellerBal : (currentResellerBal - deliveryCharge);
            if (!deliveryChargeStatus) {
                if (freshResellerSnap.exists()) { transaction.update(resellerRef, { balance: computedNewBal }); }
                else { transaction.set(resellerRef, { balance: computedNewBal }); }
            }
            transaction.update(orderRef, { orderStatus: 'return' });
            transaction.set(transectionRef, {
                name: tranName,
                transectionId: transectionId,
                note: noteText,
                oldBalance: currentResellerBal,
                balance: computedNewBal,
                createdAt: serverTimestamp(),
                uid: uid
            });
        });
        order.orderStatus = 'return';
        showToast("রিটার্ন সফলভাবে রেকর্ড করা হয়েছে।");
        selectElement.value = 'return';
        selectElement.disabled = true;
    } catch (e) {
        console.error(e);
        showToast(e.message || "রিটার্ন প্রক্রিয়া সম্পন্ন করা যায়নি।", "error");
        selectElement.value = order.orderStatus;
    }
}

document.getElementById('searchBtn').onclick = () => {
    const val = document.getElementById('searchInput').value.trim();
    if (!val) { showToast("অনুগ্রহ করে সার্চ কিওয়ার্ড লিখুন।", "error"); return; }
    currentSearchQuery = val;
    document.getElementById('clearSearchBtn').style.display = "inline-flex";
    loadOrders(false, currentSearchQuery);
};
document.getElementById('clearSearchBtn').onclick = () => {
    document.getElementById('searchInput').value = "";
    document.getElementById('clearSearchBtn').style.display = "none";
    currentSearchQuery = null;
    loadOrders(false, null);
};
document.getElementById('loadMoreBtn').onclick = () => { loadOrders(true, currentSearchQuery); };
