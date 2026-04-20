/* ── Configuration ── */
const ADMISSIONS_WA = "917217077252";
const ADMIN_PIN     = '1234';
const DOC_KEYS      = ['nrc', 'transcript', 'photo', 'other'];
const DOC_NAMES     = { nrc: 'NRC / National ID', transcript: 'Transcript', photo: 'Passport Photo', other: 'Other Doc' };
const DOC_ICONS     = { nrc: '🪪', transcript: '🎓', photo: '📷', other: '📄' };

/* ── State ── */
let adminUnlocked = false;
let pinBuf        = '';
let filter        = 'all';
let allApps       = [];
let staged        = {}; // Temporarily stores File objects

/* ════════════════════════════════════════
   INIT & LOADER
════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
    // Initial UI setup
    updateWaPayLink();
    
    // Add form submit handler
    const studentForm = document.getElementById('view-student');
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            await submitApplication();
        });
    }
    
    // Simulate a connection check to Django
    setTimeout(() => {
        hideLoader('✓ Connected to Django Server');
        setConn(true);
    }, 800);

    // Event listeners for payment link updates
    ['s-name','s-country','s-phone','s-course'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const event = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(event, updateWaPayLink);
        }
    });
});

function hideLoader(msg) {
    const ldMsgEl = document.getElementById('ld-msg');
    if (ldMsgEl) ldMsgEl.textContent = msg || 'Ready!';
    setTimeout(() => document.getElementById('loader')?.classList.add('gone'), 600);
}

function setConn(live) {
    document.getElementById('conn-dot')?.classList.toggle('live', live);
    const label = document.getElementById('conn-label');
    if (label) label.textContent = live ? '● Live · Django' : '○ Offline';
}

/* ════════════════════════════════════════
   CSRF HELPER (Required for Django POST)
════════════════════════════════════════ */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/* ════════════════════════════════════════
   VALIDATION FUNCTION
════════════════════════════════════════ */
function validateForm() {
    const name = document.getElementById('s-name').value.trim();
    const country = document.getElementById('s-country').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const course = document.getElementById('s-course').value;
    const nrc = document.getElementById('f-nrc').files[0];

    if (!name) {
        toast("Full name is required", 'error');
        return false;
    }

    if (!country) {
        toast("Country is required", 'error');
        return false;
    }

    if (!phone || phone.length < 8) {
        toast("Enter a valid phone number", 'error');
        return false;
    }

    if (!course) {
        toast("Please select a course", 'error');
        return false;
    }

    if (!nrc) {
        toast("NRC / ID is required", 'error');
        return false;
    }

    if (nrc.size > 5 * 1024 * 1024) {
        toast("NRC file must be under 5MB", 'error');
        return false;
    }

    return true;
}

