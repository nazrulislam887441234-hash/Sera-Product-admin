import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, query, where, limit, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

let selectedFiles = [];
let categoriesCache = [];
let lastCreatedProductJson = null;

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const toast = document.getElementById("toast");

function showLoading(text) {
    loadingText.innerText = text;
    loadingOverlay.style.display = "flex";
}

function hideLoading() {
    loadingOverlay.style.display = "none";
}

function showToast(message) {
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Authentication & Access Control
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "https://admin.seraproduct.com";
        return;
    }

    const email = user.email;
    const isOwner = OWNER_EMAILS.includes(email);

    if (isOwner) {
        document.getElementById("userRoleBadge").innerText = "মালিক";
        document.getElementById("userEmailText").innerText = email;
        initApp();
        return;
    }

    // Check Active Admin
    try {
        showLoading("অ্যাক্সেস যাচাই করা হচ্ছে...");
        const adminDocRef = doc(db, "admins", user.uid);
        const adminDoc = await getDoc(adminDocRef);

        if (adminDoc.exists()) {
            const data = adminDoc.data();
            if (data.active === true && data.email === email) {
                document.getElementById("userRoleBadge").innerText = "অ্যাডমিন";
                document.getElementById("userEmailText").innerText = email;
                initApp();
                return;
            }
        }
        window.location.href = "https://admin.seraproduct.com";
    } catch (error) {
        window.location.href = "https://admin.seraproduct.com";
    }
});

async function initApp() {
    await loadCategories();
    setupEventListeners();
    hideLoading();
}

// Load Categories
async function loadCategories() {
    try {
        showLoading("ক্যাটাগরি লোড হচ্ছে...");
        const catSnapshot = await getDocs(collection(db, "categories"));
        categoriesCache = [];
        catSnapshot.forEach((docSnap) => {
            categoriesCache.push({
                categoryId: docSnap.id,
                categoryName: docSnap.data().categoryName || "নামহীন ক্যাটাগরি"
            });
        });

        renderCategories(categoriesCache);
    } catch (error) {
        showToast("ক্যাটাগরি লোড করতে সমস্যা হয়েছে।");
    }
}

function renderCategories(categories) {
    const select = document.getElementById("categorySelect");
    select.innerHTML = '<option value="">ক্যাটাগরি নির্বাচন করুন</option>';
    if (categories.length === 0) {
        select.innerHTML = '<option value="">কোনো ক্যাটাগরি পাওয়া যায়নি।</option>';
        return;
    }
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.categoryId;
        opt.setAttribute("data-name", cat.categoryName);
        opt.innerText = cat.categoryName;
        select.appendChild(opt);
    });
}

function setupEventListeners() {
    const fileInput = document.getElementById("productImagesInput");
    const dropArea = document.querySelector(".file-drop-area");

    dropArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleImageSelection);

    document.getElementById("addVariantGroupBtn").addEventListener("click", addVariantGroup);
    document.getElementById("reviewVideoInput").addEventListener("input", previewYouTubeVideo);
    document.getElementById("productUploadForm").addEventListener("submit", handleFormSubmit);
    document.getElementById("copyJsonBtn").addEventListener("click", copyProductJSON);
}

// Image Selection Handling
function handleImageSelection(e) {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 10) {
        showToast("সর্বোচ্চ ১০টি ছবি নির্বাচন করা যাবে।");
        return;
    }

    files.forEach(file => {
        selectedFiles.push({
            file: file,
            previewUrl: URL.createObjectURL(file)
        });
    });

    renderImagePreviews();
}

function renderImagePreviews() {
    const grid = document.getElementById("imagePreviewGrid");
    grid.innerHTML = "";

    selectedFiles.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "preview-card";
        
        const img = document.createElement("img");
        img.src = item.previewUrl;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-img-btn";
        removeBtn.innerHTML = "×";
        removeBtn.onclick = () => removeSelectedImage(index);

        card.appendChild(img);
        card.appendChild(removeBtn);
        grid.appendChild(card);
    });
}

function removeSelectedImage(index) {
    URL.revokeObjectURL(selectedFiles[index].previewUrl);
    selectedFiles.splice(index, 1);
    renderImagePreviews();
}

