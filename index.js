
// --- CONFIGURATION ---
const SUPABASE_URL = "https://kejuyiqrztluhsinlkqk.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlanV5aXFyenRsdWhzaW5sa3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTUwNDksImV4cCI6MjA4MjA5MTA0OX0.R8ivp1lQwoRwNnBXR9KMWaxp_kaoShp3ZnTbALE3RNs";
const BACKEND_API_URL = "https://ballab-test.onrender.com"; 

// --- INIT SUPABASE ---
let supabase;
// CDN üzerinden gelen kütüphane 'supabase' global değişkenini oluşturur.
// createClient bu objenin içindedir.
if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Supabase kütüphanesi yüklenemedi. HTML'deki script tagini kontrol edin.");
}

// --- GLOBAL STATE ---
let state = {
    articles: [],
    categories: [],
    announcement: { text: '', active: false },
    files: [], 
    ads: { ad1: '', ad2: '' },
    logos: { bal: '', ballab: '', corensan: '' },
    team: [],
    teamTags: [],
    isAuthenticated: sessionStorage.getItem('admin_auth') === 'true',
    activeAdminTab: 'dashboard',
    editingId: null,
    visibleCount: 5,
    darkMode: localStorage.getItem('mimos_theme') === 'dark'
};

// --- DOMContentLoaded: ENTRY POINT ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Uygulama başlatılıyor...");

    // 1. ÖNCE ARAYÜZÜ KUR (Kritik Düzeltme: Veri beklemenden butonları çalıştır)
    // Tema Ayarla
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    // Cookie Kontrol
    checkCookieConsent();

    // Event Listenerları HEMEN ekle (Menü ve butonlar için)
    setupGlobalEvents();

    // 2. SONRA VERİLERİ ÇEK
    await fetchInitialData();

    // 3. EN SON İÇERİĞİ DOLDUR
    routePage();
});

// --- DATA FETCHING ---
async function fetchInitialData() {
    try {
        if (!supabase) throw new Error("Supabase yüklenemedi.");

        // Articles
        const { data: articles, error: artError } = await supabase
            .from('articles')
            .select('*')
            .order('id', { ascending: false });
        
        if (artError) console.warn("Makale çekme hatası:", artError);
        state.articles = articles || [];

        // Config
        const { data: config, error: confError } = await supabase
            .from('site_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (config) {
            state.categories = config.categories_list || [];
            state.announcement = config.announcement || { text: '', active: false };
            state.ads = config.ads || { ad1: '', ad2: '' };
            state.logos = config.logos || { bal: '', ballab: '', corensan: '' };
            state.team = config.team || [];
            state.teamTags = config.team_tags || [];
        }
    } catch (err) {
        console.error("Veri yükleme hatası:", err);
        // Hata olsa bile arayüzü bozma, sadece içeriği hata mesajıyla doldur
        showErrorOnPage("Veriler sunucudan alınamadı. Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.");
    }
}

// --- ROUTING ---
function routePage() {
    // Ortak Elemanları Render Et
    renderLogos();
    renderAnnouncement();
    renderSidebarCategories();

    // Sayfa Spesifik Render
    if (document.getElementById('admin-app')) {
        renderAdmin();
    } else if (document.getElementById('article-detail-container')) {
        renderArticleDetail();
    } else if (document.getElementById('search-results')) {
        renderSearch();
    } else if (document.getElementById('team-app')) {
        renderTeam();
    } else if (document.getElementById('app')) {
        // Anasayfa
        renderHome();
    }
}

// --- ERROR HANDLING ---
function showErrorOnPage(msg) {
    const containers = ['app', 'admin-app', 'search-results', 'team-app', 'article-detail-container'];
    const html = `<div class="text-center py-20 text-red-500 font-bold px-4">${msg}</div>`;
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}

