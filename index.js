

// --- CONFIGURATION ---
// DEĞİŞTİR: Supabase Proje URL ve Anon Key
const SUPABASE_URL = "BURAYA_SUPABASE_PROJECT_URL_YAZIN"; 
const SUPABASE_ANON_KEY = "BURAYA_SUPABASE_ANON_KEY_YAZIN";

// DEĞİŞTİR: Backend URL (Render'daki adres)
// Geliştirme ortamında (localhost) 'http://localhost:3000' kullanın.
// Canlıya (Render) atınca 'https://sizin-app-ismi.onrender.com' yapın.
const BACKEND_API_URL = "http://localhost:3000"; 

// --- INITIALIZE SUPABASE CLIENT (PUBLIC READ) ---
let supabase;
if (typeof createClient !== 'undefined') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    // Fallback in case script isn't loaded yet (though it should be)
    console.error("Supabase script loaded properly.");
}

// --- STATE ---
let state = {
    articles: [],
    categories: [],
    announcement: { text: '', active: false },
    files: [], // Storage files list (We might fetch differently or keep simplified)
    messages: [], // Fetched only for admin
    adminConfig: { password: '' }, // Handled by backend mostly
    ads: { ad1: '', ad2: '' },
    logos: { bal: '', ballab: '', corensan: '' },
    team: [],
    teamTags: [],
    isAuthenticated: false,
    darkMode: false, 
    menuOpen: false,
    editingId: null,
    visibleCount: 5,
    activeAdminTab: 'dashboard'
};