/* ════════════════════════════════════════
   SUBMIT APPLICATION
════════════════════════════════════════ */
async function submitApplication() {
    if (!validateForm()) return;
    
    const name = document.getElementById('s-name').value.trim();
    const country = document.getElementById('s-country').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const email = document.getElementById('s-email').value.trim();
    const course = document.getElementById('s-course').value;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';

    const formData = new FormData();
    formData.append('name', name);
    formData.append('country', country);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('course', course);

    // Get files directly from the input elements
    const nrcFile = document.getElementById('f-nrc').files[0];
    const transcriptFile = document.getElementById('f-transcript').files[0];
    const photoFile = document.getElementById('f-photo').files[0];
    const otherFile = document.getElementById('f-other').files[0];
    
    if (nrcFile) formData.append('nrc', nrcFile);
    if (transcriptFile) formData.append('transcript', transcriptFile);
    if (photoFile) formData.append('photo', photoFile);
    if (otherFile) formData.append('other', otherFile);

    // Debug: Log what we're sending
    console.log('Submitting:', {
        name, country, phone, email, course,
        nrc: nrcFile?.name,
        transcript: transcriptFile?.name,
        photo: photoFile?.name,
        other: otherFile?.name
    });

    try {
        const response = await fetch('/api/submit/', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            toast('✅ Application submitted successfully!', 'success');
            // Reset form after successful submission
            document.getElementById('view-student').reset();
            staged = {};
            DOC_KEYS.forEach(key => {
                const uz = document.getElementById('uz-' + key);
                if (uz) uz.classList.remove('ok');
            });
            setTimeout(() => {
                switchView('student');
            }, 2000);
        } else {
            throw new Error(result.message || 'Submission failed');
        }
    } catch (err) {
        console.error('Submission error:', err);
        toast(`❌ Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🎓 Submit Application to Invertis University';
    }
}

/* ════════════════════════════════════════
   ADMIN: DATA ACTIONS
════════════════════════════════════════ */
async function loadApps() {
    const list = document.getElementById('app-list');
    list.innerHTML = '<div class="empty"><span class="icon">⏳</span>Loading from database…</div>';
    
    try {
        const res = await fetch('/api/applications/');
        if (!res.ok) throw new Error('Could not fetch applications');
        
        allApps = await res.json();
        renderAdmin();
    } catch(err) {
        list.innerHTML = `<div class="empty"><span class="icon">⚠️</span>${esc(err.message)}</div>`;
    }
}

async function updateStatus(id, status) {
    try {
        const res = await fetch(`/api/applications/${id}/update/`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            allApps = allApps.map(a => a.id === id ? { ...a, status } : a);
            renderAdmin();
            toast(status === 'approved' ? '✅ Approved' : '❌ Rejected');
        }
    } catch(e) { 
        toast('Update failed: ' + e.message, 'error'); 
    }
}

/* ════════════════════════════════════════
   FILE HANDLING & UI
════════════════════════════════════════ */
function stageFile(key, input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) { 
        toast('File too large — max 5 MB', 'error'); 
        input.value = ''; 
        return; 
    }
    
    staged[key] = file;
    const uz = document.getElementById('uz-' + key);
    uz.classList.remove('bad', 'going'); 
    uz.classList.add('ok');
}

function updateWaPayLink() {
    const name   = document.getElementById('s-name')?.value.trim()   || 'Applicant';
    const phone  = document.getElementById('s-phone')?.value.trim()  || '';
    const course = document.getElementById('s-course')?.value        || 'the applied course';
    const msg = encodeURIComponent(
      `Hello! I am ${name}. I'd like to pay the application fee for *${course}*. Contact: ${phone}.`
    );
    const btn = document.getElementById('wa-pay-btn');
    if (btn) btn.href = `https://wa.me/${ADMISSIONS_WA}?text=${msg}`;
}

/* ════════════════════════════════════════
   VIEW SWITCHING
════════════════════════════════════════ */
function switchView(view) {
    setTabActive(view);
    if (view === 'student') {
        activateView('student');
    } else if (view === 'admin') {
        requestAdmin();
    }
}

function setTabActive(which) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + which)?.classList.add('active');
}

function requestAdmin() { 
    setTabActive('admin'); 
    if (adminUnlocked) activateView('admin'); 
    else openPin(); 
}

function activateView(v) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + v)?.classList.add('active');
    if (v === 'admin') loadApps();
}

function adminLogout() {
    adminUnlocked = false;
    pinBuf = '';
    document.getElementById('logout-btn').style.display = 'none';
    switchView('student');
    toast('Logged out of admin panel');
}

/* ════════════════════════════════════════
   PIN MODAL
════════════════════════════════════════ */
function openPin()  { 
    pinBuf = ''; 
    updDots(); 
    document.getElementById('pin-err').textContent = ''; 
    document.getElementById('pin-overlay').classList.add('open'); 
}

function closePin() { 
    document.getElementById('pin-overlay').classList.remove('open'); 
}

function pinKey(d) { 
    if (pinBuf.length >= 4) return; 
    pinBuf += d; 
    updDots(); 
    if (pinBuf.length === 4) checkPin(); 
}

function pinDel() {
    pinBuf = pinBuf.slice(0, -1);
    updDots();
}

function updDots() { 
    for(let i=0; i<4; i++) {
        const dot = document.getElementById('d'+i);
        if (dot) dot.classList.toggle('filled', i < pinBuf.length);
    }
}

function checkPin() {
    if (pinBuf === ADMIN_PIN) {
        adminUnlocked = true; 
        closePin();
        document.getElementById('logout-btn').style.display = 'inline-flex';
        activateView('admin');
    } else {
        document.getElementById('pin-err').textContent = '✕ Incorrect PIN';
        pinBuf = ''; 
        updDots();
    }
}
/* ════════════════════════════════════════
   DOCUMENT VIEWER
════════════════════════════════════════ */
function openDocModal(appId, docKey) {
    const app = allApps.find(a => String(a.id) === String(appId));
    if (!app) {
        toast('Application not found', 'error');
        return;
    }
    
    // Get the URL - handle both naming conventions
    const url = app[`${docKey}_url`] || app[docKey];
    if (!url) {
        toast('Document not available', 'error');
        return;
    }
    
    const modal = document.getElementById('doc-modal');
    const title = document.getElementById('dm-applicant-name');
    
    title.textContent = `${app.name} - ${DOC_NAMES[docKey]}`;
    
    // Create tabs for all documents of this applicant
    const tabsDiv = document.getElementById('dm-tabs');
    tabsDiv.innerHTML = DOC_KEYS.map(key => {
        const docUrl = app[`${key}_url`] || app[key];
        const isActive = key === docKey;
        return `<button class="dm-tab${isActive ? ' active' : ''}" 
                        onclick="viewDocument('${app.id}', '${key}')"
                        ${!docUrl ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    ${DOC_ICONS[key]} ${DOC_NAMES[key]}
                </button>`;
    }).join('');
    
    // Display the document
    viewDocument(appId, docKey);
    
    modal.style.display = 'flex';
}

