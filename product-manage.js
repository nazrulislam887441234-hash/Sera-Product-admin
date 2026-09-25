import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    getDoc,
    doc,
    deleteDoc, 
    startAfter, 
    serverTimestamp,
    updateDoc,
    deleteField 
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

const OWNERS = [
    "shohidhossain@gmail.com",
    "nazrulislam887441234@gmail.com",
    "support.seraproduct@gmail.com"
];

let categoriesCache = [];
let activeImgbbKeyCache = null;
let lastVisibleDoc = null;
let currentProducts = [];
let selectedProductForEdit = null;
let searchDebounceTimer = null;
let countdownIntervals = [];
let productToDeleteId = null;

// DOM Elements
const userBadge = document.getElementById('userBadge');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const productGrid = document.getElementById('productGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');
const topLoadingPopup = document.getElementById('topLoadingPopup');

const editModal = document.getElementById('editModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveProductBtn = document.getElementById('saveProductBtn');
const editModalBody = document.getElementById('editModalBody');
const toast = document.getElementById('toast');

const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// Top Loading State Helper
function showTopLoading(show) {
    if (!topLoadingPopup) return;
    if (show) {
        topLoadingPopup.classList.remove('hidden');
    } else {
        topLoadingPopup.classList.add('hidden');
    }
}

// Toast Notification Helper
function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Authentication & Authorization Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://admin.seraproduct.com";
        return;
    }

    const email = user.email;
    if (userEmail) userEmail.textContent = email;

    if (OWNERS.includes(email)) {
        if (userBadge) userBadge.textContent = "ওনার (Owner)";
        initializeAppOperations();
    } else {
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminSnap = await getDoc(adminDocRef);
            
            if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                if (adminData.active === true && adminData.email === email && adminData.uid === user.uid) {
                    if (userBadge) userBadge.textContent = "অ্যাডমিন (Admin)";
                    initializeAppOperations();
                    return;
                }
            }
            window.location.href = "https://admin.seraproduct.com";
        } catch (error) {
            window.location.href = "https://admin.seraproduct.com";
        }
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "https://admin.seraproduct.com";
        });
    });
}

async function initializeAppOperations() {
    showTopLoading(true);
    await loadCategories();
    await fetchImgbbApiKey();
    await loadProducts();
    showTopLoading(false);
}

// Load Categories
async function loadCategories() {
    if (categoriesCache.length > 0) return categoriesCache;
    try {
        const catSnap = await getDocs(collection(db, "categories"));
        categoriesCache = [];
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">সকল ক্যাটাগরি</option>';
        }
        catSnap.forEach(docSnap => {
            const cat = { id: docSnap.id, ...docSnap.data() };
            categoriesCache.push(cat);
            if (categoryFilter) {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.categoryName || cat.name || cat.id;
                categoryFilter.appendChild(opt);
            }
        });
    } catch (error) {
        showToast("ক্যাটাগরি লোড করতে সমস্যা হয়েছে");
    }
    return categoriesCache;
}

// Fetch Active ImgBB API Key
async function fetchImgbbApiKey() {
    if (activeImgbbKeyCache) return activeImgbbKeyCache;
    try {
        const q = query(collection(db, "imgbb_api"), where("active", "==", true), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            activeImgbbKeyCache = snap.docs[0].data().imgbbApi;
            return activeImgbbKeyCache;
        }
        const qAll = query(collection(db, "imgbb_api"), limit(10));
        const snapAll = await getDocs(qAll);
        const activeDoc = snapAll.docs.find(d => d.data().active === true);
        if (activeDoc) {
            activeImgbbKeyCache = activeDoc.data().imgbbApi;
            return activeImgbbKeyCache;
        }
    } catch (error) {
        console.error("ImgBB Key fetch error");
    }
    return null;
}

