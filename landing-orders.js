import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  doc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configurations
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

// State Management Variables
const COLLECTION_NAME = "landing_orders";
const PAGE_SIZE = 20;

let lastVisibleDoc = null;
let currentStatusFilter = "all";
let isLoading = false;
let loadedOrdersMap = new Map();
let pendingStatusChange = null;

// UI Elements References
const elements = {
  userEmail: document.getElementById("userEmail"),
  statusFilter: document.getElementById("statusFilter"),
  ordersContainer: document.getElementById("ordersContainer"),
  initialLoader: document.getElementById("initialLoader"),
  emptyState: document.getElementById("emptyState"),
  emptyStateMessage: document.getElementById("emptyStateMessage"),
  loadMoreContainer: document.getElementById("loadMoreContainer"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  detailsModal: document.getElementById("detailsModal"),
  modalBody: document.getElementById("modalBody"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  closeModalFooterBtn: document.getElementById("closeModalFooterBtn"),
  confirmModal: document.getElementById("confirmModal"),
  currentStatusText: document.getElementById("currentStatusText"),
  newStatusText: document.getElementById("newStatusText"),
  cancelStatusBtn: document.getElementById("cancelStatusBtn"),
  confirmStatusBtn: document.getElementById("confirmStatusBtn"),
  toastContainer: document.getElementById("toastContainer")
};

// Map Translations
const STATUS_MAP = {
  pending: "নতুন অর্ডার",
  confirm: "কনফার্ম করা হয়েছে",
  processing: "কোরিয়ারে দেওয়া হয়েছে",
  return: "রিটার্ন করা হয়েছে",
  cancel: "বাতিল করা হয়েছে"
};

// Auth Guard Initializer
onAuthStateChanged(auth, (user) => {
  if (user) {
    elements.userEmail.textContent = user.email || "এডমিন";
    initPage();
  } else {
    window.location.href = "https://admin.seraproduct.com";
  }
});

function initPage() {
  setupEventListeners();
  fetchOrders(true);
}

function setupEventListeners() {
  elements.statusFilter.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value;
    fetchOrders(true);
  });

  elements.loadMoreBtn.addEventListener("click", () => {
    if (!isLoading && lastVisibleDoc) {
      fetchOrders(false);
    }
  });

  elements.closeModalBtn.addEventListener("click", closeModal);
  elements.closeModalFooterBtn.addEventListener("click", closeModal);
  
  elements.cancelStatusBtn.addEventListener("click", () => {
    pendingStatusChange = null;
    elements.confirmModal.classList.remove("active");
  });

  elements.confirmStatusBtn.addEventListener("click", executeStatusUpdate);
}