// --- GLOBAL EVENT LISTENERS ---
function setupGlobalEvents() {
    console.log("Event listenerlar yükleniyor...");

    // Menü Açma/Kapama
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const closeSidebar = document.getElementById('sidebar-close');

    if(menuBtn && sidebar && overlay) {
        menuBtn.addEventListener('click', () => {
            console.log("Menü açılıyor");
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('opacity-0', 'pointer-events-none');
        });
        const close = () => {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('opacity-0', 'pointer-events-none');
        };
        overlay.addEventListener('click', close);
        if(closeSidebar) closeSidebar.addEventListener('click', close);
    }
    
    // Tema Değiştirme
    const themeBtn = document.getElementById('theme-btn');
    if(themeBtn) themeBtn.addEventListener('click', () => {
        state.darkMode = !state.darkMode;
        console.log("Tema değiştirildi:", state.darkMode ? "Dark" : "Light");
        localStorage.setItem('mimos_theme', state.darkMode ? 'dark' : 'light');
        if (state.darkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    });

    // İletişim Formu
    window.handleSendMessage = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            await fetch(`${BACKEND_API_URL}/api/contact`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(Object.fromEntries(fd))
            });
            alert("Mesajınız iletildi.");
            e.target.reset();
        } catch (err) {
            alert("Mesaj gönderilemedi.");
        }
    };

    // Arama Fonksiyonu (Global erişim için window'a atıyoruz)
    window.handleSearch = (e) => {
        e.preventDefault();
        const q = new FormData(e.target).get('q');
        if(q) window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
    };
}

// --- UI RENDERERS (COMMON) ---
function renderLogos() {
    const map = {
        'nav-logo-bal': state.logos.bal,
        'sidebar-logo-bal': state.logos.bal,
        'footer-logo-bal': state.logos.bal,
        'footer-logo-ballab': state.logos.ballab,
        'footer-logo-corensan': state.logos.corensan
    };
    for (const [id, src] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el && src) {
            el.src = src;
            el.classList.remove('hidden');
        }
    }
    const favicon = document.getElementById('dynamic-favicon');
    if(favicon && state.logos.ballab) favicon.href = state.logos.ballab;
}

