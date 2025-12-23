
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SUPABASE CONFIG ---
// Render Environment Variables kısmına bu keyleri ekleyin.
const SUPABASE_URL = process.env.SUPABASE_URL || 'BURAYA_SUPABASE_URL_YAZIN';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'BURAYA_SUPABASE_SERVICE_ROLE_KEY_YAZIN'; 
// DİKKAT: Backend tarafında Service Key kullanıyoruz ki yazma yetkimiz olsun.

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- MIDDLEWARE ---
app.use(cors()); // Frontend Netlify'da olacağı için CORS önemli
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// --- MEMORY STORAGE FOR UPLOADS ---
// Dosyaları diske değil RAM'e alıp oradan Supabase'e atacağız (Render disk sorunu yaşamamak için)
const upload = multer({ storage: multer.memoryStorage() });

// --- API ENDPOINTS ---

// 1. Admin Login (Basit şifre kontrolü - Config tablosundan çeker)
app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    try {
        const { data, error } = await supabase
            .from('site_config')
            .select('admin_password')
            .eq('id', 1)
            .single();
        
        if (error || !data) return res.status(401).json({ success: false });

        if (password === data.admin_password) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: "Hatalı şifre" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Full Sync (Admin panelinden gelen toplu kaydetme isteği)
// Not: Frontend admin paneli hala "state" mantığıyla çalıştığı için,
// tüm veriyi alıp ilgili tablolara dağıtıyoruz.
app.post('/api/sync', async (req, res) => {
    const { articles, categories, announcement, ads, logos, team, teamTags, adminConfig } = req.body;

    try {
        // A. Makaleleri Güncelle (Upsert)
        // Articles array'ini Supabase formatına uygun hale getirelim gerekirse
        if (articles && articles.length > 0) {
            const { error: artError } = await supabase
                .from('articles')
                .upsert(articles); // ID çakışırsa günceller, yoksa ekler
            if (artError) throw artError;
        }

        // B. Site Config Güncelle
        const { error: confError } = await supabase
            .from('site_config')
            .upsert({
                id: 1,
                categories_list: categories,
                announcement: announcement,
                ads: ads,
                logos: logos,
                team: team,
                team_tags: teamTags,
                admin_password: adminConfig ? adminConfig.password : undefined
            });
        
        if (confError) throw confError;

        res.json({ success: true, message: "Tüm veriler eşitlendi." });
    } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Delete Article
app.delete('/api/articles/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// 4. File Upload (Supabase Storage)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Dosya yok' });

    try {
        // Dosya ismini benzersiz yap
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase
            .storage
            .from('resources') // Supabase'de oluşturduğunuz bucket adı
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype
            });

        if (error) throw error;

        // Public URL oluştur
        const { data: publicData } = supabase
            .storage
            .from('resources')
            .getPublicUrl(fileName);

        res.json({ success: true, url: publicData.publicUrl });
    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 5. Contact Message
app.post('/api/contact', async (req, res) => {
    const message = req.body;
    message.id = Date.now();
    message.date = new Date().toLocaleDateString('tr-TR');
    
    const { error } = await supabase.from('messages').insert(message);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// 6. View Count Increment (Frontend directly can't easily do atomic increments without RPC, simple update here)
app.post('/api/view/:id', async (req, res) => {
    const { id } = req.params;
    
    // Önce mevcut değeri al
    const { data: article } = await supabase.from('articles').select('views').eq('id', id).single();
    if (article) {
        const newViews = (article.views || 0) + 1;
        await supabase.from('articles').update({ views: newViews }).eq('id', id);
        res.json({ success: true, views: newViews });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Kök dizin (Canlı olduğunu anlamak için)
app.get('/', (req, res) => res.send('BALLAB Backend is Live!'));

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