// Load Products with Pagination & Filtering
async function loadProducts(isLoadMore = false) {
    if (!isLoadMore) {
        if (productGrid) productGrid.innerHTML = '';
        if (loadingState) loadingState.classList.remove('hidden');
        lastVisibleDoc = null;
        currentProducts = [];
        clearCountdowns();
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    showTopLoading(true);

    try {
        let qRef = collection(db, "products");
        let constraints = [];

        const catVal = categoryFilter ? categoryFilter.value : "";
        const statusVal = statusFilter ? statusFilter.value : "";
        const searchVal = searchInput ? searchInput.value.trim() : "";

        if (catVal) {
            constraints.push(where("categoryId", "==", catVal));
        }

        if (statusVal === "active") {
            constraints.push(where("active", "==", true));
        } else if (statusVal === "inactive") {
            constraints.push(where("active", "==", false));
        }

        if (searchVal) {
            constraints.push(where("productSlug", "==", searchVal.toLowerCase()));
        } else {
            constraints.push(orderBy("createdAt", "desc"));
        }

        constraints.push(limit(20));

        if (isLoadMore && lastVisibleDoc) {
            constraints.push(startAfter(lastVisibleDoc));
        }

        let q = query(qRef, ...constraints);
        let snapshot;

        try {
            snapshot = await getDocs(q);
        } catch (idxError) {
            let simpleConstraints = [orderBy("createdAt", "desc"), limit(20)];
            if (isLoadMore && lastVisibleDoc) {
                simpleConstraints.push(startAfter(lastVisibleDoc));
            }
            q = query(qRef, ...simpleConstraints);
            snapshot = await getDocs(q);
        }

        if (loadingState) loadingState.classList.add('hidden');
        showTopLoading(false);

        if (snapshot.empty && !isLoadMore) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (!snapshot.empty) {
            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        }

        snapshot.forEach(docSnap => {
            const product = { id: docSnap.id, ...docSnap.data() };
            currentProducts.push(product);
            renderProductCard(product);
        });

        if (snapshot.docs.length >= 20 && loadMoreBtn) {
            loadMoreBtn.classList.remove('hidden');
        }

    } catch (error) {
        if (loadingState) loadingState.classList.add('hidden');
        showTopLoading(false);
        showToast("ডাটা লোড করতে সমস্যা হয়েছে।");
    }
}

// Clear Countdowns
function clearCountdowns() {
    countdownIntervals.forEach(interval => clearInterval(interval));
    countdownIntervals = [];
}

// Render Product Card
function renderProductCard(product) {
    if (!productGrid) return;
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageUrl = (product.image && product.image.length > 0) ? product.image[0] : 'https://via.placeholder.com/300x180?text=No+Image';
    const isActive = product.active !== false;
    const categoryName = product.categoryName || 'সাধারণ';
    const productName = product.productName || 'নামবিহীন পণ্য';
    const customerPrice = product.customerPrice || 0;
    const oldPrice = product.customerOldPrice ? `<span class="old-price">৳${product.customerOldPrice}</span>` : '';
    const resellerPrice = product.resellerPrice || 0;
    const sku = product.sku || 'SKU নেই';

    card.innerHTML = `
        <div class="product-img-wrapper">
            <img src="${imageUrl}" alt="${productName}" loading="lazy">
            <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
        </div>
        <div class="product-content">
            <span class="product-category">${categoryName}</span>
            <h3 class="product-title">${productName}</h3>
            <div class="product-price-box">
                <span class="current-price">৳${customerPrice}</span>
                ${oldPrice}
            </div>
            <div class="product-meta">
                <span>রিসেলার মূল্য: ৳${resellerPrice}</span>
                <span>SKU: ${sku}</span>
            </div>
            <div class="countdown-box" id="countdown-${product.id}">অফার সময় লোড হচ্ছে...</div>
        </div>
        <div class="product-actions">
            <button class="btn btn-outline flex-1 edit-btn" data-id="${product.id}">
                সম্পাদনা
            </button>
            <button class="btn btn-secondary copy-btn" data-id="${product.id}">
                JSON
            </button>
            <button class="btn btn-danger delete-btn" data-id="${product.id}" title="মুছে ফেলুন">
                &times;
            </button>
        </div>
    `;

    card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(product.id));
    card.querySelector('.copy-btn').addEventListener('click', () => copyProductJSON(product));
    card.querySelector('.delete-btn').addEventListener('click', () => promptDeleteProduct(product.id));

    productGrid.appendChild(card);
    setupLiveCountdown(product.id, product.offerTime);
}