function viewDocument(appId, docKey) {
    const app = allApps.find(a => String(a.id) === String(appId));
    if (!app) return;
    
    // Get the URL
    let url = app[`${docKey}_url`] || app[docKey];
    if (!url) {
        const frame = document.getElementById('dm-frame');
        frame.innerHTML = `<div class="dm-placeholder">
                            <span>❌</span>
                            <span>Document not available</span>
                           </div>`;
        return;
    }
    
    // If URL doesn't start with http, add the base URL
    if (!url.startsWith('http') && !url.startsWith('//')) {
        // Make sure URL starts with /media/
        if (!url.startsWith('/media/')) {
            url = '/media/' + url.replace(/^\/+/, '');
        }
        // Use full URL to avoid connection issues
        url = window.location.origin + url;
    }
    
    console.log('Loading document from URL:', url); // Debug log
    
    const frame = document.getElementById('dm-frame');
    
    // Get file extension
    const urlLower = url.toLowerCase();
    const isPdf = urlLower.endsWith('.pdf');
    const isImage = urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
    
    if (isImage) {
        frame.innerHTML = `<img src="${escapeHtml(url)}" alt="Document" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Crect width=\'200\' height=\'200\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\'%3EImage%20not%20found%3C/text%3E%3C/svg%3E'">`;
    } else if (isPdf) {
        frame.innerHTML = `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;">
                <div style="padding:10px;background:#f5f5f5;border-bottom:1px solid #ddd;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                    <a href="${escapeHtml(url)}" download class="dm-viewer-btn" style="background:#25D366;">
                        📥 Download PDF
                    </a>
                    <a href="${escapeHtml(url)}" target="_blank" class="dm-viewer-btn" style="background:#4285F4;">
                        🔗 Open in New Tab
                    </a>
                </div>
                <div style="flex:1;min-height:0;">
                    <embed src="${escapeHtml(url)}" type="application/pdf" width="100%" height="100%" 
                           onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:15px;\'><span style=\'font-size:48px;\'>📄</span><p>PDF cannot be previewed. Please download or open in new tab.</p><div style=\'display:flex;gap:15px;\'><a href=\'' + '${escapeHtml(url)}' + '\' download class=\'dm-viewer-btn\' style=\'background:#25D366;\'>📥 Download</a><a href=\'' + '${escapeHtml(url)}' + '\' target=\'_blank\' class=\'dm-viewer-btn\' style=\'background:#4285F4;\'>🔗 Open in New Tab</a></div></div>'">
                </div>
            </div>
        `;
    } else {
        frame.innerHTML = `
            <div class="dm-placeholder" style="gap:15px;">
                <span style="font-size:48px;">📎</span>
                <span style="font-size:14px;color:#666;">File cannot be previewed</span>
                <div style="display:flex;gap:15px;margin-top:10px;">
                    <a href="${escapeHtml(url)}" download class="dm-viewer-btn" style="background:#25D366;">
                        📥 Download File
                    </a>
                    <a href="${escapeHtml(url)}" target="_blank" class="dm-viewer-btn" style="background:#4285F4;">
                        🔗 Open in New Tab
                    </a>
                </div>
            </div>
        `;
    }
}

// Helper function to handle PDF errors
function handlePdfError(iframe) {
    const container = iframe.closest('#pdf-iframe-container');
    const downloadDiv = document.getElementById('pdf-download-only');
    if (container && downloadDiv) {
        container.style.display = 'none';
        downloadDiv.style.display = 'flex';
    }
}

// Toggle between iframe and download view for PDFs
function togglePdfViewer() {
    const iframeContainer = document.getElementById('pdf-iframe-container');
    const downloadOnly = document.getElementById('pdf-download-only');
    const toggleBtn = document.getElementById('toggle-pdf-btn');
    
    if (iframeContainer && downloadOnly) {
        if (iframeContainer.style.display === 'none') {
            iframeContainer.style.display = 'block';
            downloadOnly.style.display = 'none';
            if (toggleBtn) toggleBtn.textContent = '📖 Hide Preview';
        } else {
            iframeContainer.style.display = 'none';
            downloadOnly.style.display = 'flex';
            if (toggleBtn) toggleBtn.textContent = '📖 Show Preview';
        }
    }
}

