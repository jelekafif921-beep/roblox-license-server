const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB error:', err));

// License Key Model
const licenseSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    userId: { type: Number, default: null },
    scriptId: { type: String, required: true },
    activated: { type: Boolean, default: false },
    activationDate: { type: Date, default: null }
});

const License = mongoose.model('License', licenseSchema);

// ========== ROUTES ==========

// Root route - shows API info
app.get('/', (req, res) => {
    res.json({
        message: 'Roblox License Server API',
        status: 'online',
        endpoints: {
            health: '/health (GET)',
            createKey: '/api/create-key (POST - requires x-api-key header)',
            activate: '/api/activate (POST)',
            validate: '/api/validate (POST)'
        },
        adminKey: 'Use: DID_MASSIVE_ADMIN_KEY_2025_8E7D6C5B4A3928F1',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'License Server Running',
        timestamp: new Date().toISOString()
    });
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
        const newLicense = new License({
            key,
            scriptId
        });
        
        await newLicense.save();
        
        res.json({
            success: true,
            key,
            scriptId,
            message: 'License key created successfully'
        });
    } catch (error) {
        console.error('Error:', error);
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
        
        const license = await License.findOne({ key });
        
        if (!license) {
            return res.status(404).json({ error: 'Invalid license key' });
        }
        
        if (license.activated) {
            return res.status(400).json({ error: 'License already activated' });
        }
        
        license.userId = userId;
        license.activated = true;
        license.activationDate = new Date();
        
        await license.save();
        
        res.json({
            success: true,
            message: 'License activated successfully',
            scriptId: license.scriptId,
            activationDate: license.activationDate
        });
    } catch (error) {
        console.error('Error:', error);
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
        
        const license = await License.findOne({
            userId: userId,
            scriptId: scriptId,
            activated: true
        });
        
        res.json({
            valid: !!license,
            license: license || null
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 License server running on port ${PORT}`);
});