// Delete System & Custom Modal
function promptDeleteProduct(productId) {
    productToDeleteId = productId;
    if (deleteModal) deleteModal.classList.remove('hidden');
}

if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        productToDeleteId = null;
        if (deleteModal) deleteModal.classList.add('hidden');
    });
}

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!productToDeleteId) return;
        const targetId = productToDeleteId;
        productToDeleteId = null;
        if (deleteModal) deleteModal.classList.add('hidden');

        try {
            showTopLoading(true);
            await deleteDoc(doc(db, "products", targetId));
            showTopLoading(false);
            showToast("ডিলিট হয়েছে");
            loadProducts();
        } catch (error) {
            showTopLoading(false);
            showToast("ডিলিট করতে সমস্যা হয়েছে");
        }
    });
}

// YouTube Link to Embed Converter Helper
function convertToYouTubeEmbed(url) {
    if (!url) return "";
    url = url.trim();
    if (url.includes("/embed/")) {
        return url;
    }
    let videoId = "";
    if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1]?.split("?")[0];
    } else if (url.includes("/shorts/")) {
        videoId = url.split("/shorts/")[1]?.split("?")[0];
    } else if (url.includes("watch?v=")) {
        videoId = url.split("watch?v=")[1]?.split("&")[0];
    } else if (url.includes("youtube.com/embed/")) {
        videoId = url.split("embed/")[1]?.split("?")[0];
    }
    
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
}

// Live Countdown
function setupLiveCountdown(productId, offerTimeStr) {
    const box = document.getElementById(`countdown-${productId}`);
    if (!box) return;

    if (!offerTimeStr) {
        box.textContent = "কোনো অফার নেই";
        return;
    }

    const targetTime = parseInt(offerTimeStr, 10);
    if (isNaN(targetTime)) {
        box.textContent = "অফার সময় নির্ধারণ করা হয়নি";
        return;
    }

    function updateTimer() {
        const now = Date.now();
        const diff = targetTime - now;

        if (diff <= 0) {
            box.textContent = "অফার শেষ";
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        let text = "অফার শেষ: ";
        if (days > 0) text += `${days} দিন `;
        text += `${hours}ঘণ্টা ${minutes}মি ${seconds}সে`;
        box.textContent = text;
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    countdownIntervals.push(interval);
}

// Copy JSON
function copyProductJSON(product) {
    const jsonString = JSON.stringify(product, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonString).then(() => {
            showToast("পণ্যের তথ্য JSON আকারে কপি হয়েছে");
        }).catch(() => {
            fallbackCopyText(jsonString);
        });
    } else {
        fallbackCopyText(jsonString);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("পণ্যের তথ্য JSON আকারে কপি হয়েছে");
    } catch (err) {
        showToast("কপি করতে ব্যর্থ হয়েছে");
    }
    document.body.removeChild(textArea);
}

// Filters Event Listeners
if (categoryFilter) categoryFilter.addEventListener('change', () => loadProducts());
if (statusFilter) statusFilter.addEventListener('change', () => loadProducts());

if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            loadProducts();
        }, 400);
    });
}

if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => loadProducts(true));

// Edit Modal
function openEditModal(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;
    selectedProductForEdit = JSON.parse(JSON.stringify(product));

    renderEditForm();
    if (editModal) editModal.classList.remove('hidden');
}