function closeDocModal() {
    document.getElementById('doc-modal').style.display = 'none';
    document.getElementById('dm-frame').innerHTML = '<div class="dm-placeholder"><span>📂</span><span style="font-size:.9rem">Select a document above</span></div>';
}

// Helper function to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/* ════════════════════════════════════════
   RENDER ADMIN LIST WITH IMPROVED PREVIEWS
════════════════════════════════════════ */
function renderAdmin() {
    const apps = filter === 'all' ? allApps : allApps.filter(a => a.status === filter);
    
    // Stats update
    document.getElementById('st-total').textContent = allApps.length;
    document.getElementById('st-pend').textContent  = allApps.filter(a => a.status === 'pending').length;
    document.getElementById('st-appr').textContent  = allApps.filter(a => a.status === 'approved').length;
    document.getElementById('st-rej').textContent   = allApps.filter(a => a.status === 'rejected').length;

    const list = document.getElementById('app-list');
    if (!apps.length) {
        list.innerHTML = `<div class="empty"><span class="icon">📭</span>No applications found.</div>`;
        return;
    }

    list.innerHTML = apps.map(a => {
        const sbClass = a.status === 'approved' ? 'sb-a' : a.status === 'rejected' ? 'sb-r' : 'sb-p';
        const waNum   = (a.phone || '').replace(/\D/g, '');
        const waHref  = `https://wa.me/${waNum}?text=Hello ${encodeURIComponent(a.name)}`;

    // In renderAdmin(), when creating thumbnails
const thumbs = DOC_KEYS.map(k => {
    let url = a[`${k}_url`] || a[k];
    let previewHtml = '';
    
    if (url) {
        // Fix the URL
        if (!url.startsWith('http') && !url.startsWith('//')) {
            if (!url.startsWith('/media/')) {
                url = '/media/' + url.replace(/^\/+/, '');
            }
            url = window.location.origin + url;
        }
        
        const urlLower = url.toLowerCase();
        const isImage = urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
        const isPdf = urlLower.endsWith('.pdf');
        
        if (isImage) {
            previewHtml = `<div class="dt-preview"><img src="${escapeHtml(url)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'dt-preview missing-prev\'><span class=\'miss-icon\'>🖼️</span><span>No image</span></div>'"></div>`;
        } else if (isPdf) {
            previewHtml = `<div class="dt-preview pdf-prev"><span class="pdf-icon">📄</span><span>PDF</span></div>`;
        } else {
            previewHtml = `<div class="dt-preview pdf-prev"><span class="pdf-icon">📎</span><span>File</span></div>`;
        }
    } else {
        previewHtml = `<div class="dt-preview missing-prev"><span class="miss-icon">❌</span><span>Missing</span></div>`;
    }
    
    const clickUrl = url ? (url.startsWith('http') ? url : window.location.origin + url) : null;
    const clickAttr = clickUrl ? `onclick="openDocModal('${a.id}','${k}')"` : '';
    
    return `
        <div class="doc-thumb" ${clickAttr}>
            <div class="dt-label">${DOC_ICONS[k]} ${DOC_NAMES[k]}</div>
            ${previewHtml}
            ${clickUrl ? '<div class="dt-open"><button class="dt-open-btn">🔍 View</button></div>' : ''}
        </div>
    `;
}).join('');

        return `
        <div class="app-card s-${a.status}">
            <div class="act-row">
                <div class="app-info">
                    <span class="app-name">${escapeHtml(a.name)}</span>
                    <div class="app-meta">🌍 ${escapeHtml(a.country)} | 📞 ${escapeHtml(a.phone)} | ✉️ ${escapeHtml(a.email)}</div>
                    <div class="app-course">📚 ${escapeHtml(a.course)}</div>
                    <div class="app-date">📅 ${new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <div class="app-right">
                    <span class="sb ${sbClass}">${a.status}</span>
                    <div class="app-actions">
                        <button onclick="updateStatus('${a.id}','approved')" title="Approve">✓</button>
                        <button onclick="updateStatus('${a.id}','rejected')" title="Reject">✕</button>
                        <a class="btn btn-wa" href="${waHref}" target="_blank" title="WhatsApp">💬 WA</a>
                    </div>
                </div>
            </div>
            <div class="doc-panel">
                <div class="doc-panel-title">📎 ATTACHED DOCUMENTS</div>
                <div class="doc-thumbs">${thumbs}</div>
            </div>
        </div>`;
    }).join('');
}

/* ════════════════════════════════════════
   UTILS
════════════════════════════════════════ */
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toast(msg, type='') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; 
    t.className = 'show ' + type;
    setTimeout(() => t.className = '', 4000);
}