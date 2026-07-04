import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { query, currentDate } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY or API_KEY is not defined in server environment variables.");
    }

    if (!query) {
      return res.status(200).json({
        searchTerm: "",
        activeFilter: "ALL"
      });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = `
      You are an expert inventory assistant. Translate the user's natural language search query into structured search/filter constraints.
      
      The current local date is: ${currentDate || new Date().toISOString().split('T')[0]}.
      
      Examples:
      - "red t-shirts size XL" -> searchTerm: "t-shirt", color: "red", size: "XL"
      - "items with low stock" -> activeFilter: "LOW_STOCK"
      - "expiring in July 2026" -> expiryBefore: "2026-07-31", activeFilter: "EXPIRING_SOON"
      - "sell price less than 500" -> maxPrice: 500
      - "out of stock dairy" -> activeFilter: "OUT_OF_STOCK", category: "dairy"
      - "items with less than 5 quantity" -> maxStock: 5
      
      Convert any relative time phrases (e.g., "expiring next month", "expiring this year") to absolute dates based on the current date: ${currentDate}.
      If they ask for a month like "July 2026", set expiryBefore to "2026-07-31" and activeFilter to "EXPIRING_SOON".
      
      Query: "${query}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            searchTerm: { type: Type.STRING, description: "Search query for name/sku (or empty string if none)" },
            activeFilter: { type: Type.STRING, description: "One of: 'ALL', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRING_SOON'" },
            size: { type: Type.STRING, description: "Size constraint (e.g. 'M', 'L')" },
            color: { type: Type.STRING, description: "Color constraint (e.g. 'Red')" },
            maxPrice: { type: Type.NUMBER, description: "Maximum selling price" },
            minPrice: { type: Type.NUMBER, description: "Minimum selling price" },
            expiryBefore: { type: Type.STRING, description: "Expiry date ceiling YYYY-MM-DD" },
            category: { type: Type.STRING, description: "Category/Tag constraint" },
            maxStock: { type: Type.NUMBER, description: "Maximum stock count" },
            minStock: { type: Type.NUMBER, description: "Minimum stock count" }
          },
          required: ["searchTerm", "activeFilter"]
        }
      }
    });

    const filterResult = JSON.parse(response.text);
    res.status(200).json(filterResult);
  } catch (error) {
    const errMsg = error.message || String(error);
    if (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("INVALID_ARGUMENT")) {
      console.warn("Parse Query API: Gemini API key is not configured or is invalid. Running in local fallback mode.");
    } else {
      console.warn("Parse Query API Error (Handled gracefully):", errMsg);
    }
    res.status(200).json({ 
      searchTerm: req.body?.query || "", 
      activeFilter: "ALL",
      fallback: true,
      error: "Gemini API key is not configured or is invalid. Running in local fallback mode."
    });
  }
}