function renderEditForm() {
    if (!editModalBody) return;
    const p = selectedProductForEdit;
    
    let imagesHtml = '';
    if (p.image && Array.isArray(p.image)) {
        p.image.forEach((img, idx) => {
            imagesHtml += `
                <div class="img-thumb-container">
                    <img src="${img}" alt="প্রোডাক্ট ইমেজ" loading="lazy">
                    <div class="img-thumb-actions">
                        <button class="btn-sm btn-replace" type="button" onclick="window.triggerImageReplace(${idx})">পরিবর্তন</button>
                        <button class="btn-sm btn-remove" type="button" onclick="window.confirmRemoveImage(${idx})">মুছুন</button>
                    </div>
                </div>
            `;
        });
    }

    let catOptions = categoriesCache.map(cat => `<option value="${cat.id}" ${p.categoryId === cat.id ? 'selected' : ''}>${cat.categoryName || cat.name}</option>`).join('');

    let variantsHtml = '';
    if (p.variants && Array.isArray(p.variants)) {
        p.variants.forEach((v, vIdx) => {
            let valuesHtml = '';
            if (v.values && Array.isArray(v.values)) {
                v.values.forEach((valObj, valIdx) => {
                    valuesHtml += `
                        <div class="variant-value-row">
                            <input type="text" placeholder="ভ্যালু (যেমন: লাল)" value="${valObj.value || ''}" oninput="window.updateVariantValue(${vIdx}, ${valIdx}, 'value', this.value)">
                            <input type="number" placeholder="এক্সট্রা প্রাইস" value="${valObj.extraPrice || 0}" oninput="window.updateVariantValue(${vIdx}, ${valIdx}, 'extraPrice', this.value)">
                            <button type="button" class="btn-icon-danger" onclick="window.deleteVariantValue(${vIdx}, ${valIdx})">&times;</button>
                        </div>
                    `;
                });
            }

            variantsHtml += `
                <div class="variant-card">
                    <div class="variant-header">
                        <input type="text" placeholder="ভ্যারিয়েন্ট নাম (যেমন: কালার)" value="${v.name || ''}" oninput="window.updateVariantName(${vIdx}, this.value)">
                        <button type="button" class="btn btn-sm btn-danger" onclick="window.deleteVariant(${vIdx})">মুছুন</button>
                    </div>
                    <div class="variant-values-container">
                        ${valuesHtml}
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.addVariantValue(${vIdx})">+ নতুন ভ্যালু যোগ করুন</button>
                    </div>
                </div>
            `;
        });
    }

    let datetimeVal = '';
    if (p.offerTime) {
        const d = new Date(parseInt(p.offerTime, 10));
        if (!isNaN(d.getTime())) {
            datetimeVal = d.toISOString().slice(0, 16);
        }
    }

    const currentReviewVideo = p.reviewVideo || '';

    editModalBody.innerHTML = `
        <div class="form-section">
            <h3>পণ্যের ছবি</h3>
            <div class="img-preview-grid" id="imagePreviewGrid">${imagesHtml}</div>
            <div class="mt-2">
                <label class="btn btn-outline" style="cursor: pointer; display: inline-block;">
                    + ছবি আপলোড করুন
                    <input type="file" id="newImageUploadInput" accept="image/*" style="display: none;">
                </label>
            </div>
            <input type="file" id="replaceImageFileInput" accept="image/*" style="display: none;">
        </div>

        <div class="form-section">
            <h3>সাধারণ তথ্য</h3>
            <div class="form-group">
                <label>পণ্যের নাম *</label>
                <input type="text" id="editProductName" value="${p.productName || ''}">
            </div>
            <div class="form-group">
                <label>স্লাগ (Slug)</label>
                <input type="text" id="editProductSlug" value="${p.productSlug || ''}">
            </div>
            <div class="form-group">
                <label>ক্যাটাগরি</label>
                <select id="editCategorySelect">${catOptions}</select>
            </div>
            <div class="form-group">
                <label>SKU</label>
                <input type="text" id="editSku" value="${p.sku || ''}">
            </div>
        </div>

        <div class="form-section">
            <h3>ভিডিও রিভিউ (Review Video)</h3>
            <div class="form-group">
                <label>ইউটিউব লিংক (Shorts, youtu.be, watch?v= বা Embed লিংক দিন)</label>
                <input type="text" id="editReviewVideoInput" placeholder="https://youtu.be/..." value="${currentReviewVideo}">
            </div>
            <div class="form-group">
                <label>ভিডিও প্রিভিউ</label>
                <div class="youtube-preview-container" id="youtubePreviewBox">
                    ${currentReviewVideo ? `<iframe src="${currentReviewVideo}" frameborder="0" allowfullscreen></iframe>` : '<span>কোনো ভিডিও লিংক দেওয়া হয়নি</span>'}
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>মূল্য নির্ধারণ</h3>
            <div class="form-grid-2">
                <div class="form-group">
                    <label>কাস্টমার মূল্য *</label>
                    <input type="number" id="editCustomerPrice" value="${p.customerPrice || 0}">
                </div>
                <div class="form-group">
                    <label>কাস্টমার পূর্বের মূল্য</label>
                    <input type="number" id="editCustomerOldPrice" value="${p.customerOldPrice !== undefined ? p.customerOldPrice : ''}">
                </div>
                <div class="form-group">
                    <label>রিসেলার মূল্য *</label>
                    <input type="number" id="editResellerPrice" value="${p.resellerPrice || 0}">
                </div>
                <div class="form-group">
                    <label>রিসেলার পূর্বের মূল্য</label>
                    <input type="number" id="editResellerOldPrice" value="${p.resellerOldPrice !== undefined ? p.resellerOldPrice : ''}">
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>বিবরণ ও অন্যান্য</h3>
            <div class="form-group">
                <label>বিবরণ</label>
                <textarea id="editDescription" rows="4">${p.productDescription || ''}</textarea>
            </div>
            <div class="form-group">
                <label>ওয়ারেন্টি</label>
                <input type="text" id="editWarranty" value="${p.warranty || ''}">
            </div>
            <div class="form-group">
                <label>ফ্রি ডেলিভারি</label>
                <select id="editFreeDelivery">
                    <option value="true" ${p.freeDelivery === true ? 'selected' : ''}>হ্যাঁ</option>
                    <option value="false" ${p.freeDelivery !== true ? 'selected' : ''}>না</option>
                </select>
            </div>
            <div class="form-group">
                <label>স্ট্যাটাস</label>
                <div class="toggle-container">
                    <label class="switch">
                        <input type="checkbox" id="editActiveStatus" ${p.active !== false ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                    <span id="activeStatusLabel">${p.active !== false ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>অফারের সময়</h3>
            <div class="offer-time-row">
                <input type="datetime-local" id="editOfferTimeInput" value="${datetimeVal}">
                <button type="button" class="btn btn-secondary" onclick="window.clearOfferTime()">মুছুন</button>
            </div>
        </div>

        <div class="form-section">
            <div class="section-header-flex">
                <h3>ভ্যারিয়েন্টস</h3>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.addNewVariant()">+ যোগ করুন</button>
            </div>
            <div id="variantsEditorContainer">
                ${variantsHtml || '<p class="text-muted">কোনো ভ্যারিয়েন্ট নেই</p>'}
            </div>
        </div>
    `;

    const reviewVideoInput = document.getElementById('editReviewVideoInput');
    const youtubePreviewBox = document.getElementById('youtubePreviewBox');
    if (reviewVideoInput && youtubePreviewBox) {
        reviewVideoInput.addEventListener('input', () => {
            const rawVal = reviewVideoInput.value.trim();
            const embedVal = convertToYouTubeEmbed(rawVal);
            if (embedVal) {
                youtubePreviewBox.innerHTML = `<iframe src="${embedVal}" frameborder="0" allowfullscreen></iframe>`;
            } else {
                youtubePreviewBox.innerHTML = '<span>সঠিক ইউটিউব লিংক দিন</span>';
            }
        });
    }

    const activeCheckbox = document.getElementById('editActiveStatus');
    const activeLabel = document.getElementById('activeStatusLabel');
    if (activeCheckbox && activeLabel) {
        activeCheckbox.addEventListener('change', () => {
            activeLabel.textContent = activeCheckbox.checked ? 'সক্রিয়' : 'নিষ্ক্রিয়';
        });
    }

    const newImgInput = document.getElementById('newImageUploadInput');
    if (newImgInput) {
        newImgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await uploadAndPushImage(file);
        });
    }
}