// YouTube URL Processing
function previewYouTubeVideo(e) {
    const url = e.target.value.trim();
    const container = document.getElementById("videoPreviewContainer");
    const iframe = document.getElementById("videoPreviewIframe");

    const embedUrl = createYouTubeEmbedUrl(url);
    if (embedUrl) {
        iframe.src = embedUrl;
        container.style.display = "block";
    } else {
        iframe.src = "";
        container.style.display = "none";
        if (url.length > 0) {
            showToast("সঠিক ইউটিউব ভিডিও লিংক দিন।");
        }
    }
}

function getYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function createYouTubeEmbedUrl(url) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

// Variant Management
function addVariantGroup() {
    const container = document.getElementById("variantsContainer");
    const groupDiv = document.createElement("div");
    groupDiv.className = "variant-group-box";

    groupDiv.innerHTML = `
        <div class="variant-group-header">
            <input type="text" placeholder="ভ্যারিয়েন্ট নাম (যেমন: সাইজ)" class="variant-name-input" required>
            <button type="button" class="btn-danger remove-group-btn">গ্রুপ মুছুন</button>
        </div>
        <div class="variant-values-container"></div>
        <button type="button" class="btn-secondary add-value-btn" style="margin-top: 10px; font-size: 0.8rem;">+ মান যোগ করুন</button>
    `;

    groupDiv.querySelector(".remove-group-btn").onclick = () => groupDiv.remove();
    groupDiv.querySelector(".add-value-btn").onclick = () => addVariantValue(groupDiv.querySelector(".variant-values-container"));

    container.appendChild(groupDiv);
    addVariantValue(groupDiv.querySelector(".variant-values-container"));
}

function addVariantValue(valuesContainer) {
    const row = document.createElement("div");
    row.className = "variant-value-row";
    row.innerHTML = `
        <input type="text" placeholder="মান (যেমন: 40)" class="v-val-input" required style="flex:2;">
        <input type="number" placeholder="এক্সট্রা মূল্য" class="v-price-input" value="0" min="0" style="flex:1;" required>
        <button type="button" class="btn-danger remove-val-btn">×</button>
    `;
    row.querySelector(".remove-val-btn").onclick = () => row.remove();
    valuesContainer.appendChild(row);
}

// Slug Generation & Verification
function generateSlug(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0980-\u09FF\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function generateUniqueSlug(baseName) {
    let baseSlug = generateSlug(baseName);
    if (!baseSlug) baseSlug = "product";

    let uniqueSlug = baseSlug;
    let counter = 2;

    while (true) {
        const q = query(collection(db, "products"), where("productSlug", "==", uniqueSlug), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            break;
        }
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
    }
    return uniqueSlug;
}

// ImgBB API Fetch & Upload
async function getActiveImgBBApi() {
    const q = query(collection(db, "imgbb_api"), where("active", "==", true), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        throw new Error("কোনো সক্রিয় ImgBB API পাওয়া যায়নি।");
    }
    return snapshot.docs[0].data().imgbbApi;
}

async function uploadImageToImgBB(file, apiKey) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
    });
    const data = await response.json();
    if (data && data.success) {
        return data.data.url;
    }
    throw new Error("ছবি আপলোড ব্যর্থ হয়েছে।");
}