function renderAnnouncement() {
    const container = document.getElementById('announcement-container');
    if (!container) return;
    if (!state.announcement.active || !state.announcement.text) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="bg-paper dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 relative transition-colors duration-300">
            <div class="max-w-7xl mx-auto flex items-center justify-center gap-3">
                <span class="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span class="text-sm font-serif italic text-gray-800 dark:text-gray-200">${state.announcement.text}</span>
            </div>
            <button id="close-ann-btn" class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">×</button>
        </div>
    `;
    document.getElementById('close-ann-btn')?.addEventListener('click', () => {
        container.innerHTML = '';
    });
}

function renderSidebarCategories() {
    const container = document.getElementById('sidebar-categories');
    if (!container) return;
    const mainCats = state.categories.filter(c => c.type === 'main');
    const yearCats = state.categories.filter(c => c.type === 'year');

    container.innerHTML = `
        <div class="space-y-6">
            <div>
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Kategoriler</h4>
                <div class="flex flex-col gap-2">
                    ${mainCats.map(c => `<a href="/?category=${encodeURIComponent(c.name)}" class="text-lg font-serif font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600">${c.name}</a>`).join('')}
                </div>
            </div>
            <div>
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Arşiv</h4>
                <div class="flex flex-wrap gap-2">
                    ${yearCats.map(c => `<a href="/?year=${encodeURIComponent(c.name)}" class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">${c.name}</a>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// --- PAGE: HOME ---
function renderHome() {
    const container = document.getElementById('app');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const catFilter = urlParams.get('category');
    const yearFilter = urlParams.get('year');

    let list = state.articles;
    let title = "Popüler İçerikler";

    if (catFilter) {
        list = list.filter(a => a.categories && a.categories.includes(catFilter));
        title = `Kategori: ${catFilter}`;
    } else if (yearFilter) {
        list = list.filter(a => a.date && a.date.includes(yearFilter));
        title = `Arşiv: ${yearFilter}`;
    }

    list.sort((a,b) => b.id - a.id);
    const visible = list.slice(0, state.visibleCount);
    const discovery = [...state.articles].sort(() => 0.5 - Math.random()).slice(0, 4);

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div class="lg:col-span-8 space-y-16">
                 <div class="flex items-baseline justify-between border-b border-gray-200 dark:border-gray-800 pb-4 mb-8">
                    <h2 class="text-2xl font-serif font-bold">${title}</h2>
                    ${(catFilter || yearFilter) ? `<a href="/" class="text-sm text-blue-500 hover:underline">Tümünü Göster</a>` : ''}
                 </div>
                ${visible.length === 0 ? '<p class="text-gray-500 italic">İçerik bulunamadı.</p>' : visible.map(article => `
                    <article class="group cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        <div class="md:col-span-5 order-2 md:order-1 overflow-hidden rounded-md">
                            <a href="/article.html?id=${article.id}">
                                <img src="${article.image_url}" class="w-full h-64 md:h-56 object-cover transform group-hover:scale-105 transition-transform duration-700 bg-gray-100 dark:bg-gray-800">
                            </a>
                        </div>
                        <div class="md:col-span-7 order-1 md:order-2 flex flex-col h-full justify-center">
                            <div class="flex flex-wrap items-center gap-2 mb-3">
                                ${article.categories ? article.categories.map(cat => `<span class="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${getCategoryStyle(cat)}">${cat}</span>`).join('') : ''}
                            </div>
                            <a href="/article.html?id=${article.id}" class="block">
                                <h3 class="text-2xl md:text-3xl font-serif font-bold mb-3 leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">${article.title}</h3>
                            </a>
                            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2 text-sm md:text-base">${article.excerpt}</p>
                            <div class="text-xs text-gray-400 font-medium">${article.author} &bull; ${article.date}</div>
                        </div>
                    </article>
                `).join('')}
                ${state.visibleCount < list.length ? `<div class="text-center pt-8"><button id="load-more-btn" class="px-8 py-3 border border-gray-300 rounded-full font-bold text-sm hover:bg-black hover:text-white transition-colors uppercase">Daha Fazla</button></div>` : ''}
            </div>
            <div class="lg:col-span-4 pl-0 lg:pl-12 lg:border-l border-gray-100 dark:border-gray-800">
                <div class="sticky top-24 space-y-12">
                    <div>
                        <h2 class="text-lg font-serif font-bold mb-8 border-b pb-4">Yeni Şeyler Keşfet</h2>
                        <div class="space-y-8">
                            ${discovery.map(a => `
                                <a href="/article.html?id=${a.id}" class="group flex gap-4 items-start">
                                    <div class="w-20 h-20 shrink-0 overflow-hidden rounded bg-gray-100"><img src="${a.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform"></div>
                                    <div><h4 class="font-serif font-bold text-sm leading-snug group-hover:underline">${a.title}</h4></div>
                                </a>
                            `).join('')}
                        </div>
                         ${state.ads.ad1 ? `<div class="mt-8 rounded-lg overflow-hidden border"><img src="${state.ads.ad1}" class="w-full h-auto"></div>` : ''}
                         ${state.ads.ad2 ? `<div class="mt-4 rounded-lg overflow-hidden border"><img src="${state.ads.ad2}" class="w-full h-auto"></div>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('load-more-btn')?.addEventListener('click', () => {
        state.visibleCount += 3;
        renderHome();
    });
}

// --- PAGE: ARTICLE DETAIL ---
function renderArticleDetail() {
    const container = document.getElementById('article-detail-container');
    if (!container) return;

    const id = parseInt(new URLSearchParams(window.location.search).get('id'));
    const article = state.articles.find(a => a.id === id);

    if (!article) {
        container.innerHTML = `<div class="text-center py-20"><h1 class="text-2xl font-bold">Bulunamadı</h1><a href="/" class="text-blue-500">Anasayfa</a></div>`;
        return;
    }

    // View Count Trigger
    const viewKey = `view_${id}`;
    if (!localStorage.getItem(viewKey)) {
        fetch(`${BACKEND_API_URL}/api/view/${id}`, { method: 'POST' });
        localStorage.setItem(viewKey, Date.now());
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <a href="/" class="flex items-center gap-2 text-sm text-gray-500 hover:text-ink dark:hover:text-white transition-colors">← Geri Dön</a>
            <div class="flex gap-2">${article.categories.map(c => `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getCategoryStyle(c)}">${c}</span>`).join('')}</div>
        </div>
        <header class="text-center mb-10">
            <h1 class="text-3xl md:text-5xl font-serif font-black mb-6 leading-tight text-ink dark:text-white">${article.title}</h1>
            <div class="flex justify-center items-center gap-4 text-sm text-gray-500"><span>${article.author}</span><span>•</span><span>${article.date}</span></div>
        </header>
        <div class="mb-12"><img src="${article.image_url}" class="w-full h-auto max-h-[500px] object-cover rounded-lg shadow-sm"></div>
        <div class="prose prose-lg dark:prose-invert mx-auto font-serif text-gray-800 dark:text-gray-300">${article.content}</div>
    `;
}

// --- PAGE: ADMIN ---
function renderAdmin() {
    const container = document.getElementById('admin-app');
    if (!container) return;

    if (!state.isAuthenticated) {
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[80vh]">
                <form id="login-form" class="w-full max-w-md p-10 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border">
                    <h2 class="text-3xl font-serif font-bold mb-6 text-center">Yönetici Paneli</h2>
                    <input type="password" id="admin-pass" class="w-full p-4 mb-6 bg-gray-50 dark:bg-gray-900 border rounded" placeholder="Şifre">
                    <button type="submit" class="w-full bg-black text-white py-4 rounded font-bold">GİRİŞ YAP</button>
                </form>
            </div>
        `;
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pass = document.getElementById('admin-pass').value;
            try {
                const res = await fetch(`${BACKEND_API_URL}/api/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ password: pass })
                });
                const data = await res.json();
                if (data.success) {
                    state.isAuthenticated = true;
                    sessionStorage.setItem('admin_auth', 'true');
                    renderAdmin();
                } else alert("Hatalı şifre");
            } catch(err) { alert("Sunucu hatası"); }
        });
        return;
    }

    // Admin Dashboard Template
    const tabs = ['dashboard', 'articles', 'categories', 'files', 'team', 'settings'];
    const activeView = getAdminView(state.activeAdminTab);

    container.innerHTML = `
        <div class="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
            <aside class="w-64 bg-white dark:bg-gray-800 border-r flex flex-col z-20">
                <div class="p-6 border-b"><span class="text-2xl font-serif font-black">Admin</span></div>
                <nav class="flex-grow p-4 space-y-2 overflow-y-auto">
                    ${tabs.map(t => `<button class="admin-tab-btn w-full text-left px-4 py-3 rounded capitalize ${state.activeAdminTab === t ? 'bg-gray-100 dark:bg-gray-700 font-bold border-l-4 border-blue-500' : 'hover:bg-gray-50'}" data-tab="${t}">${t === 'dashboard' ? 'Genel Bakış' : t}</button>`).join('')}
                </nav>
                <div class="p-4 border-t">
                    <button id="save-all-btn" class="w-full mb-2 px-4 py-2 bg-black text-white rounded font-bold text-sm">KAYDET</button>
                    <button id="logout-btn" class="w-full px-4 py-2 border border-red-200 text-red-500 rounded text-sm">Çıkış</button>
                </div>
            </aside>
            <main class="flex-1 overflow-auto p-8 relative"><div class="max-w-5xl mx-auto">${activeView}</div></main>
        </div>
    `;

    // Admin Event Listeners
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeAdminTab = btn.dataset.tab;
            if (state.activeAdminTab !== 'articles') state.editingId = null;
            renderAdmin();
        });
    });
    document.getElementById('logout-btn').addEventListener('click', () => {
        state.isAuthenticated = false;
        sessionStorage.removeItem('admin_auth');
        renderAdmin();
    });
    document.getElementById('save-all-btn').addEventListener('click', async () => {
        if(confirm("Tüm değişiklikler veritabanına kaydedilsin mi?")) {
            try {
                const res = await fetch(`${BACKEND_API_URL}/api/sync`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        articles: state.articles,
                        categories: state.categories,
                        announcement: state.announcement,
                        ads: state.ads,
                        logos: state.logos,
                        team: state.team,
                        teamTags: state.teamTags
                    })
                });
                if(res.ok) alert("Kaydedildi!");
                else alert("Hata!");
            } catch(e) { alert("Bağlantı hatası"); }
        }
    });

    // View Specific Listeners
    setupAdminViewListeners();
}

// --- ADMIN VIEWS ---
function getAdminView(tab) {
    if (tab === 'dashboard') {
        return `
            <h1 class="text-3xl font-bold mb-8">Genel Bakış</h1>
            <div class="grid grid-cols-3 gap-6">
                <div class="bg-white dark:bg-gray-800 p-6 rounded shadow"><h3 class="text-gray-500 text-xs font-bold uppercase">Makaleler</h3><p class="text-4xl font-black">${state.articles.length}</p></div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded shadow"><h3 class="text-gray-500 text-xs font-bold uppercase">Okunma</h3><p class="text-4xl font-black">${state.articles.reduce((a,b)=>a+(b.views||0),0)}</p></div>
            </div>
        `;
    }
    if (tab === 'articles') {
        const editArt = state.editingId ? state.articles.find(a => a.id === state.editingId) : null;
        return `
            <h1 class="text-3xl font-bold mb-8">Makale Yönetimi</h1>
            <div class="bg-white dark:bg-gray-800 p-8 rounded shadow mb-8">
                <h2 class="font-bold mb-4">${state.editingId ? 'Düzenle' : 'Yeni Ekle'}</h2>
                <form id="article-form" class="space-y-4">
                    <input name="title" required placeholder="Başlık" value="${editArt?.title || ''}" class="w-full p-2 border rounded bg-gray-50 dark:bg-gray-900">
                    <div class="flex gap-4">
                        <input name="author" required placeholder="Yazar" value="${editArt?.author || ''}" class="w-1/2 p-2 border rounded bg-gray-50 dark:bg-gray-900">
                        <input type="date" name="dateInput" class="w-1/2 p-2 border rounded bg-gray-50 dark:bg-gray-900">
                    </div>
                    <!-- Image Upload -->
                    <div class="flex gap-2 items-center">
                        <input name="imageUrl" id="art-img-url" placeholder="Görsel URL (Otomatik Dolar)" value="${editArt?.image_url || ''}" class="w-full p-2 border rounded bg-gray-50 dark:bg-gray-900">
                        <input type="file" id="art-img-file" class="hidden">
                        <button type="button" onclick="document.getElementById('art-img-file').click()" class="bg-gray-200 px-4 py-2 rounded text-sm font-bold">Yükle</button>
                    </div>
                    <div class="flex flex-wrap gap-2 p-2 border rounded bg-gray-50 dark:bg-gray-900">
                        ${state.categories.map(c => `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="categories" value="${c.name}" ${editArt?.categories?.includes(c.name)?'checked':''}>${c.name}</label>`).join('')}
                    </div>
                    <textarea name="content" required rows="6" placeholder="İçerik (HTML)" class="w-full p-2 border rounded bg-gray-50 dark:bg-gray-900 font-mono text-sm">${editArt?.content || ''}</textarea>
                    <div class="flex gap-2">
                        <button class="flex-1 bg-black text-white py-3 rounded font-bold">${state.editingId?'GÜNCELLE':'EKLE'}</button>
                        ${state.editingId ? '<button type="button" id="cancel-edit-btn" class="px-4 border rounded">İptal</button>' : ''}
                    </div>
                </form>
            </div>
            <div class="space-y-4">
                ${state.articles.map(a => `
                    <div class="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded border">
                        <div><h4 class="font-bold">${a.title}</h4><span class="text-xs text-gray-500">${a.date}</span></div>
                        <div class="flex gap-2">
                            <button class="edit-art-btn bg-blue-100 text-blue-600 px-3 py-1 rounded text-xs font-bold" data-id="${a.id}">Düzenle</button>
                            <button class="del-art-btn bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-bold" data-id="${a.id}">Sil</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    if (tab === 'files') {
        return `
            <h1 class="text-3xl font-bold mb-8">Dosyalar</h1>
            <div class="bg-white dark:bg-gray-800 p-8 rounded shadow mb-8">
                <div class="flex gap-4">
                    <input type="file" id="general-file-input" class="p-2 border rounded w-full">
                    <button id="general-upload-btn" class="bg-blue-600 text-white px-6 rounded font-bold">YÜKLE</button>
                </div>
            </div>
            <div class="grid grid-cols-4 gap-4" id="file-grid">
                <!-- Dosyalar buraya dinamik eklenebilir ama şu an için sadece upload özelliği yeterli -->
                <p class="col-span-4 text-gray-500 text-sm">Dosya yüklediğinizde URL'i size verilecektir. Kopyalayıp kullanabilirsiniz.</p>
            </div>
        `;
    }
    // Diğer tablar basitleştirildi...
    return `<div class="p-10 text-center">Bu menü şu an yapım aşamasında.</div>`;
}

// --- ADMIN LISTENERS (DYNAMIC) ---
function setupAdminViewListeners() {
    if (state.activeAdminTab === 'articles') {
        // Form Submit
        const form = document.getElementById('article-form');
        if (form) form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const cats = [];
            form.querySelectorAll('input[name="categories"]:checked').forEach(c => cats.push(c.value));
            
            let date = fd.get('dateInput') ? new Date(fd.get('dateInput')).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
            if (state.editingId) {
                const old = state.articles.find(a => a.id === state.editingId);
                if (!fd.get('dateInput') && old) date = old.date;
            }

            const newArt = {
                title: fd.get('title'),
                author: fd.get('author'),
                image_url: fd.get('imageUrl'),
                content: fd.get('content'),
                excerpt: fd.get('content').replace(/<[^>]*>?/gm, '').substring(0, 100) + '...',
                categories: cats,
                date: date,
                views: state.editingId ? (state.articles.find(a=>a.id===state.editingId)?.views || 0) : 0
            };

            if (state.editingId) {
                const idx = state.articles.findIndex(a => a.id === state.editingId);
                if (idx > -1) state.articles[idx] = { ...state.articles[idx], ...newArt };
                state.editingId = null;
            } else {
                state.articles.unshift({ id: Date.now(), ...newArt });
            }
            renderAdmin();
        });

        // Image Upload Helper
        const imgInput = document.getElementById('art-img-file');
        if (imgInput) imgInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const url = await uploadFile(e.target.files[0]);
                if (url) document.getElementById('art-img-url').value = url;
            }
        });

        // Edit/Delete Btns
        document.querySelectorAll('.edit-art-btn').forEach(b => b.addEventListener('click', () => { state.editingId = parseInt(b.dataset.id); renderAdmin(); }));
        document.querySelectorAll('.del-art-btn').forEach(b => b.addEventListener('click', async () => {
             if(confirm('Silinecek?')) {
                 const id = parseInt(b.dataset.id);
                 await fetch(`${BACKEND_API_URL}/api/articles/${id}`, { method: 'DELETE' });
                 state.articles = state.articles.filter(a => a.id !== id);
                 renderAdmin();
             }
        }));
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => { state.editingId = null; renderAdmin(); });
    }

    if (state.activeAdminTab === 'files') {
        document.getElementById('general-upload-btn')?.addEventListener('click', async () => {
            const f = document.getElementById('general-file-input').files[0];
            if (f) {
                const url = await uploadFile(f);
                if(url) prompt("Dosya Yüklendi! URL:", url);
            }
        });
    }
}

// --- FILE UPLOAD LOGIC ---
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(`${BACKEND_API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) return data.url;
        else throw new Error("Yükleme başarısız");
    } catch (e) {
        alert("Dosya yüklenirken hata oluştu.");
        console.error(e);
        return null;
    }
}

// --- UTILS ---
function getCategoryStyle(name) {
    const colors = ['bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-yellow-100 text-yellow-800'];
    let sum = 0;
    if(name) for(let i=0; i<name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
}

function checkCookieConsent() {
    if (!localStorage.getItem('cookie_consent')) {
        const b = document.createElement('div');
        b.className = 'fixed bottom-0 w-full bg-white dark:bg-gray-800 p-4 border-t shadow-2xl z-50 flex justify-between items-center';
        b.innerHTML = `<span>Çerez politikamızı kabul ediyor musunuz?</span> <button onclick="localStorage.setItem('cookie_consent','true');this.parentElement.remove()" class="bg-black text-white px-4 py-2 rounded">Kabul Et</button>`;
        document.body.appendChild(b);
    }
}