// ImgBB Upload Helpers
async function uploadAndPushImage(file) {
    if (file.size > 5 * 1024 * 1024) {
        showToast("ফাইলের আকার ৫MB এর বেশি হতে পারবে না");
        return;
    }
    const apiKey = await fetchImgbbApiKey();
    if (!apiKey) {
        showToast("সক্রিয় ImgBB API পাওয়া যায়নি");
        return;
    }

    showTopLoading(true);
    showToast("ছবি আপলোড হচ্ছে...");
    const formData = new FormData();
    formData.append("image", file);

    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        showTopLoading(false);
        if (data.success) {
            if (!selectedProductForEdit.image) selectedProductForEdit.image = [];
            selectedProductForEdit.image.push(data.data.url);
            renderEditForm();
            showToast("ছবি সফলভাবে যুক্ত হয়েছে");
        } else {
            showToast("ছবি আপলোড ব্যর্থ হয়েছে");
        }
    } catch (err) {
        showTopLoading(false);
        showToast("নেটওয়ার্ক ত্রুটি");
    }
}

let replacingImageIndex = null;
window.triggerImageReplace = function(index) {
    replacingImageIndex = index;
    const replaceInput = document.getElementById('replaceImageFileInput');
    if (replaceInput) {
        replaceInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file || replacingImageIndex === null) return;
            await uploadAndReplaceImage(file, replacingImageIndex);
            replacingImageIndex = null;
            replaceInput.value = '';
        };
        replaceInput.click();
    }
};