// Form Submission
async function handleFormSubmit(e) {
    e.preventDefault();

    if (selectedFiles.length === 0) {
        showToast("অন্তত একটি ছবি নির্বাচন করুন।");
        return;
    }

    const categorySelect = document.getElementById("categorySelect");
    const categoryId = categorySelect.value;
    if (!categoryId) {
        showToast("ক্যাটাগরি নির্বাচন করুন।");
        return;
    }
    const categoryName = categorySelect.options[categorySelect.selectedIndex].getAttribute("data-name");

    const productName = document.getElementById("productNameInput").value.trim();
    const productDescription = document.getElementById("productDescriptionInput").value.trim();
    const customerPrice = parseFloat(document.getElementById("customerPriceInput").value);
    const customerOldPriceField = document.getElementById("customerOldPriceInput").value;
    const resellerPrice = parseFloat(document.getElementById("resellerPriceInput").value);
    const resellerOldPriceField = document.getElementById("resellerOldPriceInput").value;

    if (!productName || isNaN(customerPrice) || isNaN(resellerPrice)) {
        showToast("সব আবশ্যক ক্ষেত্রগুলো সঠিকভাবে পূরণ করুন।");
        return;
    }

    try {
        showLoading("সক্রিয় ImgBB API সংগ্রহ করা হচ্ছে...");
        const imgbbApiKey = await getActiveImgBBApi();

        showLoading(`ছবি আপলোড হচ্ছে (০/${selectedFiles.length})...`);
        let uploadedUrls = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            showLoading(`ছবি আপলোড হচ্ছে (${i + 1}/${selectedFiles.length})...`);
            const url = await uploadImageToImgBB(selectedFiles[i].file, imgbbApiKey);
            uploadedUrls.push(url);
        }

        showLoading("ইউনিক স্ল্যাগ তৈরি করা হচ্ছে...");
        const productSlug = await generateUniqueSlug(productName);

        // Variants gathering
        const variants = [];
        const variantBoxes = document.querySelectorAll(".variant-group-box");
        variantBoxes.forEach(box => {
            const vName = box.querySelector(".variant-name-input").value.trim();
            const valueRows = box.querySelectorAll(".variant-value-row");
            const values = [];
            valueRows.forEach(row => {
                const val = row.querySelector(".v-val-input").value.trim();
                const extraPrice = parseFloat(row.querySelector(".v-price-input").value) || 0;
                if (val) {
                    values.push({ value: val, extraPrice: extraPrice });
                }
            });
            if (vName && values.length > 0) {
                variants.push({ name: vName, values: values });
            }
        });

        // Warranty & Offer time
        const warrantyVal = document.getElementById("warrantyInput").value;
        const warranty = warrantyVal ? new Date(warrantyVal).getTime() : null;

        const offerTimeVal = document.getElementById("offerTimeInput").value;
        const offerTime = offerTimeVal ? new Date(offerTimeVal).getTime() : null;

        const reviewVideoRaw = document.getElementById("reviewVideoInput").value.trim();
        const reviewVideo = reviewVideoRaw ? createYouTubeEmbedUrl(reviewVideoRaw) || "" : "";

        const freeDelivery = document.getElementById("freeDeliveryToggle").checked;
        const sku = document.getElementById("skuInput").value.trim();

        const productData = {
            image: uploadedUrls,
            categoryId: categoryId,
            categoryName: categoryName,
            productName: productName,
            customerPrice: customerPrice,
            customerOldPrice: customerOldPriceField ? parseFloat(customerOldPriceField) : null,
            resellerPrice: resellerPrice,
            resellerOldPrice: resellerOldPriceField ? parseFloat(resellerOldPriceField) : null,
            productDescription: productDescription,
            productSlug: productSlug,
            sku: sku,
            warranty: warranty,
            freeDelivery: freeDelivery,
            variants: variants,
            offerTime: offerTime,
            reviewVideo: reviewVideo,
            createdAt: serverTimestamp()
        };

        showLoading("পণ্য সংরক্ষণ করা হচ্ছে...");
        const docRef = await addDoc(collection(db, "products"), productData);

        lastCreatedProductJson = {
            ...productData,
            createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            id: docRef.id
        };

        document.getElementById("jsonOutputCode").innerText = JSON.stringify(lastCreatedProductJson, null, 2);
        document.getElementById("jsonOutputSection").style.display = "block";
        
        showToast("পণ্য সফলভাবে সংরক্ষণ করা হয়েছে।");
        resetForm();
    } catch (error) {
        showToast("ত্রুটি: " + error.message);
    } finally {
        hideLoading();
    }
}

function resetForm() {
    document.getElementById("productUploadForm").reset();
    selectedFiles.forEach(item => URL.revokeObjectURL(item.previewUrl));
    selectedFiles = [];
    renderImagePreviews();
    document.getElementById("variantsContainer").innerHTML = "";
    document.getElementById("videoPreviewContainer").style.display = "none";
}

// JSON Copy with Fallback
function copyProductJSON() {
    if (!lastCreatedProductJson) return;
    const jsonString = JSON.stringify(lastCreatedProductJson, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonString).then(() => {
            showToast("JSON সফলভাবে কপি হয়েছে।");
        }).catch(() => {
            fallbackCopyText(jsonString);
        });
    } else {
        fallbackCopyText(jsonString);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("JSON সফলভাবে কপি হয়েছে।");
        } else {
            showToast("JSON কপি করা যায়নি।");
        }
    } catch (err) {
        showToast("JSON কপি করা যায়নি।");
    }
    document.body.removeChild(textarea);
}
