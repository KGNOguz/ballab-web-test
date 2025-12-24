
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL || '';
// Backend, yazma işlemi için Service Key kullanır.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''; 

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Dosyaları RAM'de tut (Render diskine yazmamak için)
const upload = multer({ storage: multer.memoryStorage() });

// --- ENDPOINTS ---

// 1. Kök Dizin (Health Check)
app.get('/', (req, res) => {
    res.send('BALLAB Backend Çalışıyor (Supabase Storage Active).');
});

// 2. Admin Login
app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    try {
        const { data, error } = await supabase.from('site_config').select('admin_password').eq('id', 1).single();
        if (error) throw error;
        
        // Varsayılan şifre kontrolü (Eğer veritabanı boşsa)
        const dbPass = data ? data.admin_password : 'admin';
        
        if (password === dbPass) res.json({ success: true });
        else res.status(401).json({ success: false, message: "Hatalı şifre" });
    } catch (e) {
        // Eğer tablo yoksa veya hata varsa geçici şifre ile kurtar
        if(password === 'admin123') res.json({ success: true, message: "Fallback login" });
        else res.status(500).json({ error: e.message });
    }
});

// 3. Veri Eşitleme (Admin Save)
app.post('/api/sync', async (req, res) => {
    const { articles, categories, announcement, ads, logos, team, teamTags, adminConfig } = req.body;
    try {
        // Articles Upsert
        if (articles && articles.length > 0) {
            const { error: artError } = await supabase.from('articles').upsert(articles);
            if (artError) throw artError;
        }

        // Config Upsert
        const configData = {
            id: 1,
            categories_list: categories,
            announcement,
            ads,
            logos,
            team,
            team_tags: teamTags
        };
        // Şifre değiştiyse ekle
        if (adminConfig && adminConfig.password) {
            configData.admin_password = adminConfig.password;
        }

        const { error: confError } = await supabase.from('site_config').upsert(configData);
        if (confError) throw confError;

        res.json({ success: true });
    } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Makale Silme
app.delete('/api/articles/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('articles').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Dosya Yükleme (Supabase Storage - 'resources' Bucket)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi' });

    try {
        // Türkçe karakter ve boşlukları temizle
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${Date.now()}_${safeName}`;

        // Storage'a yükle
        const { data, error } = await supabase.storage
            .from('resources')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) throw error;

        // Public URL al
        const { data: publicData } = supabase.storage
            .from('resources')
            .getPublicUrl(fileName);

        res.json({ success: true, url: publicData.publicUrl, fileName: fileName });
    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 6. View Counter
app.post('/api/view/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data } = await supabase.from('articles').select('views').eq('id', id).single();
        if (data) {
            const newViews = (data.views || 0) + 1;
            await supabase.from('articles').update({ views: newViews }).eq('id', id);
            res.json({ success: true, views: newViews });
        } else {
            res.status(404).json({ error: 'Makale bulunamadı' });
        }
    } catch (e) {
        console.log("View error (non-critical):", e.message);
        res.json({ success: false });
    }
});

// 7. İletişim
app.post('/api/contact', async (req, res) => {
    try {
        const msg = { ...req.body, id: Date.now(), date: new Date().toLocaleDateString('tr-TR') };
        const { error } = await supabase.from('messages').insert(msg);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