async function uploadAndReplaceImage(file, index) {
    const apiKey = await fetchImgbbApiKey();
    if (!apiKey) {
        showToast("ImgBB API নেই");
        return;
    }
    showTopLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: "POST", body: formData });
        const data = await res.json();
        showTopLoading(false);
        if (data.success) {
            selectedProductForEdit.image[index] = data.data.url;
            renderEditForm();
            showToast("ছবি পরিবর্তিত হয়েছে");
        }
    } catch (err) {
        showTopLoading(false);
        showToast("ত্রুটি হয়েছে");
    }
}

window.confirmRemoveImage = function(index) {
    if (confirm("ছবিটি সরাতে চান?")) {
        selectedProductForEdit.image.splice(index, 1);
        renderEditForm();
        showToast("ছবি সরানো হয়েছে");
    }
};

window.addNewVariant = function() {
    if (!selectedProductForEdit.variants) selectedProductForEdit.variants = [];
    selectedProductForEdit.variants.push({ name: "", values: [] });
    renderEditForm();
};

window.deleteVariant = function(vIdx) {
    selectedProductForEdit.variants.splice(vIdx, 1);
    renderEditForm();
};

window.updateVariantName = function(vIdx, val) {
    if (selectedProductForEdit.variants[vIdx]) {
        selectedProductForEdit.variants[vIdx].name = val;
    }
};

window.addVariantValue = function(vIdx) {
    if (!selectedProductForEdit.variants[vIdx].values) {
        selectedProductForEdit.variants[vIdx].values = [];
    }
    selectedProductForEdit.variants[vIdx].values.push({ value: "", extraPrice: 0 });
    renderEditForm();
};

window.deleteVariantValue = function(vIdx, valIdx) {
    selectedProductForEdit.variants[vIdx].values.splice(valIdx, 1);
    renderEditForm();
};

window.updateVariantValue = function(vIdx, valIdx, field, val) {
    if (selectedProductForEdit.variants[vIdx] && selectedProductForEdit.variants[vIdx].values[valIdx]) {
        if (field === 'extraPrice') {
            selectedProductForEdit.variants[vIdx].values[valIdx][field] = parseFloat(val) || 0;
        } else {
            selectedProductForEdit.variants[vIdx].values[valIdx][field] = val;
        }
    }
};

window.clearOfferTime = function() {
    const input = document.getElementById('editOfferTimeInput');
    if (input) input.value = '';
    if (selectedProductForEdit) selectedProductForEdit.offerTime = null;
    showToast("অফারের সময় মুছে ফেলা হয়েছে");
};

if (closeModalBtn) closeModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));
if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));

