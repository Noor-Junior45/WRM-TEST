
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const DB_FILENAME = 'noor_pos_db.json';
const LOCAL_DB_PATH = path.join(process.cwd(), DB_FILENAME);

// Helper to authenticate if needed (usually for server-side service account access)
async function getAuth(req) {
  const headerEmail = req.headers['x-google-email'];
  const headerKey = req.headers['x-google-key'];
  let clientEmail = headerEmail || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = headerKey || process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) return null;

  try {
    const formattedKey = privateKey.replace(/\\n/g, '\n');
    const jwtClient = new google.auth.JWT(clientEmail, null, formattedKey, SCOPES);
    await jwtClient.authorize();
    return jwtClient;
  } catch (err) {
    console.error("Auth helper failed:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS Pre-flight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-google-email, x-google-key');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { publicSaleId, publicCustomerUpdate, clearPendingUpdate, pendingUpdates } = req.query;

  try {
    // --- Public Customer Information Update ---
    if (req.method === 'POST' && publicCustomerUpdate === 'true') {
        const { customerId, email, location } = req.body;
        if (!customerId) {
            return res.status(400).json({ error: "Customer ID is required." });
        }

        let dbData = null;
        try {
            const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
            dbData = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: "Storage database not accessible." });
        }

        if (!dbData.pendingUpdates) {
            dbData.pendingUpdates = {};
        }

        const updateData = {
            email: email || '',
            location: location || '',
            timestamp: new Date().toISOString()
        };

        dbData.pendingUpdates[customerId] = updateData;

        if (dbData.customers) {
            const cIndex = dbData.customers.findIndex(c => c.id === customerId);
            if (cIndex > -1) {
                dbData.customers[cIndex].pendingUpdates = updateData;
            }
        }

        await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(dbData, null, 2));
        return res.status(200).json({ success: true, message: "Verification request submitted." });
    }

    // --- Clear/Approve Pending Update ---
    if (req.method === 'POST' && clearPendingUpdate === 'true') {
        const { customerId } = req.body;
        if (!customerId) {
            return res.status(400).json({ error: "Customer ID is required." });
        }

        let dbData = null;
        try {
            const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
            dbData = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: "Storage database not accessible." });
        }

        if (dbData.pendingUpdates && dbData.pendingUpdates[customerId]) {
            delete dbData.pendingUpdates[customerId];
        }

        if (dbData.customers) {
            const cIndex = dbData.customers.findIndex(c => c.id === customerId);
            if (cIndex > -1) {
                delete dbData.customers[cIndex].pendingUpdates;
            }
        }

        await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(dbData, null, 2));
        return res.status(200).json({ success: true });
    }

    // --- Public Invoice Retrieval ---
    if (req.method === 'GET' && publicSaleId) {
        let dbData = null;
        try {
            const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
            dbData = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: "Storage not accessible." });
        }

        if (dbData && dbData.sales) {
            const sale = dbData.sales.find(s => s.id === publicSaleId);
            if (sale) {
                return res.status(200).json({ sale, settings: dbData.settings });
            }
        }
        return res.status(404).json({ error: "Invoice not found." });
    }

    // --- Public Customer Portal Retrieval ---
    if (req.method === 'GET' && req.query.publicCustomerId) {
        const pCustId = req.query.publicCustomerId;
        let dbData = null;
        try {
            const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
            dbData = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: "Storage not accessible." });
        }

        if (dbData && dbData.customers) {
            const customer = dbData.customers.find(c => c.id === pCustId);
            if (customer) {
                // Filter sales for this customer
                const customerSales = (dbData.sales || []).filter(s => s.customerId === pCustId);
                // Return clean settings for public display
                const cleanSettings = {
                    storeName: dbData.settings.storeName,
                    storeAddress: dbData.settings.storeAddress,
                    storePhone: dbData.settings.storePhone,
                    storeEmail: dbData.settings.storeEmail,
                    logo: dbData.settings.logo,
                    currencySymbol: dbData.settings.currencySymbol || '₹',
                    upiId: dbData.settings.upiId || ''
                };
                
                return res.status(200).json({ 
                    customer, 
                    sales: customerSales, 
                    settings: cleanSettings 
                });
            }
        }
        return res.status(404).json({ error: "Customer not found." });
    }

    // --- Retrieve all Pending Updates ---
    if (req.method === 'GET' && pendingUpdates === 'true') {
        let dbData = null;
        try {
            const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
            dbData = JSON.parse(data);
            return res.status(200).json(dbData.pendingUpdates || {});
        } catch (e) {
            return res.status(200).json({});
        }
    }

    // --- Standard Storage Operations (GET/POST) ---
    if (req.method === 'GET') {
      try {
        const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
        return res.status(200).json(JSON.parse(data));
      } catch (e) {
        // Return null instead of error to trigger initial sync on first run
        return res.status(200).json(null);
      }
    }

    if (req.method === 'POST') {
      try {
        const newDb = req.body;

        // Read current file to preserve pendingUpdates
        let existingDb = null;
        try {
          const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
          existingDb = JSON.parse(data);
        } catch (e) {
          // Ignore
        }

        // Merge pendingUpdates into the incoming database state
        if (existingDb && existingDb.pendingUpdates) {
          newDb.pendingUpdates = {
            ...existingDb.pendingUpdates,
            ...(newDb.pendingUpdates || {})
          };

          // Also merge them into the customers array if they exist
          if (newDb.customers) {
            newDb.customers = newDb.customers.map(c => {
              if (existingDb.pendingUpdates[c.id]) {
                return {
                  ...c,
                  pendingUpdates: existingDb.pendingUpdates[c.id]
                };
              }
              return c;
            });
          }
        }

        const payload = JSON.stringify(newDb, null, 2);
        await fs.writeFile(LOCAL_DB_PATH, payload);
        return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
      } catch (e) {
        console.error("Storage write error:", e);
        return res.status(500).json({ error: "Database write failure." });
      }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("API Storage Critical Error:", error);
    res.status(500).json({ error: "Internal Server Fault" });
  }
}
