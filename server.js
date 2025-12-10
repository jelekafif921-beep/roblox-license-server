const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ PostgreSQL connection error:', err.message);
    } else {
        console.log('✅ Connected to PostgreSQL');
        release();
    }
});

// ========== ROUTES ==========

app.get('/', (req, res) => {
    res.json({
        message: 'Roblox License Server (PostgreSQL)',
        status: 'online',
        database: 'PostgreSQL',
        endpoints: {
            health: '/health',
            createKey: '/api/create-key (POST)',
            activate: '/api/activate (POST)',
            validate: '/api/validate (POST)'
        }
    });
});

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// Generate license key
function generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

// Create key (Admin)
app.post('/api/create-key', async (req, res) => {
    try {
        const { scriptId } = req.body;
        const apiKey = req.headers['x-api-key'];
        
        if (apiKey !== process.env.ADMIN_API_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!scriptId) {
            return res.status(400).json({ error: 'Missing scriptId' });
        }
        
        const key = generateKey();
        
        await pool.query(
            'INSERT INTO licenses (key, script_id) VALUES ($1, $2)',
            [key, scriptId]
        );
        
        res.json({
            success: true,
            key,
            scriptId,
            message: 'License key created successfully'
        });
    } catch (error) {
        console.error('Create key error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Activate key
app.post('/api/activate', async (req, res) => {
    try {
        const { key, userId } = req.body;
        
        if (!key || !userId) {
            return res.status(400).json({ error: 'Missing key or userId' });
        }
        
        // Check if key exists and not activated
        const result = await pool.query(
            'SELECT * FROM licenses WHERE key = $1 AND activated = false',
            [key]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or already activated license key' });
        }
        
        // Activate the key
        await pool.query(
            'UPDATE licenses SET user_id = $1, activated = true, activation_date = NOW() WHERE key = $2',
            [userId, key]
        );
        
        res.json({
            success: true,
            message: 'License activated successfully',
            scriptId: result.rows[0].script_id
        });
    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Validate license
app.post('/api/validate', async (req, res) => {
    try {
        const { userId, scriptId } = req.body;
        
        if (!userId || !scriptId) {
            return res.status(400).json({ error: 'Missing userId or scriptId' });
        }
        
        const result = await pool.query(
            'SELECT * FROM licenses WHERE user_id = $1 AND script_id = $2 AND activated = true',
            [userId, scriptId]
        );
        
        res.json({
            valid: result.rows.length > 0,
            license: result.rows[0] || null
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 License server running on port ${PORT} (PostgreSQL)`);
});