function cleanSlug(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[\s]+/g, '-')
        .replace(/[^\w\u0980-\u09ff\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Save Changes
if (saveProductBtn) {
    saveProductBtn.addEventListener('click', async () => {
        if (!selectedProductForEdit) return;

        const p = selectedProductForEdit;
        const nameInput = document.getElementById('editProductName');
        const slugInput = document.getElementById('editProductSlug');
        const custPriceInput = document.getElementById('editCustomerPrice');
        const resPriceInput = document.getElementById('editResellerPrice');

        const productName = nameInput ? nameInput.value.trim() : "";
        if (!productName) {
            showToast("পণ্যের নাম দিন");
            return;
        }

        const rawSlug = slugInput ? slugInput.value.trim() : "";
        const newSlug = cleanSlug(rawSlug || productName);
        if (!newSlug) {
            showToast("সঠিক স্লাগ দিন");
            return;
        }

        const customerPrice = parseFloat(custPriceInput ? custPriceInput.value : 0);
        const resellerPrice = parseFloat(resPriceInput ? resPriceInput.value : 0);

        p.productName = productName;
        p.productSlug = newSlug;
        p.customerPrice = customerPrice;
        p.resellerPrice = resellerPrice;

        const custOldInput = document.getElementById('editCustomerOldPrice').value;
        p.customerOldPrice = custOldInput ? parseFloat(custOldInput) : null;

        const resOldInput = document.getElementById('editResellerOldPrice').value;
        p.resellerOldPrice = resOldInput ? parseFloat(resOldInput) : null;

        p.productDescription = document.getElementById('editDescription').value.trim();
        p.sku = document.getElementById('editSku').value.trim();
        p.warranty = document.getElementById('editWarranty').value.trim();
        p.freeDelivery = document.getElementById('editFreeDelivery').value === 'true';
        p.active = document.getElementById('editActiveStatus').checked;

        const reviewVideoInputVal = document.getElementById('editReviewVideoInput').value.trim();
        if (reviewVideoInputVal) {
            p.reviewVideo = convertToYouTubeEmbed(reviewVideoInputVal);
        } else {
            p.reviewVideo = "";
        }

        const catSelect = document.getElementById('editCategorySelect');
        p.categoryId = catSelect.value;
        const selectedCat = categoriesCache.find(c => c.id === p.categoryId);
        if (selectedCat) {
            p.categoryName = selectedCat.categoryName || selectedCat.name;
        }

        const offerDateInput = document.getElementById('editOfferTimeInput').value;
        if (offerDateInput) {
            const millis = new Date(offerDateInput).getTime();
            if (!isNaN(millis)) p.offerTime = String(millis);
        } else {
            p.offerTime = null;
        }

        try {
            showTopLoading(true);
            showToast("সংরক্ষণ করা হচ্ছে...");

            const docRef = doc(db, "products", p.id);
            const updateData = {
                image: p.image || [],
                categoryId: p.categoryId || "",
                categoryName: p.categoryName || "",
                productName: p.productName,
                customerPrice: p.customerPrice,
                resellerPrice: p.resellerPrice,
                productSlug: p.productSlug,
                freeDelivery: p.freeDelivery,
                active: p.active,
                variants: p.variants || [],
                createdAt: serverTimestamp()
            };

            if (p.reviewVideo) updateData.reviewVideo = p.reviewVideo;
            else updateData.reviewVideo = deleteField();

            if (p.customerOldPrice !== null && !isNaN(p.customerOldPrice)) updateData.customerOldPrice = p.customerOldPrice;
            else updateData.customerOldPrice = deleteField();

            if (p.resellerOldPrice !== null && !isNaN(p.resellerOldPrice)) updateData.resellerOldPrice = p.resellerOldPrice;
            else updateData.resellerOldPrice = deleteField();

            if (p.productDescription) updateData.productDescription = p.productDescription;
            else updateData.productDescription = deleteField();

            if (p.sku) updateData.sku = p.sku;
            else updateData.sku = deleteField();

            if (p.warranty) updateData.warranty = p.warranty;
            else updateData.warranty = deleteField();

            if (p.offerTime) updateData.offerTime = p.offerTime;
            else updateData.offerTime = deleteField();

            await updateDoc(docRef, updateData);
            showTopLoading(false);
            showToast("সফলভাবে হালনাগাদ করা হয়েছে");
            if (editModal) editModal.classList.add('hidden');
            loadProducts();
        } catch (error) {
            showTopLoading(false);
            showToast("হালনাগাদ করতে সমস্যা হয়েছে");
        }
    });
}
