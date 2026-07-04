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
    const { image, mimeType } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY or API_KEY is not defined in server environment variables.");
    }

    if (!image || !mimeType) {
      throw new Error("Image data or mimeType missing.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Remove header from base64 string if present (e.g., "data:image/png;base64,")
    const base64Data = image.replace(/^data:.+;base64,/, '');

    const prompt = `
      Analyze this image (invoice, inventory list, or product photo) and extract product details.
      
      Rules for Extraction:
      - Name: Concise product name.
      - Stock: Integer quantity. Default to 1 if just a list item.
      - Unit: e.g., 'pcs', 'kg', 'box'. Default to 'pcs'.
      - Buy Price: Unit cost. Default 0.
      - Sell Price: Retail price. If missing, calculate as Buy Price * 1.3.
      - Category: Infer category (e.g., 'Dairy', 'Produce', 'Snacks').
      
      Return a raw JSON object matching the schema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  stock: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  buyPrice: { type: Type.NUMBER },
                  sellPrice: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ["name", "stock", "unit", "buyPrice", "sellPrice", "category"]
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text);
    
    // Ensure we return an array even if the model acts uniquely
    const products = result.products || [];

    res.status(200).json({ products });
  } catch (error) {
    const errMsg = error.message || String(error);
    if (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("INVALID_ARGUMENT")) {
      console.warn("Invoice Parse API: Gemini API key is not configured or is invalid. Running in local fallback mode.");
    } else {
      console.warn("Invoice Parse API Error (Handled gracefully):", errMsg);
    }
    res.status(200).json({ 
      products: [],
      error: "Gemini API key is not configured or is invalid. Running in local fallback mode."
    });
  }
}