// --- DATA FETCHING (HYBRID: SUPABASE DIRECT + BACKEND) ---
const initApp = async () => {
    // Theme Init
    const storedTheme = localStorage.getItem('mimos_theme');
    if (storedTheme) {
        state.darkMode = storedTheme === 'dark';
    } else {
        state.darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    checkCookieConsent();

    try {
        if(!supabase) throw new Error("Supabase Client not initialized");

        // 1. Fetch Articles (Direct from Supabase)
        let { data: articles, error: artError } = await supabase
            .from('articles')
            .select('*')
            .order('id', { ascending: false });
        
        if(artError) throw artError;
        state.articles = articles || [];

        // 2. Fetch Config (Direct from Supabase)
        let { data: config, error: confError } = await supabase
            .from('site_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (confError && confError.code !== 'PGRST116') throw confError; // PGRST116: No rows found

        if (config) {
            state.categories = config.categories_list || [];
            state.announcement = config.announcement || { text: '', active: false };
            state.ads = config.ads || { ad1: '', ad2: '' };
            state.logos = config.logos || { bal: '', ballab: '', corensan: '' };
            state.team = config.team || [];
            state.teamTags = config.team_tags || [];
        }

        // 3. Routing
        const adminApp = document.getElementById('admin-app');
        const publicApp = document.getElementById('app'); 
        const searchApp = document.getElementById('search-results'); 
        const teamApp = document.getElementById('team-app');
        const articleDetailContainer = document.getElementById('article-detail-container');

        renderSidebarCategories();
        renderAnnouncement();
        renderLogos();

        if (adminApp) {
            if(sessionStorage.getItem('admin_auth') === 'true') {
                state.isAuthenticated = true;
                // If admin, we might need messages, fetched via backend usually or direct if RLS allows
                // For simplicity/security, let's keep messages hidden or require backend call
            }
            renderAdmin(adminApp);
        } else if (searchApp) {
            renderSearch(searchApp);
        } else if (teamApp) {
            renderTeam(teamApp);
        } else if (articleDetailContainer) {
            renderArticleDetail(articleDetailContainer);
        } else if (publicApp) {
            renderHome(publicApp);
        }
        
    } catch (error) {
        console.error("Veri yükleme hatası:", error);
        // Error UI logic...
        const errorHTML = `<p class="text-center p-10 text-red-500">Veriler yüklenemedi. Lütfen bağlantınızı kontrol edin.</p>`;
        const publicApp = document.getElementById('app');
        if(publicApp) publicApp.innerHTML = errorHTML;
    }
};

// --- COOKIE CONSENT (Same as before) ---
const checkCookieConsent = () => {
    if (!localStorage.getItem('cookie_consent')) {
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        let classes = 'fixed z-50 bg-white dark:bg-gray-800 p-6 flex flex-col gap-4 border-gray-100 dark:border-gray-700 transform transition-all duration-700 ease-out shadow-[0_-5px_20px_rgba(0,0,0,0.15)] md:shadow-2xl ';
        classes += 'bottom-0 left-0 right-0 w-full rounded-t-3xl border-t ';
        classes += 'md:bottom-8 md:right-8 md:left-auto md:w-96 md:rounded-2xl md:border ';
        classes += 'translate-y-full opacity-0 md:translate-y-0 md:translate-x-10';
        banner.className = classes;
        banner.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="text-4xl animate-bounce">🍪</div>
                <div>
                    <h3 class="font-serif font-bold text-lg mb-2 text-ink dark:text-white">Verilerinize Saygı Duyuyoruz</h3>
                    <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        Çerezleri yalnızca sitemizi optimize etmek ve hizmetlerimizi geliştirmek için kullanıyoruz.
                    </p>
                </div>
            </div>
            <div class="flex justify-end">
                <button onclick="acceptCookies()" class="bg-black text-white dark:bg-white dark:text-black px-8 py-3 md:py-2 rounded-full font-bold text-xs uppercase tracking-widest hover:opacity-80 transition shadow-lg w-full md:w-auto">Anladım</button>
            </div>
        `;
        document.body.appendChild(banner);
        setTimeout(() => {
            banner.classList.remove('translate-y-full', 'opacity-0', 'md:translate-x-10');
        }, 500); 
    }
};

window.acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'true');
    const banner = document.getElementById('cookie-banner');
    if(banner) {
        banner.classList.add('translate-y-full', 'opacity-0', 'md:translate-y-0', 'md:translate-x-10');
        setTimeout(() => banner.remove(), 700);
    }
};

// --- LOGO & UI RENDERERS (Same as before) ---
const renderLogos = () => {
    const setSrc = (id, src) => {
        const el = document.getElementById(id);
        if(el && src) {
            el.src = src;
            el.classList.remove('hidden');
        }
    };
    setSrc('nav-logo-bal', state.logos.bal);
    setSrc('sidebar-logo-bal', state.logos.bal);
    setSrc('footer-logo-bal', state.logos.bal);
    setSrc('footer-logo-ballab', state.logos.ballab);
    setSrc('footer-logo-corensan', state.logos.corensan);
    const favicon = document.getElementById('dynamic-favicon');
    if(favicon && state.logos.ballab) {
        favicon.href = state.logos.ballab;
    }
};

window.getCategoryStyle = (name) => {
    const colors = [
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
        'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
        'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
    ];
    let sum = 0;
    if(name) {
        for (let i = 0; i < name.length; i++) { sum += name.charCodeAt(i); }
    }
    return colors[sum % colors.length];
};

const toggleTheme = () => {
    state.darkMode = !state.darkMode;
    if (state.darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('mimos_theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('mimos_theme', 'light');
    }
};

const toggleMenu = (force) => {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if(!sidebar || !sidebarOverlay) return;

    state.menuOpen = force !== undefined ? force : !state.menuOpen;
    if (state.menuOpen) {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
    }
};

window.handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const query = formData.get('q');
    if(!query || query.length < 3) {
        alert("Arama yapmak için en az 3 karakter girmelisiniz.");
        return;
    }
    window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
};

const renderAnnouncement = () => {
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
            <button onclick="closeAnnouncement()" class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">×</button>
        </div>
    `;
};

window.closeAnnouncement = () => {
    const container = document.getElementById('announcement-container');
    if(container) container.innerHTML = '';
};

const renderSidebarCategories = () => {
    const container = document.getElementById('sidebar-categories');
    if (!container) return;

    const mainCats = state.categories.filter(c => c.type === 'main');
    const yearCats = state.categories.filter(c => c.type === 'year');

    container.innerHTML = `
        <div class="space-y-6">
            <div>
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ana Kategoriler</h4>
                <div class="flex flex-col gap-2">
                    ${mainCats.map(c => `
                        <a href="/?category=${encodeURIComponent(c.name)}" class="text-lg font-serif font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            ${c.name}
                        </a>
                    `).join('')}
                </div>
            </div>
            <div>
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Arşiv</h4>
                <div class="flex flex-wrap gap-2">
                    ${yearCats.map(c => `
                        <a href="/?year=${encodeURIComponent(c.name)}" class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            ${c.name}
                        </a>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
};

// ==========================================
// PUBLIC PAGES (READING)
// ==========================================

const parseTurkishDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const months = {
        'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
        'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
    };
    try {
        const parts = dateStr.toLowerCase().split(' ');
        if(parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = months[parts[1]] || 0;
            const year = parseInt(parts[2]);
            return new Date(year, month, day);
        }
    } catch(e) { }
    return new Date(0);
}

const renderHome = (container) => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFilter = urlParams.get('category');
    const yearFilter = urlParams.get('year');

    let displayArticles = state.articles;
    let pageTitle = "Popüler İçerikler";

    if (categoryFilter) {
        displayArticles = state.articles.filter(a => a.categories && a.categories.includes(categoryFilter));
        pageTitle = `Kategori: ${categoryFilter}`;
    } else if (yearFilter) {
        displayArticles = state.articles.filter(a => a.date && a.date.includes(yearFilter));
        pageTitle = `Arşiv: ${yearFilter}`;
    }

    const now = new Date();
    displayArticles.sort((a, b) => {
        // Simple sorting for now
        return (b.id) - (a.id);
    });
    
    // Discovery: Random 4
    const discovery = [...state.articles].sort(() => 0.5 - Math.random()).slice(0, 4);
    
    const visibleArticles = displayArticles.slice(0, state.visibleCount);
    const hasMore = state.visibleCount < displayArticles.length;

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div class="lg:col-span-8 space-y-16">
                 <div class="flex items-baseline justify-between border-b border-gray-200 dark:border-gray-800 pb-4 mb-8">
                    <h2 class="text-2xl font-serif font-bold">${pageTitle}</h2>
                    ${(categoryFilter || yearFilter) ? `<a href="/" class="text-sm text-blue-500 hover:underline">Tümünü Göster</a>` : ''}
                 </div>
                
                ${visibleArticles.length === 0 ? '<p class="text-gray-500 italic">Bu kriterlere uygun içerik bulunamadı.</p>' : visibleArticles.map((article) => `
                    <article class="group cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        <div class="md:col-span-5 order-2 md:order-1 overflow-hidden rounded-md">
                            <a href="/article.html?id=${article.id}">
                                <img src="${article.image_url}" alt="${article.title}" class="w-full h-64 md:h-56 object-cover transform group-hover:scale-105 transition-transform duration-700 grayscale-[20%] group-hover:grayscale-0 bg-gray-100 dark:bg-gray-800">
                            </a>
                        </div>
                        <div class="md:col-span-7 order-1 md:order-2 flex flex-col h-full justify-center">
                            <div class="flex flex-wrap items-center gap-2 mb-3">
                                ${article.categories ? article.categories.map(cat => `
                                    <span class="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${window.getCategoryStyle(cat)}">${cat}</span>
                                `).join('') : ''}
                            </div>
                            <a href="/article.html?id=${article.id}" class="block">
                                <h3 class="text-2xl md:text-3xl font-serif font-bold mb-3 leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                                    ${article.title}
                                </h3>
                            </a>
                            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2 text-sm md:text-base">
                                ${article.excerpt}
                            </p>
                            <div class="text-xs text-gray-400 font-medium flex gap-2">
                                <span>${article.author} &bull; ${article.date}</span>
                                <span class="text-gray-300 dark:text-gray-600">|</span>
                                <span>${article.views || 0} görüntülenme</span>
                            </div>
                        </div>
                    </article>
                `).join('')}

                ${hasMore ? `
                    <div class="text-center pt-8">
                        <button onclick="handleLoadMore()" class="px-8 py-3 border border-gray-300 dark:border-gray-600 rounded-full font-bold text-sm hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors uppercase tracking-widest">
                            Daha Fazla Göster
                        </button>
                    </div>
                ` : ''}
            </div>

            <div class="lg:col-span-4 pl-0 lg:pl-12 lg:border-l border-gray-100 dark:border-gray-800">
                <div class="sticky top-24 space-y-12">
                    <div>
                        <h2 class="text-lg font-serif font-bold mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
                            Yeni Şeyler Keşfet
                        </h2>
                        <div class="space-y-8">
                            ${discovery.map(article => `
                                <a href="/article.html?id=${article.id}" class="group flex gap-4 items-start">
                                    <div class="w-20 h-20 shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                                        <img src="${article.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform">
                                    </div>
                                    <div>
                                        <div class="flex flex-wrap gap-1 mb-1">
                                            ${article.categories ? article.categories.slice(0, 1).map(cat => `
                                                <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">${cat}</span>
                                            `).join('') : ''}
                                        </div>
                                        <h4 class="font-serif font-bold text-sm leading-snug group-hover:underline decoration-1 underline-offset-4">
                                            ${article.title}
                                        </h4>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                        ${state.ads.ad1 ? `
                        <div class="mt-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <img src="${state.ads.ad1}" class="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity">
                        </div>` : ''}
                        ${state.ads.ad2 ? `
                        <div class="mt-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <img src="${state.ads.ad2}" class="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity">
                        </div>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderTeam = (container) => {
    container.innerHTML = `
        <div class="max-w-7xl mx-auto py-8">
            <h1 class="text-4xl font-serif font-bold mb-16 text-center">Ekibimiz</h1>
            
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-8">
                ${state.team.map(member => `
                    <div class="bg-gray-100 dark:bg-gray-800 relative w-full aspect-square p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
                        
                        <!-- Top: Name -->
                        <h3 class="text-xl md:text-2xl font-serif font-bold text-center text-ink dark:text-white mt-4 group-hover:scale-105 transition-transform">${member.name}</h3>
                        
                        <!-- Middle: Tags as Pills -->
                        <div class="flex flex-wrap justify-center content-center gap-2 my-2">
                            ${member.tags.map(tag => `
                                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${window.getCategoryStyle(tag)}">${tag}</span>
                            `).join('')}
                        </div>

                        <!-- Bottom Right: YouTube Link -->
                        <a href="${member.youtubeLink || '#'}" target="_blank" class="absolute bottom-4 right-4 text-red-600 hover:text-red-700 transition-colors hover:scale-110">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                            </svg>
                        </a>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

window.handleLoadMore = () => {
    state.visibleCount += 3;
    const publicApp = document.getElementById('app');
    renderHome(publicApp);
};

const renderSearch = (container) => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';
    if(!query) {
        container.innerHTML = '<p class="text-center py-12">Arama terimi bulunamadı.</p>';
        return;
    }
    const lowerQuery = query.toLowerCase();
    const results = state.articles.filter(a => 
        (a.title && a.title.toLowerCase().includes(lowerQuery)) || 
        (a.excerpt && a.excerpt.toLowerCase().includes(lowerQuery)) ||
        (a.author && a.author.toLowerCase().includes(lowerQuery)) ||
        (a.categories && a.categories.some(c => c.toLowerCase().includes(lowerQuery)))
    );
    container.innerHTML = `
        <div class="max-w-4xl mx-auto py-8">
            <h1 class="text-3xl font-serif font-bold mb-2">Arama Sonuçları</h1>
            <p class="text-gray-500 mb-12 border-b border-gray-200 dark:border-gray-700 pb-4">"${query}" araması için ${results.length} sonuç bulundu.</p>
            <div class="space-y-12">
                ${results.length === 0 ? '<p class="text-gray-500 italic">Sonuç bulunamadı.</p>' : results.map((article) => `
                    <article class="group cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        <div class="md:col-span-4 order-2 md:order-1 overflow-hidden rounded-md">
                            <a href="/article.html?id=${article.id}">
                                <img src="${article.image_url}" alt="${article.title}" class="w-full h-48 object-cover transform group-hover:scale-105 transition-transform duration-700 grayscale-[20%] group-hover:grayscale-0">
                            </a>
                        </div>
                        <div class="md:col-span-8 order-1 md:order-2 flex flex-col h-full justify-center">
                            <div class="flex flex-wrap items-center gap-2 mb-2">
                                ${article.categories.map(cat => `
                                    <span class="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${window.getCategoryStyle(cat)}">${cat}</span>
                                `).join('')}
                            </div>
                            <a href="/article.html?id=${article.id}" class="block">
                                <h3 class="text-xl md:text-2xl font-serif font-bold mb-2 leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">${article.title}</h3>
                            </a>
                            <p class="text-gray-600 dark:text-gray-400 leading-relaxed mb-2 line-clamp-2 text-sm">${article.excerpt}</p>
                        </div>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
};

// --- DYNAMIC ARTICLE RENDERER ---
const renderArticleDetail = (container) => {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = parseInt(urlParams.get('id'));

    if (!articleId) {
        container.innerHTML = `<div class="text-center py-20"><h1 class="text-2xl font-bold mb-4">Makale bulunamadı.</h1><a href="/" class="text-blue-600 hover:underline">Anasayfaya Dön</a></div>`;
        return;
    }

    const article = state.articles.find(a => a.id === articleId);

    if (!article) {
        container.innerHTML = `<div class="text-center py-20"><h1 class="text-2xl font-bold mb-4">İçerik Bulunamadı</h1><p class="text-gray-500 mb-8">Aradığınız makale silinmiş veya taşınmış olabilir.</p><a href="/" class="bg-black text-white px-6 py-3 rounded-full font-bold">Anasayfaya Dön</a></div>`;
        return;
    }

    document.title = `${article.title} - BALLAB`;

    // View Count via Backend (Backend handles DB write)
    const viewKey = `view_cooldown_${article.id}`;
    const lastView = localStorage.getItem(viewKey);
    const now = Date.now();
    const cooldown = 600000; 

    if (!lastView || now - parseInt(lastView) > cooldown) {
        fetch(`${BACKEND_API_URL}/api/view/${article.id}`, { method: 'POST' }).catch(e => console.error(e));
        localStorage.setItem(viewKey, now.toString());
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <a href="/" class="flex items-center gap-2 text-sm text-gray-500 hover:text-ink dark:hover:text-white transition-colors">← Geri Dön</a>
            <div class="flex gap-2" id="article-cat-container">
                ${article.categories.map(c => `
                    <span class="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${window.getCategoryStyle(c)}">${c}</span>
                `).join('')}
            </div>
        </div>
        
        <header class="text-center mb-10">
            <h1 class="text-3xl md:text-5xl font-serif font-black mb-6 leading-tight text-ink dark:text-white">${article.title}</h1>
            <div class="flex justify-center items-center gap-4 text-sm text-gray-500">
                <span>${article.author}</span><span>•</span><span>${article.date}</span>
            </div>
        </header>

        <div class="mb-12">
            <img src="${article.image_url}" alt="${article.title}" class="w-full h-auto max-h-[500px] object-cover rounded-lg shadow-sm">
        </div>

        <div class="prose prose-lg dark:prose-invert mx-auto font-serif text-gray-800 dark:text-gray-300">
            ${article.content}
        </div>
    `;
};


// ==========================================
// ADMIN PANEL (WRITES TO BACKEND API)
// ==========================================

const renderAdmin = (container) => {
    if(!state.isAuthenticated) {
        container.innerHTML = renderLogin();
        return;
    }

    container.innerHTML = `
        <div class="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
            <!-- Sidebar -->
            <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20">
                <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span class="text-2xl font-serif font-black">Admin</span>
                </div>
                <nav class="flex-grow p-4 space-y-2 overflow-y-auto">
                    ${renderAdminSidebarButton('dashboard', 'Dashboard')}
                    ${renderAdminSidebarButton('articles', 'Makaleler')}
                    ${renderAdminSidebarButton('categories', 'Kategoriler')}
                    ${renderAdminSidebarButton('files', 'Dosyalar')}
                    ${renderAdminSidebarButton('team', 'Ekip Yönetimi')}
                    ${renderAdminSidebarButton('settings', 'Ayarlar')}
                </nav>
                <div class="p-4 border-t border-gray-200 dark:border-gray-700">
                    <button onclick="saveChanges()" class="w-full mb-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded font-bold text-sm">KAYDET</button>
                    <button onclick="handleLogout()" class="w-full px-4 py-2 border border-red-200 text-red-500 rounded text-sm hover:bg-red-50">Çıkış</button>
                </div>
            </aside>

            <!-- Main Content -->
            <main class="flex-1 overflow-auto p-8 relative">
                <div class="max-w-5xl mx-auto">
                    ${renderAdminContent()}
                </div>
            </main>
        </div>
    `;
};

// ... Admin Views (These remain largely same in structure, just data binding) ...

const renderAdminSidebarButton = (tab, label) => {
    const isActive = state.activeAdminTab === tab;
    return `
        <button onclick="switchAdminTab('${tab}')" 
            class="w-full text-left px-4 py-3 rounded transition-colors ${isActive ? 'bg-gray-100 dark:bg-gray-700 font-bold border-l-4 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}">
            ${label}
        </button>
    `;
};

window.switchAdminTab = (tab) => {
    state.activeAdminTab = tab;
    if (tab !== 'articles') state.editingId = null; 
    const adminApp = document.getElementById('admin-app');
    renderAdmin(adminApp);
};

const renderAdminContent = () => {
    switch(state.activeAdminTab) {
        case 'dashboard': return renderDashboardView();
        case 'articles': return renderArticlesView();
        case 'categories': return renderCategoriesView();
        case 'files': return renderFilesView();
        case 'team': return renderTeamSettingsView();
        case 'settings': return renderSettingsView();
        default: return renderDashboardView();
    }
};

const renderDashboardView = () => `
    <h1 class="text-3xl font-serif font-bold mb-8">Genel Bakış</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-gray-500 text-sm font-bold uppercase mb-2">Toplam Makale</h3>
            <p class="text-4xl font-black">${state.articles.length}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-gray-500 text-sm font-bold uppercase mb-2">Toplam Okunma</h3>
            <p class="text-4xl font-black">${state.articles.reduce((acc, curr) => acc + (curr.views || 0), 0)}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 class="text-gray-500 text-sm font-bold uppercase mb-2">Dosyalar (Yaklaşık)</h3>
            <p class="text-4xl font-black">${state.files.length}</p>
        </div>
    </div>
    <div class="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900 text-blue-800 dark:text-blue-200">
        <p class="font-bold">Unutmayın!</p>
        <p class="text-sm mt-1">Yapılan tüm değişikliklerin veritabanına işlenmesi için sol menüden <span class="font-bold">KAYDET</span> butonuna basmanız gerekmektedir.</p>
    </div>
`;

const renderArticlesView = () => {
    let editArticle = null;
    if (state.editingId) editArticle = state.articles.find(a => a.id === state.editingId);

    return `
    <h1 class="text-3xl font-serif font-bold mb-8">Makale Yönetimi</h1>
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-12 relative">
        ${state.editingId ? `<div class="absolute top-4 right-4 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">DÜZENLEME MODU</div>` : ''}
        <h2 class="text-xl font-bold mb-6">${state.editingId ? 'Makaleyi Düzenle' : 'Yeni Makale Oluştur'}</h2>
        
        <form onsubmit="handleAddArticle(event)" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input name="title" required placeholder="Başlık" value="${editArticle ? editArticle.title : ''}" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded">
                <input name="author" required placeholder="Yazar" value="${editArticle ? editArticle.author : ''}" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="date" name="dateInput" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded text-gray-500">
                    <input name="imageUrl" placeholder="Kapak Görseli URL" value="${editArticle ? editArticle.image_url : ''}" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded">
            </div>
            <div>
                <label class="block text-sm font-bold mb-2 text-gray-500">Kategoriler</label>
                <div class="flex flex-wrap gap-4 p-4 border rounded bg-gray-50 dark:bg-gray-900">
                    ${state.categories.map(c => `
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" name="categories" value="${c.name}" class="rounded w-4 h-4" 
                                ${(editArticle && editArticle.categories && editArticle.categories.includes(c.name)) ? 'checked' : ''}>
                            <span class="text-sm">${c.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <textarea name="content" required rows="10" placeholder="İçerik (HTML)" class="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded font-mono text-sm">${editArticle ? editArticle.content : ''}</textarea>
            
            <div class="flex gap-4">
                <button class="flex-1 bg-black text-white dark:bg-white dark:text-black py-4 rounded font-bold uppercase hover:opacity-90">
                    ${state.editingId ? 'GÜNCELLE' : 'LİSTEYE EKLE'}
                </button>
                ${state.editingId ? `<button type="button" onclick="cancelEdit()" class="px-6 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Vazgeç</button>` : ''}
            </div>
        </form>
    </div>

    <div class="space-y-4">
        ${state.articles.map(article => `
            <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-md transition">
                <div>
                    <h3 class="font-bold text-lg">${article.title}</h3>
                    <div class="text-xs text-gray-500 mt-1">${article.date} • ${article.author} • ${article.views || 0} Görüntülenme</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="handleEditArticle(${article.id})" class="text-xs bg-blue-100 text-blue-600 px-3 py-2 rounded font-bold hover:bg-blue-200">Düzenle</button>
                    <button onclick="handleDeleteArticle(${article.id})" class="text-xs bg-red-100 text-red-600 px-3 py-2 rounded font-bold hover:bg-red-200">Sil</button>
                </div>
            </div>
        `).join('')}
    </div>
    `;
};

const renderCategoriesView = () => `
    <h1 class="text-3xl font-serif font-bold mb-8">Kategori Yönetimi</h1>
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
        <form onsubmit="handleAddCategory(event)" class="flex gap-4 items-end">
            <div class="flex-grow">
                 <label class="block text-xs font-bold text-gray-500 mb-1">Kategori Adı</label>
                 <input name="catName" required class="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded">
            </div>
            <div class="w-1/3">
                 <label class="block text-xs font-bold text-gray-500 mb-1">Tip</label>
                 <select name="catType" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded">
                    <option value="main">Ana Kategori</option>
                    <option value="sub">Alt Kategori</option>
                    <option value="year">Yıl</option>
                </select>
            </div>
            <button class="px-6 py-2 bg-blue-600 text-white rounded font-bold h-10">EKLE</button>
        </form>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${state.categories.map(c => `
            <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                <div>
                    <span class="font-bold block">${c.name}</span>
                    <span class="text-xs text-gray-400 uppercase">${c.type === 'main' ? 'Ana Kategori' : c.type}</span>
                </div>
                <button onclick="handleDeleteCategory(${c.id})" class="text-red-400 font-bold px-2 py-1 hover:bg-red-50 rounded">SİL</button>
            </div>
        `).join('')}
    </div>
`;

const renderFilesView = () => `
    <h1 class="text-3xl font-serif font-bold mb-8">Dosya Yönetimi</h1>
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
         <form onsubmit="handleFileUpload(event)" class="flex gap-4 items-end">
            <div class="flex-grow">
                <label class="block text-xs font-bold text-gray-500 mb-1">Dosya Adı (Opsiyonel)</label>
                <input type="text" id="file-name" class="w-full p-2 text-sm border rounded bg-white dark:bg-gray-900">
            </div>
            <div class="flex-grow">
                <label class="block text-xs font-bold text-gray-500 mb-1">Dosya Seç</label>
                <input type="file" id="file-input" accept="image/*" class="w-full text-xs">
            </div>
            <button class="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold h-10">YÜKLE</button>
        </form>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        ${state.files.map(f => `
            <div class="p-3 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 group relative">
                <div class="aspect-square bg-gray-100 mb-2 rounded overflow-hidden">
                    <img src="${f.data}" class="w-full h-full object-cover">
                </div>
                <div class="text-xs font-bold truncate mb-2">${f.name}</div>
                <div class="flex flex-col gap-1">
                    <button onclick="copyToClipboard('${f.data}')" class="w-full py-1 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold rounded hover:bg-gray-200">URL KOPYALA</button>
                    <button onclick="handleDeleteFile(${f.id})" class="w-full py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded hover:bg-red-100">SİL</button>
                </div>
            </div>
        `).join('')}
    </div>
`;

const renderTeamSettingsView = () => `
    <h1 class="text-3xl font-serif font-bold mb-8">Ekip Yönetimi</h1>
    <!-- Tag Management -->
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
        <h2 class="text-lg font-serif font-bold mb-4">Etiket Havuzu</h2>
        <form onsubmit="handleAddTeamTag(event)" class="flex gap-4 items-end mb-4">
            <input name="tagName" required placeholder="Etiket Adı (Örn: Editör)" class="flex-grow p-2 bg-gray-50 dark:bg-gray-900 border rounded">
            <button class="px-6 py-2 bg-blue-600 text-white rounded font-bold h-10">EKLE</button>
        </form>
        <div class="flex flex-wrap gap-2">
            ${state.teamTags.map((tag, index) => `
                <div class="flex items-center gap-2 px-3 py-1 rounded-full ${window.getCategoryStyle(tag)}">
                    <span class="text-xs font-bold uppercase tracking-wide">${tag}</span>
                    <button onclick="handleDeleteTeamTag(${index})" class="hover:text-red-500 font-bold ml-1">×</button>
                </div>
            `).join('')}
        </div>
    </div>

    <!-- Member Management -->
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
        <h2 class="text-lg font-serif font-bold mb-6">Yeni Ekip Üyesi Ekle</h2>
        <form onsubmit="handleAddTeamMember(event)" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" required placeholder="İsim Soyisim" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded">
                <input name="youtubeLink" placeholder="Youtube Bağlantısı (Opsiyonel)" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 mb-2">Etiketler</label>
                <div class="flex flex-wrap gap-4 p-4 border rounded bg-gray-50 dark:bg-gray-900">
                    ${state.teamTags.map(tag => `
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" name="tags" value="${tag}" class="rounded w-4 h-4">
                            <span class="text-xs font-bold px-2 py-1 rounded ${window.getCategoryStyle(tag)}">${tag}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <button class="w-full py-3 bg-black text-white dark:bg-white dark:text-black rounded font-bold">LİSTEYE EKLE</button>
        </form>
    </div>

    <div class="space-y-4">
        ${state.team.map((member, index) => `
            <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                <div>
                    <h3 class="font-bold text-lg">${member.name}</h3>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${member.tags.map(t => `<span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase ${window.getCategoryStyle(t)}">${t}</span>`).join('')}
                    </div>
                </div>
                <button onclick="handleDeleteTeamMember(${index})" class="text-xs bg-red-100 text-red-600 px-3 py-2 rounded font-bold hover:bg-red-200">Sil</button>
            </div>
        `).join('')}
    </div>
`;

const renderSettingsView = () => `
    <h1 class="text-3xl font-serif font-bold mb-8">Ayarlar & Duyurular</h1>
    <div class="space-y-8 max-w-2xl">
        <!-- Announcement Config -->
        <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 class="text-lg font-serif font-bold mb-4">Site Üstü Duyuru Bandı</h2>
            <form onsubmit="handleUpdateAnnouncement(event)" class="flex flex-col gap-4">
                <input id="announcement-text" value="${state.announcement.text || ''}" class="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded" placeholder="Duyuru metnini buraya yazın...">
                <div class="flex gap-4">
                    <button type="button" onclick="toggleAnnouncementActive()" class="flex-1 py-3 border rounded font-bold ${state.announcement.active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-500'}">
                        ${state.announcement.active ? 'DURUM: AKTİF' : 'DURUM: PASİF'}
                    </button>
                    <button class="flex-1 py-3 bg-black text-white dark:bg-white dark:text-black rounded font-bold">METNİ GÜNCELLE</button>
                </div>
            </form>
        </div>

        <!-- Password Change -->
        <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 class="text-lg font-serif font-bold mb-4">Admin Şifre Değişikliği</h2>
            <form onsubmit="handleUpdatePassword(event)" class="flex flex-col gap-4">
                <input name="newPassword" type="text" placeholder="Yeni Şifre" class="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded outline-none" required minlength="4">
                <button class="w-full py-3 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition">ŞİFREYİ GÜNCELLE</button>
            </form>
        </div>
        
        <!-- Logo & Ads management can be similar to before, calling upload and updating state -->
         <!-- Ad Management -->
        <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 class="text-lg font-serif font-bold mb-4">Reklam Yönetimi</h2>
            <div class="space-y-6">
                <!-- AD 1 -->
                <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded border">
                    <label class="block text-xs font-bold mb-2 uppercase text-gray-500">Reklam 1 (Üst)</label>
                    <div class="flex gap-4 items-start mb-2">
                        ${state.ads.ad1 ? `<img src="${state.ads.ad1}" class="w-20 h-20 object-cover rounded bg-white">` : '<div class="w-20 h-20 bg-gray-200 rounded"></div>'}
                        <div class="flex-grow space-y-2">
                            <input id="ad1-url" value="${state.ads.ad1}" placeholder="Görsel URL'si yapıştırın veya dosya seçin" class="w-full p-2 text-sm border rounded">
                            <div class="flex gap-2">
                                <input type="file" id="ad1-file" onchange="handleAdFileUpload(event, 'ad1')" class="text-xs">
                                <button onclick="updateAdUrl('ad1')" class="px-3 py-1 bg-blue-600 text-white text-xs rounded font-bold">GÜNCELLE</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
`;

const renderLogin = () => `
    <div class="flex items-center justify-center min-h-[80vh] bg-paper dark:bg-gray-900">
        <form onsubmit="handleLogin(event)" class="w-full max-w-md p-10 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700">
            <div class="text-center mb-8">
                <h2 class="text-3xl font-serif font-bold mb-2">Yönetici Paneli</h2>
            </div>
            <div class="mb-6">
                <input type="password" id="admin-pass" class="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none" placeholder="Şifre">
            </div>
            <button type="submit" class="w-full bg-ink text-paper dark:bg-white dark:text-black py-4 rounded-lg font-bold hover:opacity-90">GİRİŞ YAP</button>
        </form>
    </div>
`;

// --- HANDLERS (ADMIN TO BACKEND) ---

window.handleLogin = async (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    
    // Call Backend
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
            renderAdmin(document.getElementById('admin-app'));
        } else {
            alert('Hatalı şifre!');
        }
    } catch (e) {
        alert("Bağlantı hatası: Backend çalışıyor mu?");
    }
};

window.handleLogout = () => {
    state.isAuthenticated = false;
    sessionStorage.removeItem('admin_auth');
    renderAdmin(document.getElementById('admin-app'));
};

window.saveChanges = async () => {
    // Send Current State to Backend to Upsert Supabase
    const payload = {
        articles: state.articles,
        categories: state.categories,
        announcement: state.announcement,
        ads: state.ads,
        logos: state.logos,
        team: state.team,
        teamTags: state.teamTags,
        // Config password is mostly read-only here except update
    };

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/sync`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        if (response.ok) alert("Tüm değişiklikler veritabanına kaydedildi!");
        else alert("Hata: Kaydedilemedi.");
    } catch (error) { alert("Sunucu iletişim hatası."); }
};

window.handleEditArticle = (id) => { state.editingId = id; state.activeAdminTab = 'articles'; renderAdmin(document.getElementById('admin-app')); };
window.cancelEdit = () => { state.editingId = null; renderAdmin(document.getElementById('admin-app')); };
window.handleAddArticle = (e) => { 
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedCategories = [];
    document.querySelectorAll('input[name="categories"]:checked').forEach((checkbox) => selectedCategories.push(checkbox.value));
    if (selectedCategories.length === 0) { alert("Kategori seçiniz."); return; }
    
    let articleDateStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const dateInput = formData.get('dateInput');
    if (dateInput) { const d = new Date(dateInput); articleDateStr = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); } 
    else if (state.editingId) { const old = state.articles.find(a => a.id === state.editingId); if(old) articleDateStr = old.date; }
    
    const articleData = { 
        title: formData.get('title'), 
        author: formData.get('author'), 
        categories: selectedCategories, 
        image_url: formData.get('imageUrl'), // Supabase column is image_url
        content: formData.get('content'), 
        excerpt: formData.get('content').replace(/<[^>]*>?/gm, '').substring(0, 100) + '...', 
        date: articleDateStr, 
        views: state.editingId ? (state.articles.find(a => a.id === state.editingId)?.views || 0) : 0 
    };
    
    // Frontend state update instantly for UI
    if (state.editingId) { 
        const index = state.articles.findIndex(a => a.id === state.editingId); 
        if (index !== -1) { state.articles[index] = { ...state.articles[index], ...articleData }; alert('Güncellendi. "KAYDET" butonuna basınız.'); } 
        state.editingId = null; 
    } else { 
        state.articles.unshift({ id: Date.now(), ...articleData }); 
        alert('Eklendi. "KAYDET" butonuna basınız.'); 
    }
    renderAdmin(document.getElementById('admin-app'));
};

window.handleDeleteArticle = async (id) => { 
    if (confirm('Silinecek? (Bu işlem hemen gerçekleşir)')) { 
        // Backend API Delete
        await fetch(`${BACKEND_API_URL}/api/articles/${id}`, { method: 'DELETE' });
        
        state.articles = state.articles.filter(a => a.id !== id); 
        if(state.editingId === id) state.editingId = null; 
        renderAdmin(document.getElementById('admin-app')); 
    } 
};

// Handlers for categories, files, team, etc.
window.handleAddCategory = (e) => { e.preventDefault(); const formData = new FormData(e.target); const name = formData.get('catName'); if (name) { state.categories.push({ id: Date.now(), name: name, type: formData.get('catType') }); renderAdmin(document.getElementById('admin-app')); } };
window.handleDeleteCategory = (id) => { if (confirm('Silinecek?')) { state.categories = state.categories.filter(c => c.id !== id); renderAdmin(document.getElementById('admin-app')); } };
window.handleUpdateAnnouncement = (e) => { e.preventDefault(); state.announcement.text = document.getElementById('announcement-text').value; renderAdmin(document.getElementById('admin-app')); alert('Güncellendi. Kaydetmeyi unutmayın.'); };
window.toggleAnnouncementActive = () => { state.announcement.active = !state.announcement.active; renderAdmin(document.getElementById('admin-app')); };

window.handleFileUpload = async (e) => { 
    e.preventDefault(); 
    const fileInput = document.getElementById('file-input'); 
    const fileNameInput = document.getElementById('file-name'); 
    if (fileInput.files && fileInput.files[0]) { 
        const formData = new FormData(); 
        formData.append('file', fileInput.files[0]); 
        try { 
            const res = await fetch(`${BACKEND_API_URL}/api/upload`, { method: 'POST', body: formData }); 
            if(res.ok) { 
                const result = await res.json(); 
                state.files.push({ id: Date.now(), name: fileNameInput.value || fileInput.files[0].name, data: result.url }); 
                alert('Yüklendi! Kaydedin.'); 
                renderAdmin(document.getElementById('admin-app')); 
            } else alert("Hata."); 
        } catch (err) { alert("Hata."); } 
    } 
};
window.handleDeleteFile = (id) => { if(confirm("Silinecek?")) { state.files = state.files.filter(f => f.id !== id); renderAdmin(document.getElementById('admin-app')); } };
window.copyToClipboard = (text) => navigator.clipboard.writeText(text).then(() => alert("URL Kopyalandı!"));
window.handleSendMessage = async (e) => { e.preventDefault(); const formData = new FormData(e.target); const messageData = { name: formData.get('name'), email: formData.get('email'), subject: formData.get('subject'), message: formData.get('message') }; try { const res = await fetch(`${BACKEND_API_URL}/api/contact`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(messageData) }); if(res.ok) { alert("Mesajınız iletildi! Teşekkürler."); e.target.reset(); } else { alert("Bir hata oluştu."); } } catch(err) { alert("Bağlantı hatası."); } };

window.handleUpdatePassword = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPass = formData.get('newPassword');
    if(newPass && newPass.length >= 4) {
        state.adminConfig.password = newPass;
        alert("Şifre güncellendi. Lütfen 'KAYDET' butonuna basarak değişiklikleri sunucuya yazın.");
        renderAdmin(document.getElementById('admin-app'));
    } else {
        alert("Şifre en az 4 karakter olmalıdır.");
    }
};

window.handleAdFileUpload = async (e, adKey) => {
    const file = e.target.files[0];
    if(!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(`${BACKEND_API_URL}/api/upload`, { method: 'POST', body: formData });
        if(res.ok) {
            const result = await res.json();
            state.ads[adKey] = result.url;
            renderAdmin(document.getElementById('admin-app'));
        } else alert("Yükleme hatası");
    } catch(err) { alert("Hata"); }
};

window.updateAdUrl = (adKey) => {
    const url = document.getElementById(adKey + '-url').value;
    state.ads[adKey] = url;
    renderAdmin(document.getElementById('admin-app'));
    alert("Reklam URL güncellendi. 'KAYDET' yapmayı unutmayın.");
};

window.handleAddTeamTag = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tagName = formData.get('tagName');
    if(tagName && !state.teamTags.includes(tagName)) {
        state.teamTags.push(tagName);
        renderAdmin(document.getElementById('admin-app'));
    }
};

window.handleDeleteTeamTag = (index) => {
    state.teamTags.splice(index, 1);
    renderAdmin(document.getElementById('admin-app'));
};

window.handleAddTeamMember = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedTags = [];
    document.querySelectorAll('input[name="tags"]:checked').forEach(c => selectedTags.push(c.value));
    
    const newMember = {
        name: formData.get('name'),
        tags: selectedTags,
        youtubeLink: formData.get('youtubeLink')
    };
    state.team.push(newMember);
    renderAdmin(document.getElementById('admin-app'));
    alert("Üye eklendi. 'KAYDET' yapmayı unutmayın.");
};

window.handleDeleteTeamMember = (index) => {
    if(confirm("Silmek istediğinize emin misiniz?")) {
        state.team.splice(index, 1);
        renderAdmin(document.getElementById('admin-app'));
    }
};

// --- EVENTS ---
document.addEventListener('DOMContentLoaded', initApp);
const menuBtn = document.getElementById('menu-btn'); if(menuBtn) menuBtn.addEventListener('click', () => toggleMenu(true));
const closeBtn = document.getElementById('sidebar-close'); if(closeBtn) closeBtn.addEventListener('click', () => toggleMenu(false));
const overlay = document.getElementById('sidebar-overlay'); if(overlay) overlay.addEventListener('click', () => toggleMenu(false));
const themeBtn = document.getElementById('theme-btn'); if(themeBtn) themeBtn.addEventListener('click', toggleTheme);