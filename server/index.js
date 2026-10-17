require('dotenv').config();

const { createApp }    = require('./app');
const { startMonitor } = require('./monitor');

const PORT = process.env.PORT || 4000;

createApp().listen(PORT, () => {
    console.log(`✅ HRD Corp Calculator server running on port ${PORT}`);
    console.log(`   Admin panel: http://localhost:${PORT}/admin`);
    startMonitor();
});