// Data Fetching Mechanism
async function fetchOrders(isReset = false) {
  if (isLoading) return;
  isLoading = true;

  if (isReset) {
    lastVisibleDoc = null;
    loadedOrdersMap.clear();
    elements.ordersContainer.innerHTML = "";
    elements.initialLoader.style.display = "flex";
    elements.emptyState.style.display = "none";
    elements.loadMoreContainer.style.display = "none";
  } else {
    elements.loadMoreBtn.disabled = true;
    elements.loadMoreBtn.textContent = "আরও অর্ডার লোড হচ্ছে...";
  }

  try {
    let q;
    const ordersRef = collection(db, COLLECTION_NAME);

    if (currentStatusFilter === "all") {
      if (isReset) {
        q = query(ordersRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      } else {
        q = query(ordersRef, orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(PAGE_SIZE));
      }
    } else {
      if (isReset) {
        q = query(ordersRef, where("status", "==", currentStatusFilter), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      } else {
        q = query(ordersRef, where("status", "==", currentStatusFilter), orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(PAGE_SIZE));
      }
    }

    const querySnapshot = await getDocs(q);

    elements.initialLoader.style.display = "none";

    if (querySnapshot.empty) {
      if (isReset) {
        elements.emptyStateMessage.textContent = currentStatusFilter === "all" 
          ? "কোনো অর্ডার পাওয়া যায়নি।" 
          : "এই অবস্থার কোনো অর্ডার পাওয়া যায়নি।";
        elements.emptyState.style.display = "block";
      }
      elements.loadMoreContainer.style.display = "none";
      isLoading = false;
      return;
    }

    lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const order = { id: docSnap.id, ...data };
      loadedOrdersMap.set(docSnap.id, order);
      renderOrderCard(order);
    });

    if (querySnapshot.docs.length < PAGE_SIZE) {
      elements.loadMoreContainer.style.display = "none";
    } else {
      elements.loadMoreContainer.style.display = "block";
      elements.loadMoreBtn.disabled = false;
      elements.loadMoreBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        আরও দেখুন
      `;
    }

  } catch (error) {
    console.error("Firestore Error:", error);
    elements.initialLoader.style.display = "none";
    showToast("অর্ডার লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", true);
  } finally {
    isLoading = false;
  }
}

// UI Rendering Functions
function renderOrderCard(order) {
  const name = escapeHtml(order.name || "নাম পাওয়া যায়নি");
  const phone = escapeHtml(order.phone || "N/A");
  const status = order.status || "pending";
  const statusBN = STATUS_MAP[status] || status;

  const cardHtml = `
    <div class="order-card" id="card-${order.id}">
      <div class="card-header">
        <div>
          <div class="customer-name">${name}</div>
          <div class="phone-container">
            <a href="tel:${phone}" class="phone-link">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              ${phone}
            </a>
            <button class="icon-btn copy-btn" data-phone="${phone}" title="কপি করুন">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
          </div>
        </div>
        <span class="status-badge badge-${status}" id="badge-${order.id}">${statusBN}</span>
      </div>

      <div class="card-actions">
        <select class="select-control inline-status-select" data-id="${order.id}" style="padding:4px 8px; font-size:12px; min-width:auto;">
          ${Object.entries(STATUS_MAP).map(([val, label]) => `
            <option value="${val}" ${val === status ? "selected" : ""}>${label}</option>
          `).join("")}
        </select>
        <button class="btn btn-primary view-details-btn" data-id="${order.id}">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          সব দেখুন
        </button>
      </div>
    </div>
  `;

  const existingCard = document.getElementById(`card-${order.id}`);
  if (existingCard) {
    existingCard.outerHTML = cardHtml;
  } else {
    elements.ordersContainer.insertAdjacentHTML("beforeend", cardHtml);
  }

  // Event Listeners for dynamic elements
  const currentCard = document.getElementById(`card-${order.id}`);
  
  currentCard.querySelector(".copy-btn").addEventListener("click", (e) => {
    const ph = e.currentTarget.getAttribute("data-phone");
    navigator.clipboard.writeText(ph).then(() => {
      showToast("ফোন নম্বর কপি হয়েছে।");
    }).catch(() => {
      showToast("কপি করা যায়নি", true);
    });
  });

  currentCard.querySelector(".view-details-btn").addEventListener("click", () => {
    openDetailsModal(order.id);
  });

  currentCard.querySelector(".inline-status-select").addEventListener("change", (e) => {
    const newStatus = e.target.value;
    const oldStatus = loadedOrdersMap.get(order.id).status;
    
    if (newStatus === oldStatus) return;

    // Reset UI selection temporarily until confirmed
    e.target.value = oldStatus;

    requestStatusChange(order.id, oldStatus, newStatus);
  });
}

function openDetailsModal(orderId) {
  const order = loadedOrdersMap.get(orderId);
  if (!order) return;

  const deliverySiteText = order.deliverySite === "inside_dhaka" 
    ? "ঢাকার ভেতরে" 
    : order.deliverySite === "outside_dhaka" 
      ? "ঢাকার বাইরে" 
      : "ডেলিভারি এলাকা নির্ধারিত নয়";

  const noteText = (order.note && order.note.trim() !== "") 
    ? escapeHtml(order.note) 
    : "কোনো নোট দেওয়া হয়নি।";

  const isFreeDelivery = order.freeDelivery === true;
  const deliveryCharge = Number(order.deliveryCharge) || 0;
  const quantity = Number(order.quantity) || 1;
  const productPrice = Number(order.productPrice) || 0;
  const subtotal = Number(order.subtotal) || (productPrice * quantity);
  const total = Number(order.total) || (subtotal + (isFreeDelivery ? 0 : deliveryCharge));

  // Variants Processing
  let variantsHtml = "";
  if (Array.isArray(order.variants) && order.variants.length > 0) {
    variantsHtml = order.variants.map(v => {
      if (!v || !v.name || !v.value) return "";
      const extra = Number(v.extraPrice) || 0;
      return `
        <div style="margin-top:4px;">
          <span class="variant-tag">${escapeHtml(v.name)}: ${escapeHtml(v.value)}</span>
          ${extra > 0 ? `<div style="font-size:12px; color:var(--primary); margin-top:2px;">এই ভ্যারিয়েন্টের জন্য ৳${extra} টাকা নেওয়া হয়েছে!</div>` : ""}
        </div>
      `;
    }).join("");
  }

  // Warranty Processing
  const hasWarranty = order.warranty && String(order.warranty).trim() !== "";

  // Created Time Formatting
  let formattedDate = "তারিখ পাওয়া যায়নি";
  if (order.createdAt) {
    if (typeof order.createdAt.toDate === "function") {
      formattedDate = order.createdAt.toDate().toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
    } else if (order.createdAt instanceof Date) {
      formattedDate = order.createdAt.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
    } else if (typeof order.createdAt === "string") {
      formattedDate = order.createdAt;
    }
  }

  elements.modalBody.innerHTML = `
    <!-- Customer Details Section -->
    <section>
      <div class="section-title">
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        কাস্টমারের তথ্য
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">নাম:</span><span class="info-value">${escapeHtml(order.name || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">ফোন:</span><span class="info-value"><a href="tel:${escapeHtml(order.phone || "")}">${escapeHtml(order.phone || "N/A")}</a></span></div>
        <div class="info-item"><span class="info-label">বিভাগ:</span><span class="info-value">${escapeHtml(order.vibag || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">জেলা:</span><span class="info-value">${escapeHtml(order.jela || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">থানা/উপজেলা:</span><span class="info-value">${escapeHtml(order.upojela || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">ডেলিভারি এলাকা:</span><span class="info-value">${deliverySiteText}</span></div>
        <div class="info-item"><span class="info-label">অর্ডারের সময়:</span><span class="info-value">${formattedDate}</span></div>
      </div>
    </section>

    <!-- Notes Section -->
    <section>
      <div class="section-title">
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        কাস্টমারের নোট
      </div>
      <div class="note-box">${noteText}</div>
    </section>

    <!-- Product Details Section -->
    <section>
      <div class="section-title">
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/></svg>
        পণ্যের তথ্য
      </div>
      <div class="product-box">
        <img src="${escapeHtml(order.productImage || 'https://via.placeholder.com/80')}" alt="Product" class="product-img" onerror="this.src='https://via.placeholder.com/80'">
        <div class="product-details">
          <div style="font-weight:700; font-size:15px;">${escapeHtml(order.productName || "পণ্য পাওয়া যায়নি")}</div>
          <div style="color:var(--text-muted); font-size:12px;">ID: ${escapeHtml(order.productId || "N/A")}</div>
          <div>এই পণ্যের মূল্য: ৳${productPrice}</div>
          <div>পণ্যের পরিমাণ: ${quantity} টি</div>
          ${variantsHtml}
        </div>
      </div>
    </section>

    <!-- Free Delivery Highlight -->
    ${isFreeDelivery ? `
      <div class="highlight-banner">
        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
        এই পণ্যটা ফ্রি ডেলিভারি!
      </div>
    ` : ""}

    <!-- Warranty Highlight -->
    ${hasWarranty ? `
      <div class="note-box" style="border-left-color: #10b981;">
        <strong>ওয়ারেন্টি:</strong> ${escapeHtml(order.warranty)}
      </div>
    ` : ""}

    <!-- Pricing Summary Section -->
    <section>
      <div class="pricing-summary">
        <div class="pricing-row"><span>সাবটোটাল:</span> <span>৳${subtotal}</span></div>
        ${!isFreeDelivery ? `<div class="pricing-row"><span>ডেলিভারি চার্জ:</span> <span>৳${deliveryCharge}</span></div>` : ""}
        <div class="pricing-row total">
          <span>মোট গ্রাহক মূল্য:</span> 
          <span>পণ্য ডেলিভারি করার সময় ৳${total} টাকা নিবেন</span>
        </div>
      </div>
    </section>

    <!-- Status Change in Modal -->
    <section>
      <div class="section-title">অর্ডারের অবস্থা পরিবর্তন করুন</div>
      <select class="select-control modal-status-select" style="width:100%;">
        ${Object.entries(STATUS_MAP).map(([val, label]) => `
          <option value="${val}" ${val === order.status ? "selected" : ""}>${label}</option>
        `).join("")}
      </select>
    </section>
  `;

  elements.modalBody.querySelector(".modal-status-select").addEventListener("change", (e) => {
    const newStatus = e.target.value;
    const oldStatus = order.status;
    if (newStatus === oldStatus) return;
    
    // Reset UI selection until confirmed
    e.target.value = oldStatus;
    requestStatusChange(order.id, oldStatus, newStatus);
  });

  elements.detailsModal.classList.add("active");
}

function closeModal() {
  elements.detailsModal.classList.remove("active");
}

// Status Updates Handling
function requestStatusChange(orderId, oldStatus, newStatus) {
  pendingStatusChange = { orderId, oldStatus, newStatus };
  
  elements.currentStatusText.textContent = STATUS_MAP[oldStatus] || oldStatus;
  elements.newStatusText.textContent = STATUS_MAP[newStatus] || newStatus;
  
  elements.confirmModal.classList.add("active");
}

async function executeStatusUpdate() {
  if (!pendingStatusChange) return;

  const { orderId, newStatus } = pendingStatusChange;
  elements.confirmModal.classList.remove("active");

  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    
    // Explicit single field update
    await updateDoc(orderRef, {
      status: newStatus
    });

    // Update Local Cache
    const order = loadedOrdersMap.get(orderId);
    if (order) {
      order.status = newStatus;
      loadedOrdersMap.set(orderId, order);
      renderOrderCard(order);
    }

    // Refresh active details modal if open
    if (elements.detailsModal.classList.contains("active")) {
      openDetailsModal(orderId);
    }

    showToast("অর্ডারের অবস্থা সফলভাবে পরিবর্তন করা হয়েছে।");

  } catch (error) {
    console.error("Update Error:", error);
    showToast("অর্ডারের অবস্থা পরিবর্তন করা যায়নি।", true);
  } finally {
    pendingStatusChange = null;
  }
}

// Helpers & Utilities
function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "error" : ""}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m];
  });
}
